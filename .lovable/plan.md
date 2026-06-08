# Fix Sales Invoice template + Ledger / Reports audit

## 1. Root cause: why batch & expiry don't show on Sales Invoice

The Sales Invoice template stored in `document_templates.columns_config` does **not** include the Batch / Expiry columns:

```
sales_invoice → [Sr#, Product Name, Quantity, Rate, Amount, MRP Inc. Tax]
delivery_note → [Sr#, Product Name, Batch No, Expiry, Quantity]   ← already correct
```

In `pdf-generator.ts`:
```
baseColumns = t?.columns_config?.length ? t.columns_config : opts.columns;
```
…so the saved template **overrides** the columns we pass from `buildSalesInvoiceHtml`. That's why batch/expiry never appear in the rendered Sales Invoice PDF even though we added them in code.

### Fix
- **Migration**: update the existing `document_templates` row for `sales_invoice` to insert `Batch No` and `Expiry` columns between Product Name and Quantity.
  ```
  [Sr#, Product Name, Batch No, Expiry, Quantity, Rate, Amount, MRP Inc. Tax]
  ```
- **Seed/default** in `useDocumentTemplates` (if it seeds new tenants) — add the same two columns so newly-created tenants get them out of the box.
- Same review for `purchase_invoice` template — add Batch / Expiry there too so PI prints carry the captured batch.

No code change needed in pdf-generator (it already resolves the `batch_number` / `expiry_date` keys via `KEY_ALIASES`).

## 2. Ledger audit (accounting correctness)

I traced every trigger that touches party / bank / stock balances. Findings:

### Confirmed correct
| Flow | Trigger | Effect |
|---|---|---|
| Sales Invoice approve | `handle_sales_invoice_balance` | `customers.balance += total` ✓ |
| Payment received | `handle_payment_balance` | `customers.balance -= amount`, `bank += amount` ✓ |
| Sales Return | `handle_sales_return_balance` | `customers.balance -= total` ✓ |
| Purchase Invoice | `handle_purchase_invoice_balance` | `suppliers.balance += total`; **handles total-change on UPDATE** so PI overage auto-recalcs supplier balance ✓ |
| Debit Note (PI shortage) | `handle_debit_note_balance` | `suppliers.balance -= amount` ✓ |
| Stock movement | `handle_stock_movement` + `prevent_negative_stock` | products.stock_quantity adjusted; OUT blocked if would go negative ✓ |
| Void any doc | `void_document` | reverses balance + recomputes party / bank / stock ✓ |

### Issues to fix
1. **Double-allocation risk on customer payments** — `handle_payment_balance` already decrements `customers.balance`, AND `handle_payment_invoice_status` calls `recalc_customer_invoice_status` which only changes invoice `status` / `amount_paid` (not balance). That's correct, but `recalc_customer_invoice_status` re-sums **all** payments for the customer; if an old payment row has `status='voided'` but the trigger doesn't filter on status when reading direct payments… it does (`COALESCE(status,'active') <> 'voided'`). ✓ Already safe.
2. **GRN variance journal** — when we auto-create a Debit Note for shortage, we currently only update the supplier balance via trigger; we do **not** insert a `journal_entries` / `journal_lines` pair. If the user relies on COA / Trial Balance, the DN will show in supplier ledger but not in the journal. Add a `journal_entries` row (Dr Supplier, Cr Purchases) inside the DN insert path.
3. **Purchase Invoice overage** — we bump `purchase_invoices.total`; that fires the UPDATE branch and supplier balance moves correctly, but the original journal entry for the PI (if any) is **not** patched. Add a balancing JE for the overage amount (Dr Inventory, Cr Supplier) or recreate the JE on PI update.
4. **Stock cost snapshot** — `snapshot_sales_item_cost` only fills `unit_cost` if 0/null. If `products.cost_price` changes between PO approval and sale, COGS in reports uses the latest cost. Acceptable, but worth noting in the P&L report.
5. **Sales Return does not return stock** — `handle_sales_return_balance` reverses balance only; stock movement must be inserted by the application (`SalesReturnDialog`). Verify the dialog still inserts a `return_in` movement; if not, add it.

## 3. Reports audit

I'll spot-check each report against the source of truth and fix discrepancies:

| Report | Source | Check |
|---|---|---|
| Receivables Aging | `customers.balance` vs `sales_invoices` outstanding | Use invoice-level outstanding (`total - amount_paid`) for aging buckets, not stored balance |
| Payables Aging | same for suppliers | same fix |
| P&L | `sales_invoice_items.amount` & `unit_cost * qty` | Exclude voided invoices (`status <> 'voided'`) |
| Daily Cash Position | `payments`, `expenses`, `salary_payments` | Ensure voided rows excluded |
| Balance Sheet | `chart_of_accounts.balance` | Run `recompute_account_balance` before render |
| Customer / Supplier Wise | invoice tables | Exclude voided |
| Batch-wise / Expiry | `grn_items` + `stock_movements` | Verify expiry from GRN, not products |
| Tax Compliance | `sales_invoices.gst_amount` + WHT | Exclude voided |

For each report file under `src/pages/reports/`, add a `.neq("status","voided")` filter where missing and switch aging to invoice-level outstanding.

## 4. Deliverables in build phase

1. Migration: update `document_templates.columns_config` for `sales_invoice` and `purchase_invoice` to include Batch / Expiry.
2. Update `useDocumentTemplates` seed defaults to match.
3. Add JE generation when DN/CN auto-created from PI/SI variance (`supabase/migrations` — new trigger on `debit_notes` / `credit_notes` that posts to `journal_entries`).
4. Update `ReceivablesAging.tsx` and `PayablesAging.tsx` to compute outstanding per invoice.
5. Add `.neq("status","voided")` (or equivalent) filters across all reports under `src/pages/reports/`.
6. Verify `SalesReturnDialog` and `PurchaseReturns` insert their stock movements; add if missing.
7. After migration runs, call `run_reconciliation(tenant, true)` once from the app (Settings → Tools button already exists) to auto-fix any historical drift.

## Out of scope
- Re-designing the COA itself.
- New report screens (only fixing existing ones).
- Changing tax rates / GST logic.
