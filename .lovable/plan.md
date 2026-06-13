# Phase 1 — ERP Audit Findings & Phased Fix Plan

Read-only audit of 4 priority areas. **No code changed yet.** Below: confirmed defects (with file:line and SQL evidence), then a phased fix plan you can approve in chunks.

---

## 🔴 The "must fix before launch" list (12 items, ranked)

| # | Severity | Area | Defect | Evidence |
|---|---|---|---|---|
| 1 | CRITICAL | Ledger | **Duplicate credit-note triggers** (`credit_note_balance_trigger` + `trg_credit_note_balance`) both enabled → every CN double-applies to `customers.balance` | DB `pg_trigger` |
| 2 | CRITICAL | Ledger | **Live balance drift confirmed**: AA Sons Distributor stored balance −100,000 vs computed +28,900 (drift −128,900 PKR) | smoke-test SQL [2] |
| 3 | CRITICAL | Stock | **Returns create zero stock movements** — sales/purchase returns never restore inventory (`stock_movements` has 0 `return_in` rows) | DB query |
| 4 | CRITICAL | Search | **Products inserted without `is_active`** — every picker filters `.eq("is_active",true)` so new products vanish | `Products.tsx:121-137`, `QuickCreateProductDialog.tsx:60-75` |
| 5 | CRITICAL | Calc | **`sales_invoice_items.amount` stored tax-inclusive** but reports mix it with ex-tax COGS → inflated margins everywhere | `ProformaInvoices.tsx:402` |
| 6 | CRITICAL | Calc | **`unit_cost` snapshot never written** on conversion → historical COGS silently changes when `products.cost_price` is edited | `ProformaInvoices.tsx:919`, `ProfitLoss.tsx:49-53` |
| 7 | CRITICAL | Calc | **Convert-to-invoice doesn't recompute `amount`** when user changes qty in the convert dialog → `amount ÷ quantity ≠ rate` | `ProformaInvoices.tsx:926-938` |
| 8 | HIGH | PDF | `thead` repeat & `tr page-break-inside:avoid` are inside `@media print` only → ignored by html2canvas → all A4 docs lose headers and split rows mid-page | `pdf-generator.ts:361-363` |
| 9 | HIGH | PDF | `white-space:nowrap` on all non-product cells with no max-width → batch/code columns overflow 794px and clip at right edge | `pdf-generator.ts:271` |
| 10 | HIGH | PDF | **5 missing PDF builders**: Sales Return, Purchase Return, Payment Receipt, Customer Ledger, Supplier Ledger | resp. pages |
| 11 | HIGH | PDF | Warranty Note column widths sum to **104%** → overflow with `table-layout:fixed` | `pdf-generator.ts:519-528` |
| 12 | HIGH | Ledger | `CustomerLedger.tsx` / `SupplierLedger.tsx` **don't apply posted-only filter** — draft/voided will pollute ledgers the moment they exist | `CustomerLedger.tsx:76-80`, `SupplierLedger.tsx:62-67` |

## 🟠 Important but not blockers (10 items)

| # | Sev | Defect | Location |
|---|---|---|---|
| 13 | HIGH | Sales-return rate auto-fills from **live** `products.selling_price`, not invoice snapshot → wrong credit | `SalesReturns.tsx:127` |
| 14 | HIGH | Sales-return balance trigger deducts **ex-tax** while invoice trigger adds **inc-tax** → phantom GST stuck in customer balance | trg `sales_return_balance` |
| 15 | HIGH | Purchase Invoice PDF reads `purchase_proforma_items` (pre-GRN qty) instead of actual invoiced items | `PurchaseProforma.tsx:371` |
| 16 | HIGH | PII leak: hardcoded individual NIC + licence in `WARRANTY_NOTE_TEXT` shown on every tenant without DB override | `warranty-declaration.ts:9` |
| 17 | HIGH | `agent_batch_availability` view = `GRN − sales`, ignores returns/damage/expired → wrong remaining qty | DB view |
| 18 | MED | `trg_stock_movement` & `trg_prevent_negative_stock` have **no UPDATE handler** → row edits skip stock + bypass negative-stock guard | DB triggers |
| 19 | MED | `handle_payment_balance` has **no UPDATE handler** → editing a payment amount loses the delta | DB trigger |
| 20 | MED | `WarrantyInvoices.gst_amount` hardcoded to 0 → tax exposure if GST-registered | `WarrantyInvoices.tsx:352` |
| 21 | MED | `ReceivablesAging` outstanding = `total − amount_paid` only, ignores returns/credit notes applied | `ReceivablesAging.tsx:30-31` |
| 22 | MED | `BatchWiseReport.remaining = qty_received − qty_sold`, ignores purchase returns and sales returns | `BatchWiseReport.tsx:39` |
| 23 | LOW | `SearchableSelect` matches `option.label` only — no SKU/generic/barcode | `SearchableSelect.tsx:60` |
| 24 | LOW | No rounding discipline anywhere (raw float) → 0.01–0.05 PKR drift between Σ(lines) and header on big invoices | all forms |
| 25 | LOW | Filename `INV-001---Customer.pdf` (triple dash from em-dash) | `PdfPreviewDialog.tsx:133` |

---

## Proposed fix plan (phased, ordered by blast radius ↘)

### Phase 2 — Stop the bleeding (lowest risk, highest value)
*A single migration + 3 small code edits. ~1 turn.*

1. **DB migration**: drop duplicate trigger `credit_note_balance_trigger` (keep `trg_credit_note_balance`).
2. **DB migration**: set `products.is_active` column default to `true` and `UPDATE products SET is_active = true WHERE is_active IS NULL` (one-off cleanup).
3. **Code**: add `is_active: true` to insert payload in `Products.tsx:121` and `QuickCreateProductDialog.tsx:60`.
4. **Code**: import `applyPosted()` in `CustomerLedger.tsx` and `SupplierLedger.tsx` and chain on all 4 fetches.
5. **One-time data fix**: recompute and overwrite `customers.balance` / `suppliers.balance` from posted-only ledger (single SQL).

### Phase 3 — Calculation truth (math correctness)
*One shared util + one migration. Touches every sales form.*

1. Create `src/lib/invoice-math.ts` exporting `calcLine()`, `calcTotals()` returning `{ gross, discount, taxable, tax, net }` — line `net` is **ex-tax**, header carries tax separately.
2. Refactor `ProformaInvoices.tsx` `calcTotals` + `updateItem` to use it. `item.amount` becomes ex-tax to match `invoices.subtotal`.
3. Backfill `sales_invoice_items.amount` from existing `quantity × rate × (1 − disc%)` (no tax) via one-off SQL.
4. Repoint `ProductPerformance.tsx`, `ItemWiseReport.tsx`, `CustomerWiseReport.tsx` to ex-tax revenue so all reports reconcile to P&L.
5. On invoice conversion, recompute `amount` from current `convert_quantity` and persist `unit_cost` snapshot (close gaps #6 + #7).
6. Fix `sales_return_balance` trigger to deduct **inc-tax** to match the sales invoice trigger.
7. Sales-return form: auto-fill `rate` from the original invoice item, not from `products.selling_price`.

### Phase 4 — Stock & ledger triggers
*DB migration only.*

1. Add `AFTER INSERT` trigger on `sales_return_items` and `purchase_return_items` that writes `return_in` / `return_out` rows into `stock_movements` with `reference_type='sales_return'` / `'purchase_return'`.
2. Extend `agent_batch_availability` view to add `+ sales_returns − purchase_returns − damage − expired`.
3. Add UPDATE handler to `trg_stock_movement`, `trg_prevent_negative_stock`, `trg_payment_balance` (all currently INSERT/DELETE only).

### Phase 5 — PDF pipeline
*Refactor `pdf-generator.ts` and `PdfPreviewDialog.tsx`. Add 5 missing builders.*

1. Move `thead{display:table-header-group}` and `tr{page-break-inside:avoid}` **out of `@media print`** so html2canvas honors them.
2. Replace `white-space:nowrap` defaults with `word-break:break-word`; switch column widths to a `<colgroup>` summing to 100%.
3. Reset `padding` on `.page-frame` in `PRINT_CHROME_CSS` so the 794px iframe maps cleanly to 190mm A4.
4. Fix Warranty Note colgroup to total 100%.
5. Build PDFs for Sales Return, Purchase Return, Payment Receipt, Customer Ledger, Supplier Ledger using the same `buildA4Html` shell + ledger-table variant.
6. Replace the PII-laden `WARRANTY_NOTE_TEXT` default with a neutral placeholder; show a Settings warning when blank.
7. Point Purchase Invoice PDF at `grn_items` (actual receipts) not `purchase_proforma_items`.

### Phase 6 — Polish + remaining HIGH/MED
Search by SKU/generic/barcode in `SearchableSelect`; rounding discipline (`round2()` helper everywhere); aging report fixes; batch report fixes; warranty GST toggle.

### Phase 7 — UAT
Run the 8-query smoke-test SQL (in the Stock/Ledger audit) before and after Phase 2-4 and prove drift = 0. Then walk through the 25-step manual test list from the original brief.

---

## Technical notes (for reference)

- All 4 sub-agent reports are saved in chat history — full per-file tables available on request.
- The smoke-test SQL block is re-runnable; recommend wiring it into a Settings → System Health card after Phase 4.
- Memory says "11 triggers for 10 movement types" — actual is 12 (one is the duplicate CN trigger that needs dropping).
- The `posted.ts` helpers already exist (`applyPosted`, `NOT_POSTED_IN_LITERAL`) — ledgers just don't use them.

---

## What I need from you

Pick which phases to greenlight. Recommended order: **Phase 2 first** (it's safe, ~1 migration + 3 edits, and clears 4 of the top 5 blockers), then review, then Phase 3, etc. Or say "do 2 + 3 together" and I'll batch them.
