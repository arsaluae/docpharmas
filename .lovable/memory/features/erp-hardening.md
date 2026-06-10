---
name: erp-hardening
description: Tenant-scoped unique constraints, negative-stock trigger, is_active, void_document RPC, batch+expiry+immutability hardening
type: feature
---

## Existing hardening
- `void_document(p_table, p_id, p_reason)` is the only legal path to invalidate a posted invoice/payment/GRN; enforces 48h grace + reverses balances/stock.
- `prevent_negative_stock` trigger on `stock_movements` blocks every out-movement when product on-hand would go negative.
- Tenant-scoped uniques: `sales_invoices(tenant_id, invoice_number)`, `purchase_invoices(tenant_id, bill_number)`, `payments(tenant_id, payment_number)`.
- `enforce_period_lock_trg` on every transactional table blocks writes inside a locked accounting period.

## Added 2026-06-10
- `company_settings.allow_expired_sale` (default false) — override switch for the expiry guard.
- `company_settings.allow_negative_stock` (default false) — override switch for per-batch stock check.
- `sales_invoice_items.expiry_date date` — required on every NEW line (trigger-enforced; existing rows untouched).
- Trigger `validate_sales_line_batch` (BEFORE INSERT on `sales_invoice_items`):
  - rejects missing batch_number or expiry_date
  - rejects expiry_date < invoice.date (unless allow_expired_sale)
  - cross-checks GRN-recorded expiry
  - rejects requested qty > (received in batch − already sold in batch) when batch has been received (unless allow_negative_stock)
- `sales_invoices.idempotency_key` + `payments.idempotency_key` (nullable text) with partial unique index `(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL`. Client must send a UUID per save to dedupe double-clicks.
- Trigger `enforce_posted_immutability` on `sales_invoices` + `purchase_invoices`: once status ∈ {paid, partial, dispatched, approved}, blocks UPDATE of money fields; only legal transition is to `voided` (with reason + voided_at) via `void_document`.
- Restrictive policies `agent_scope_*` on `sales_invoices`, `sales_returns`, `delivery_notes`, `proforma_invoices`, `warranty_invoices`, `payments`, `customers`: sales_agent users see only rows for customers assigned to them via `agent_customers`.
