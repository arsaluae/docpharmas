

# Fix Sales Invoice Titles + Purchase Invoice Flow

## Issues Found

### Sales Side
1. **PDF title shows "SALES ORDER" for invoiced orders** — `openPreview` always uses title "SALES ORDER" regardless of status. When invoiced, it should say "SALES INVOICE".
2. **Invoiced orders should appear in both Invoiced AND Dispatched tabs** — Currently filtered by exact status match. Will make the Dispatched tab also include "invoiced" status orders.

### Purchase Side  
3. **Status mismatch bug** — `handleConfirmOrder` sets proforma status to `"ordered"` (line 361) but the status tab filters for `"confirmed"`. Confirmed orders don't appear in ANY tab except "All". This is why the user sees items disappearing.
4. **Rename "Confirmed" → "Invoice"** and fix the status to use `"ordered"` consistently.
5. **PDF title shows "PURCHASE ORDER" after confirm** — Should say "PURCHASE INVOICE".
6. **No dual-document choice dialog** on purchase confirm — Need the same Invoice + Delivery Note post-confirm dialog as sales.
7. **Product name and # column hidden** — The PDF generated after confirm doesn't show product names properly because `previewItems` state might be stale. Will fix by using the freshly fetched `poItems` data.

## Changes

### `src/pages/ProformaInvoices.tsx`
- `openPreview`: Use title "SALES INVOICE" when `order.status === "invoiced"`, use `statusTheme: "invoiced"` accordingly
- `dispatchedStats`: Count both "dispatched" AND "invoiced" statuses  
- Filter: When `statusFilter === "dispatched"`, also match "invoiced" orders
- Remove separate "Dispatched" tab — merge into "Invoiced" since the flow is Draft → Invoiced (which IS dispatched)

### `src/pages/PurchaseProforma.tsx`
- Fix `confirmedStats` → use `statsByStatus("ordered")` to match actual status
- Rename tab label from "Confirmed" to "Invoice", use `statusKey: "ordered"`
- `statusLabel`: Map "ordered" → "Invoice"
- `handleConfirmOrder`: After confirm, show post-confirm dialog with "View Purchase Invoice" + "View Delivery Note" buttons (same pattern as sales)
- PDF title after confirm: "PURCHASE INVOICE" instead of "PURCHASE ORDER"
- `openPreview`: When status is "ordered", use title "PURCHASE INVOICE" and statusTheme "invoiced"
- Add `postConfirmOpen`, `postConfirmOrder` state + dialog UI
- Add `printPurchaseInvoice` and `printPurchaseDeliveryNote` functions
- Add Invoice (FileText) and Truck icon buttons in actions for ordered/received orders

