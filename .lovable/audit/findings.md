# ERP Audit Findings — 2026-06-10

Scope: full sweep, single pass. Severity: **C**ritical / **H**igh / **M**edium / **L**ow.

## Already correct (no action)

- ✅ Period-lock trigger `enforce_period_lock_trg` attached to `sales_invoices`, `purchase_invoices`, `payments`, `journal_entries`, `expenses`, `salary_payments`, `credit_notes`, `debit_notes`, `sales_returns`, `purchase_returns`, `goods_received_notes`, `stock_movements`.
- ✅ `prevent_negative_stock` trigger on `stock_movements` covers every out-movement (`sale`, `sale_out`, `return_out`, `adjustment_out`, `damage`, `expired`).
- ✅ Tenant-scoped uniques: `sales_invoices(tenant_id, invoice_number)`, `purchase_invoices(tenant_id, bill_number)`, `payments(tenant_id, payment_number)`.
- ✅ Atomic void via `void_document` RPC + 48h grace window.
- ✅ Customer + supplier balance, bank balance, product stock all driven by triggers; `recompute_*` recovery RPCs exist.
- ✅ RLS: restrictive `rbac_*` policies + permissive `tenant_*` policies on every public table that uses tenant_id.
- ✅ Audit log immutable + `logAudit()` helper.
- ✅ Proforma / SO / PO have **no** balance or stock trigger — confirmed by `pg_trigger` scan. Quotation/order semantics intact.

## Critical / High gaps fixed in this sweep

| Sev | Finding | Fix |
| --- | --- | --- |
| C | `sales_invoice_items.batch_number` nullable; no `expiry_date` column. Pharma compliance requires both per line. | Add `expiry_date date`, trigger `validate_sales_line_required_batch` blocks INSERTs missing either. |
| C | No batch-level stock check — `prevent_negative_stock` only guards product totals. A sale can consume more of a batch than exists. | Trigger checks `grn_items` on-hand for the cited batch and rejects if insufficient (override via setting). |
| C | No expired-batch guard. Selling expired pharma stock is a regulatory issue. | Trigger rejects sale of a batch whose `expiry_date < invoice.date` unless `company_settings.allow_expired_sale = true`. |
| H | No idempotency on sales invoice / payment save — double-click can create duplicates inside the 1–2 s before the row appears. | Add `idempotency_key text` + partial unique index on (tenant_id, idempotency_key). Client must send a UUID per save attempt. |
| H | Posted documents (`status IN ('paid','partial','dispatched','approved')`) can be edited with a plain UPDATE — bypasses void workflow + audit trail. | Trigger `enforce_posted_immutability` on `sales_invoices` + `purchase_invoices` blocks UPDATE of financial columns once posted; status change to `voided` only via `void_document`. |
| H | `company_settings` missing the two override switches the rules above need. | Add `allow_expired_sale boolean default false`, `allow_negative_stock boolean default false`. |

## Medium — addressed in follow-up

| Sev | Finding | Plan |
| --- | --- | --- |
| M | Reporting: P&L, Aging, Stock reports — need a SQL-vs-page cross-check now that expiry/batch are required. | Phase C below. |
| M | RBAC: `sales_agent` may still read invoices for customers not allocated to them via the `sales_invoices` permissive policy (uses tenant_id only). | Tighten `tenant_*` SELECT to `is_agent_customer(customer_id)` on sales_invoices / sales_returns / payments / delivery_notes / proforma_invoices / warranty_invoices. |
| M | No `idx_stock_movements_product_batch` for the new batch-availability lookup. | Add. |
| M | `.env.example`, production README, `TEST_CHECKLIST.md`, `SEED.md` missing. | Phase G. |

## Low

- L: Several `console.log` left in `src/pages/Reports.tsx`, `src/lib/pdf-generator.ts` — non-blocking.
- L: Some pages missing skeleton rows during initial fetch; existing `Skeleton` component covers it.

## Out of scope this sweep

- Hub-based sequential generation kept exactly as-is (user confirmed).
- Pakistani CoA / GST / WHT untouched.
- Existing audit_log API unchanged.
