

# Audit: Sales & Purchase Order End-to-End Flow

## Issues Found

### 1. Purchase Flow: "ordered" vs "confirmed" status confusion
- `handleConfirmOrder` creates a PO with `status: "confirmed"`, but the load function maps it to "ordered" first (`status = "ordered"`) and only overrides to "confirmed" if `linkedPO.status === "confirmed"`. This means Draft → Confirm works, but the intermediate "ordered" status is never actually used — it jumps straight to "confirmed". The Receive button shows for both "ordered" and "confirmed", so this works but is confusing. **No blocker.**

### 2. Sales Flow: Submit blocks if no stock batches exist
- The submit dialog calls `openSubmitDialog` which checks stock_movements for available batches. If no products have been purchased/received yet, it shows "No stock batches available" and returns early. **This is correct behavior** — you can't sell what you don't have. The error message is clear.

### 3. CRITICAL: Payment does NOT update invoice status
- When a payment is recorded in `Payments.tsx`, it only inserts into the `payments` table. The `handle_payment_balance` trigger updates customer/supplier/bank balances, but **never touches** `sales_invoices.status` or `purchase_invoices.status`.
- The `sales_invoices` table has `amount_paid` and `status` columns, but nothing updates them.
- The Sales Order dashboard tries to show "paid" status by reading `sales_invoices.status`, but it's never updated from "dispatched".
- Same for purchase: `purchase_invoices.status` stays "unpaid" forever.

### 4. Sales Order status doesn't track "dispatched" → "paid"
- In `load()`, the code reads `sales_invoices.status` and maps it, but since no code ever updates invoice status to "paid", orders stay at "dispatched" forever.

### 5. Purchase Order: no "paid" status tracking at all
- Purchase flow stops at "received". There's no status for "paid" even though payments are made to suppliers.

## Fix Plan

### A. Create a database trigger to auto-update invoice status on payment
A new trigger on the `payments` table that:
- On INSERT: If `party_type = 'customer'`, find unpaid/partial `sales_invoices` for that customer and update `amount_paid` + `status`. If `party_type = 'supplier'`, do same for `purchase_invoices`.
- On DELETE: Reverse the above.

This is the cleanest approach — no UI code changes needed for the core mechanism.

### B. Add "paid" status to Purchase Order dashboard
- In `PurchaseProforma.tsx` load function, after finding "received" status, also check if the linked bill's status is "paid" → show "paid".
- Add a "Paid" status card to the dashboard grid (making it 6 columns or replacing one).

### C. Verify Sales status propagation works
- Once the trigger is in place, the existing code in `ProformaInvoices.tsx` that reads `sales_invoices.status` will automatically pick up "paid" status.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Create trigger `handle_payment_invoice_status` on payments table |
| `src/pages/PurchaseProforma.tsx` | Add "paid" status tracking in load(), add Paid status card |

No changes needed to `ProformaInvoices.tsx` — the existing status mapping already handles "paid" from `sales_invoices.status`.

