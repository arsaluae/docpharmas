# ERP Data Import / Migration Wizard

Builds on the existing `/import` page (currently 4 simple tabs: Customers/Suppliers/Products/Inventory) and turns it into a production-grade migration system with staging tables, transactional posting, rollback, and a dedicated history view.

## 1. Database — staging + history (one migration)

Two new tables, both tenant-scoped with RLS:

**`import_batches`**
- `entity_type` (products | customers | suppliers | opening_stock | batches | customer_opening | supplier_opening | bank_opening | chart_of_accounts | sales_invoices | purchase_invoices)
- `file_name`, `file_size`, `row_count`, `mapped_count`, `valid_count`, `invalid_count`, `posted_count`
- `column_mapping` jsonb, `options` jsonb (e.g. `allowPastExpiry`, `mergeExisting`)
- `status` — `uploaded | validated | failed | posting | completed | rolled_back`
- `created_by`, `created_at`, `posted_at`, `rolled_back_at`, `rollback_reason`
- `error_summary` jsonb (top error types + counts)

**`import_staging_rows`**
- `batch_id` → `import_batches.id` (cascade)
- `row_number` (original Excel row), `raw` jsonb (raw cells), `normalized` jsonb (after mapping/coercion)
- `status` — `pending | valid | invalid | posted | skipped`
- `errors` jsonb (array of `{field, message}`), `posted_entity_id` uuid (link to final row)
- Index on `(batch_id, status)`

All `INSERT/UPDATE/DELETE/SELECT` policies scoped by `get_user_tenant_id()`, `service_role` full, `set_tenant_id` trigger on insert.

Every existing target table already has `created_at`; we'll also stamp `import_batch_id uuid` (nullable, indexed) on the 12 target tables that can be rolled back: `products, customers, suppliers, stock_movements, grn_items, payments, chart_of_accounts, sales_invoices, sales_invoice_items, purchase_invoices, purchase_invoice_items, bank_accounts`. Rollback = delete rows where `import_batch_id = $1` inside a transaction.

A new RPC `rollback_import_batch(p_batch_id uuid, p_reason text)`:
- Owner/admin only, advisory-lock per tenant
- Deletes rows from every target table by `import_batch_id`
- Marks batch `rolled_back`, logs to `audit_log`

A new RPC `post_import_batch(p_batch_id uuid)` for invoice imports that need transactional integrity (creates invoice + items in one tx, stamps `import_batch_id`).

## 2. Wizard UI

Replace the current `DataImport.tsx` body with a 5-step wizard (keep file-parse + alias logic, just restructure):

```text
[1 Type] → [2 Template] → [3 Upload+Map] → [4 Validate+Preview] → [5 Post+Result]
```

**Step 1 — Entity picker.** A grid of 12 cards grouped:
- *Master Data*: Products, Customers, Suppliers, Chart of Accounts
- *Opening Balances*: Opening Stock, Batches & Expiry, Customer Opening, Supplier Opening, Bank/Cash Opening
- *Historical Transactions*: Sales Invoices, Purchase Invoices

**Step 2 — Template.** "Download Excel template" + "Download Sample (filled)" buttons per entity. Generated client-side with `xlsx` (already a dep) so no storage round-trip.

**Step 3 — Upload & Map.** Existing drag-drop + auto-mapping. Add a manual override `<Select>` per column to remap. Show required-field checklist with green/red ticks. "Continue" disabled until all required fields are mapped.

**Step 4 — Validate & Preview.** Runs all row-level rules client-side, then inserts to `import_staging_rows` in chunks of 500. Shows three tabs: **Valid (N)**, **Invalid (N)**, **Warnings (N)** with a table preview. "Download failed rows" exports invalid rows + reasons as CSV.

**Step 5 — Post.** "Post N valid rows" button. Calls server posting in batches (1000/chunk). Live progress bar, then summary card: posted / skipped / batch ID, with "Rollback this batch" and "Go to History".

## 3. Validation rules (per entity)

Centralised in `src/lib/import/validators.ts`:

| Entity | Required | Extra checks |
|---|---|---|
| Products | name, sku, cost_price, selling_price | sku unique vs DB+batch, prices ≥ 0, valid category enum |
| Customers | name | code unique (auto-generated if blank), opening_balance numeric, dr/cr flag |
| Suppliers | name | code unique, wht_rate 0–100, opening_balance numeric |
| Opening Stock | sku/product_name, quantity | qty ≥ 0, product must resolve (or auto-create flag) |
| Batches | sku, batch_number, expiry_date | expiry ≥ today unless `allowPastExpiry`, qty ≥ 0 |
| Customer Opening | customer (name/code), amount, type | type ∈ debit/credit, amount > 0 |
| Supplier Opening | supplier, amount, type | same |
| Bank Opening | account_name, currency, balance | account not duplicated |
| Chart of Accounts | code, name, type | type ∈ asset/liability/equity/income/expense, code unique |
| Sales Invoices | invoice_number, date, customer, items[] | number unique, line totals reconcile (qty×rate − disc + tax = total) within 0.01 |
| Purchase Invoices | bill_number, date, supplier, items[] | same |

Invoice imports: header rows and item rows in two sheets of the same workbook (`Invoices` + `InvoiceItems` joined by `invoice_number`). Validator groups them and reconciles totals.

## 4. Posting logic

`src/lib/import/posters.ts` — one poster per entity, all of them:
1. Read valid staging rows for the batch
2. Open advisory lock per tenant
3. Insert into target table(s) stamping `import_batch_id = batch.id`
4. Mark staging rows `posted` + `posted_entity_id`
5. Update `import_batches.status = completed`, `posted_at`, counts
6. `logAudit({ action: "created", entity_type: <…>, entity_number: batch.id, changes: { entity_type, rows: posted } })`

Failures inside posting flip the batch to `failed` and leave staging rows untouched so the user can fix and retry (or rollback the partial post).

## 5. Import History page

New route `/import/history` (linked from wizard + sidebar sub-item):
- Table: date, entity, file, rows (valid/invalid/posted), status pill, user, actions
- Row click → drawer with mapping JSON, error summary, "Download failed rows", "Rollback" (owner/admin only, confirms with reason input)
- Filter by entity type & status, date range

## 6. RBAC

- `data_import.read` — owner, accountant, sales_mgr, purchase_mgr, inventory
- `data_import.write` — owner, accountant, purchase_mgr, inventory
- `data_import.rollback` — owner only
Wired through existing `useRoles()` / `RequireCap`.

## 7. Sample templates (generated, not stored)

`src/lib/import/templates.ts` exports `buildTemplate(entity): Blob` producing an XLSX workbook with:
- Sheet 1 `Data` — header row + 2 example rows
- Sheet 2 `Instructions` — field descriptions, required flags, enums, format hints
- Invoice templates ship the second `InvoiceItems` sheet

## File changes

- **new** `supabase/migrations/<ts>_import_wizard.sql` — staging tables, `import_batch_id` columns, `rollback_import_batch` + `post_import_batch` RPCs, RLS, grants
- **new** `src/lib/import/{validators,posters,templates,aliases,types}.ts`
- **rewrite** `src/pages/DataImport.tsx` — 5-step wizard shell (keeps existing parse + alias logic, refactored into `lib/import/`)
- **new** `src/pages/ImportHistory.tsx`
- **edit** `src/App.tsx` — add `/import/history` route
- **edit** `src/components/AppSidebar.tsx` — nest "Import History" under Data Import

## Non-goals (for this pass)

- No background/worker posting — posting runs from the browser tab (chunked). Long imports stay in `posting` state and resume reporting on reload via batch row counts.
- No Excel formula evaluation — values only.
- No partial-row edits in the UI (user fixes the source file and re-uploads).
