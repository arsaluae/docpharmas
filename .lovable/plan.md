

# Plan: Ultra-Premium Status Filters + Streamlined Tables for Sales & Purchase Orders

## Changes

### 1. Sales Orders (`ProformaInvoices.tsx`)

**Replace stat cards with premium gradient clickable status buttons** (matching dashboard style):
- Draft: Amber gradient, amber icon circle, bottom accent bar
- Invoiced: Blue gradient  
- Dispatched: Violet gradient
- Paid: Emerald gradient
- Each ~80px tall, centered icon + count + value, `hover:scale-[1.03]`, active state shows ring/border
- Clicking filters by that status (already works, just restyling)

**Remove the flow indicator bar** (lines 577-587) — redundant visual noise.

**Reduce table columns**: Remove "Invoice #" column (available in preview sheet). Keep: Checkbox, Order #, Customer, Date, Status, Total, Actions.

**Status badge colors in table** get matching gradient backgrounds:
- Draft → amber bg
- Invoiced → blue bg  
- Dispatched → violet bg
- Paid → emerald bg

### 2. Purchase Orders (`PurchaseProforma.tsx`)

**Refactor to AppLayout** — currently still uses SidebarProvider boilerplate.

**Same premium gradient status buttons**:
- Draft: Amber
- Ordered: Blue
- Confirmed: Violet  
- Received: Emerald

**Remove flow indicator bar** (lines 620-628).

**Remove table columns**: Drop "PO #" and "GRN" columns (available in preview). Keep: Checkbox, Order #, Supplier, Date, Status, Total, Actions.

**Fix actions always visible** — remove `opacity-0 group-hover:opacity-100`.

**Status badge colors** match the gradient theme per status.

## Files Changed

| File | Action |
|------|--------|
| `src/pages/ProformaInvoices.tsx` | Premium status buttons, remove flow bar, streamline table, colored badges |
| `src/pages/PurchaseProforma.tsx` | AppLayout refactor, premium status buttons, remove flow bar, streamline table, colored badges |

