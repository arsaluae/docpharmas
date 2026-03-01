

# Plan: Fix Purchase Workflow — Delete, Approve→PO, Confirm with Rate, GRN Flow

## Problems Found

1. **Delete fails silently**: `window.confirm()` is blocked in the preview iframe — the confirmation never shows, so delete never executes. Fix: replace with a custom Dialog confirmation.

2. **Approve→PO broken (state timing)**: `handleApprove` calls `load()` then immediately does `proformas.find(p => p.id === id)` — but React state hasn't updated yet so it searches the OLD array. The DB fallback query should work, but this is fragile. Fix: fetch the proforma directly from DB instead of relying on state.

3. **PO Confirm dialog too limited**: Currently only allows changing quantity. User needs to also edit **rate** (supplier may confirm different pricing). Fix: add rate input and recalculate amounts/totals on confirm.

4. **PO Confirm should recalculate PO totals**: When rate or quantity changes during confirmation, the PO's subtotal/gst/total should update.

5. **Create GRN button visibility**: Currently shows for both "draft" and "confirmed" status. Should only show after confirmation to enforce the flow.

## Changes

### 1. PurchaseProforma.tsx
- **Delete**: Replace `window.confirm()` with a state-driven confirmation Dialog (custom `deleteConfirmOpen` state)
- **Approve flow**: In `handleApprove`, skip `load()` + `proformas.find()` — instead fetch the proforma directly from Supabase by ID, then pass to `convertToPO`

### 2. PurchaseOrders.tsx
- **Confirm dialog**: Add editable **Rate** input alongside quantity. Recalculate item amounts and update PO subtotal/gst/total on confirm
- **Create GRN button**: Only show when `status === "confirmed"` (remove "draft" from the condition)
- **Row click detail**: Add a detail view showing PO items (read-only) so user can inspect before confirming

## Files Changed

| File | Change |
|------|--------|
| `PurchaseProforma.tsx` | Replace `window.confirm` with Dialog; fix approve flow to fetch from DB directly |
| `PurchaseOrders.tsx` | Add rate editing in confirm dialog; recalculate PO totals; restrict GRN to confirmed only |

