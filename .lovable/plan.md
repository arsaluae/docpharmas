

# Fix PDF Preview + Submit Flow (Invoice + Delivery Note)

## Three Issues Found

### 1. PDF Preview Shows Blank/Cut-Off Content
The `DialogContent` base class uses CSS `grid` layout, but `PdfPreviewDialog` puts `flex-1` on the iframe expecting a `flex-col` parent. The iframe gets zero height and content is invisible.

**Fix**: Add `flex flex-col` to the DialogContent in `PdfPreviewDialog.tsx`.

### 2. Submit Only Shows Invoice — No Delivery Note Access
After clicking Submit, only the Invoice PDF auto-opens. The user needs **two separate documents**:
- **Invoice** (for customer): Product, Qty, Rate, Amount
- **Delivery Note** (for staff): Product, Batch #, Expiry, Qty (no pricing)

Currently there's no easy way to download the Delivery Note from the Sales Orders page.

**Fix**: After submit, show a choice dialog with two buttons: "View Invoice" and "View Delivery Note". Also add a Delivery Note download button (Truck icon) in the actions column for invoiced/dispatched orders.

### 3. Status Column Visibility
On submit (line 369), the sales invoice is created with `status: "dispatched"` but the proforma is set to `status: "invoiced"` (line 428). The proforma correctly appears in the "Invoiced" column. If the user wants it visible in both Invoiced AND Dispatched grids, those are two different document types (proforma vs sales invoice). The current design is correct — proforma shows as "invoiced", and the sales invoice lives in a separate module. No change needed here, but I'll make the two documents easily accessible.

## Files to Change

| File | Change |
|------|--------|
| `src/components/PdfPreviewDialog.tsx` | Add `flex flex-col` to fix iframe height |
| `src/pages/ProformaInvoices.tsx` | After submit: show both Invoice + DN buttons; add DN download action for invoiced orders; create `printDeliveryNote` function |

## Implementation Details

- `PdfPreviewDialog`: Change DialogContent className to include `flex flex-col`
- After submit completes: show a post-submit dialog with "View Invoice" and "View Delivery Note" buttons instead of auto-opening just the invoice
- Add a `printDeliveryNote` function that fetches the delivery note by `reference_id` and generates the DN PDF (Product, Batch, Expiry, Qty — no rate columns)
- Add Truck icon button in actions column for orders with `converted_invoice_id` to download their delivery note

