

# Plan: Rebuild Sales & Purchase Hubs — Premium, Purpose-Driven UX

## Core User Flow (Sales)

1. **Create Sales Order** (Draft) — just a quote, no accounting/inventory
2. **Click on order** → opens a premium branded **Order Preview** panel (not a plain dialog) showing company logo, items, totals with polished formatting — screenshottable for WhatsApp
3. **Three action buttons** on the preview: **WhatsApp Share** | **Download PDF** | **Submit** (converts to invoice)
4. **Submit** opens batch selection dialog — every item MUST have a batch from stock. If no batches exist for a product, the Submit button is blocked with a clear message ("No stock available for X")
5. On confirm → creates Invoice (triggers accounting via existing triggers) + Delivery Note (item, customer, batch, expiry) + stock movements
6. Table view shows all orders with status badges, filters, summary stats

## Core User Flow (Purchase)
1. **Create Purchase Order** (Draft) — just a request
2. **Click on order** → same premium preview panel
3. **Confirm Order** → creates PO record
4. **Mark Received** → requires batch + expiry for every item → creates GRN + Bill + stock movements

## What Changes

### `src/pages/ProformaInvoices.tsx` — Full Rewrite
- **Simplify load()**: Query only `proforma_invoices` + status field. No dual-table merge. For invoiced ones, store `converted_invoice_id` to fetch invoice number when needed.
- **Replace detail dialog** with a premium **Order Preview Sheet** (slide-in panel using Sheet component):
  - Company logo + name at top (from settings)
  - Order number, date, customer info in a branded card
  - Items table with clean formatting
  - Totals section
  - Three prominent action buttons at bottom:
    - 🟢 **Submit** (teal, primary) — opens batch selection
    - 📄 **Download PDF** — opens preview page
    - 💬 **WhatsApp** — opens `wa.me` with pre-formatted order text
  - Edit button (only for drafts)
- **Batch selection enforcement**: When clicking Submit, check stock_movements for each product. If ANY product has zero available batches → show error toast and block. Pre-populate batch dropdown from available stock.
- **Premium UI elements**:
  - Gradient stat cards instead of plain borders
  - Status flow as a subtle timeline, not just text pills
  - Table rows with hover effects and subtle shadows
  - Action buttons with icons, proper spacing, no cramped layout

### `src/pages/PurchaseProforma.tsx` — Full Rewrite
- Same structural improvements as Sales
- Premium Order Preview Sheet for detail view
- WhatsApp + PDF + Confirm Order buttons
- Receive dialog stays (batch + expiry required)

### `src/lib/pdf-generator.ts` — No changes needed
Already has the premium pharma template with preview-first flow.

### `src/components/AppSidebar.tsx` — Rename labels
- "Sales" → "Sales Orders" (clearer terminology)
- "Purchases" → "Purchase Orders"

## Technical Details

### Simplified Data Flow (Sales)
```
proforma_invoices table (single source of truth)
  status: draft | invoiced | dispatched | paid
  converted_invoice_id: links to sales_invoices when confirmed
```
- `load()` queries ONLY `proforma_invoices` with customer join
- No more merging with `sales_invoices` table
- Invoice number shown by joining via `converted_invoice_id` when needed

### Batch Validation Logic
```typescript
// On Submit click:
1. Fetch stock_movements for all product_ids in the order
2. Calculate available qty per product+batch
3. If any product has ZERO available batches → toast.error + block
4. Show batch selection with available quantities
5. User must select batch for every item
6. Confirm → create invoice + items + stock_movements + delivery_note
```

### WhatsApp Share
```typescript
const text = `*Sales Order ${doc.doc_number}*\n${companyName}\n\nCustomer: ${customerName}\nDate: ${doc.date}\n\n${items.map(i => `• ${i.product_name} x${i.quantity} @ ${i.rate}`).join('\n')}\n\n*Total: PKR ${doc.total.toLocaleString()}*`;
window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
```

### Premium UI Patterns
- Sheet (slide-in panel) for order preview instead of Dialog
- Gradient backgrounds on stat cards (`bg-gradient-to-br from-teal-500/10 to-teal-600/5`)
- Refined typography: larger doc numbers, subtle date formatting
- Action buttons with proper visual hierarchy (primary/outline/ghost)
- Loading skeletons during data fetch

## Files Changed

| File | Change |
|------|--------|
| `src/pages/ProformaInvoices.tsx` | Full rewrite — simplified data, premium order preview sheet, WhatsApp/PDF/Submit actions, batch enforcement |
| `src/pages/PurchaseProforma.tsx` | Full rewrite — same pattern as sales, premium preview, confirm/receive flow |
| `src/components/AppSidebar.tsx` | Rename "Sales" → "Sales Orders", "Purchases" → "Purchase Orders" |

No database changes needed. All existing triggers and tables remain.

