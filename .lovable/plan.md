
Root cause confirmed from backend network/audit:

1) Purchase confirm is failing because the app inserts `purchase_orders.status = "confirmed"` but the database check only allows `draft/sent/partial/received/cancelled` (HTTP 400 constraint error).
2) Sales submit is failing for the same pattern: app inserts `sales_invoices.status = "dispatched"` while the database check only allows `draft/sent/partial/paid/overdue`.
3) Both flows fail silently in UI because current handlers don’t surface insert errors clearly (they mostly branch on `if (data)`).

Assumption for your requested purchase flow:
- We will keep business flow as: Draft → Confirmed/Ordered (PO) → Received (GRN + Bill) → Paid.

Implementation plan

1) Fix status compatibility at database level (migration)
- Update `purchase_orders_status_check` to include `confirmed` (while keeping existing values).
- Update `sales_invoices_status_check` to include `dispatched` (while keeping existing values).
- This aligns backend constraints with the statuses the UI already uses.

2) Harden Sales submit flow (`src/pages/ProformaInvoices.tsx`)
- Add explicit error handling for:
  - invoice insert
  - sales_invoice_items insert
  - delivery_note insert
  - proforma update
- Show exact actionable toast when any step fails (no more silent stop).
- Keep current batch allocation validation, but improve failure copy.

3) Harden Purchase confirm flow (`src/pages/PurchaseProforma.tsx`)
- Add explicit error handling for:
  - PO insert
  - PO items insert
  - additional costs copy
  - purchase proforma status update
- Prevent false “success” when PO creation fails.

4) Normalize status mapping for old + new records
- Sales dashboard mapping:
  - treat invoice `sent` and `dispatched` consistently as dispatched stage in UI.
- Purchase dashboard mapping:
  - treat PO `sent` as ordered, `confirmed` as confirmed, `received` as received, bill `paid` as paid.

5) Make purchase flow clearly visible through to payment
- Add/restore “Paid” status card in Purchase dashboard summary so final stage is visible.
- Ensure rows move to Paid when linked bill status becomes paid.

6) End-to-end validation after code changes
- Test sales path: Draft order → Submit → Sales invoice + delivery note created.
- Test purchase path: Draft order → Confirm → Receive (batch/expiry/qty) → GRN + purchase bill created.
- Test payment path: record payment against customer/supplier and verify order/dashboard status updates to Paid.
- Validate with network responses + backend row checks to ensure every stage persists correctly.

Technical details (what will be changed)

- Migration:
  - `ALTER TABLE public.purchase_orders DROP CONSTRAINT ...;`
  - recreate check with `confirmed` included.
  - `ALTER TABLE public.sales_invoices DROP CONSTRAINT ...;`
  - recreate check with `dispatched` included.
- Frontend files:
  - `src/pages/ProformaInvoices.tsx` (submit error handling + status normalization)
  - `src/pages/PurchaseProforma.tsx` (confirm error handling + paid-stage visibility + normalization)
- No auth model or roles changes required.
