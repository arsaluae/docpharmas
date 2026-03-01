

# Plan: Sales Sequential Flow + Document Content Fixes

## Summary
Enforce the same sequential workflow on the sales side as purchases, and ensure correct columns on each document type.

## Current State
- **Purchase side**: Already enforced (Proforma → PO → GRN), standalone creation removed ✓
- **Sales side**: `SalesInvoices.tsx` still has a standalone "New Invoice" button. Users can create invoices without a proforma.
- **GRN PDF**: Currently shows rate/amount columns — should only show item name, qty, batch, expiry
- **Delivery Note PDF**: Currently shows only qty — correct, but need to confirm batch/expiry are shown
- **PO PDF**: Shows rate/amount — correct ✓
- **Proforma/Invoice**: Show rate/amount — correct ✓

## Changes

### 1. Sales Invoices (`SalesInvoices.tsx`)
- **Remove** the standalone "New Invoice" button and creation dialog
- **Add** flow indicator banner: `① Proforma → ② Sales Invoice → ③ Delivery Note`
- **Add** "Go to Proformas" button in header (same pattern as PurchaseOrders)
- Empty state message: "Create a Sales Proforma first, then approve it to auto-generate an Invoice"
- Keep the DN batch-selection dialog, detail/edit dialog, and all existing functionality

### 2. GRN Page (`GoodsReceivedNotes.tsx`)
- **GRN PDF**: Remove rate/amount columns from the `generatePdf` call. Show only: #, Product, Batch, Expiry, Qty Ordered, Qty Received
- **GRN creation form**: Keep rate/amount fields for internal tracking but the printed PDF should focus on logistics columns

### 3. Delivery Notes (`DeliveryNotes.tsx`)
- **DN PDF** (`printDN`): Already shows Product, Batch, Expiry, Quantity — confirm no rate/amount. This is correct.

### 4. Purchase Orders PDF
- Already shows rate/amount — correct for a financial document ✓

### 5. Sales Proforma conversion flow
- Already auto-opens convert dialog on approve and auto-downloads invoice PDF ✓
- After invoice creation, verify it navigates to `/sales-invoices` (currently stays on proforma page — need to add `navigate("/sales-invoices")`)

## Files Changed

| File | Change |
|------|--------|
| `SalesInvoices.tsx` | Remove standalone "New Invoice" button/dialog; add flow indicator and "Go to Proformas" link |
| `GoodsReceivedNotes.tsx` | Update GRN PDF columns to logistics-only (no rate/amount) |
| `ProformaInvoices.tsx` | Add `navigate("/sales-invoices")` after conversion completes |

## Technical Notes
- No database changes needed
- All existing batch validation, auto-PDF, and edit/detail functionality remains intact
- The creation dialogs for items with rate/amount stay in Proformas (where pricing belongs)
- GRN form still captures rate internally for cost tracking, but PDF output is logistics-focused

