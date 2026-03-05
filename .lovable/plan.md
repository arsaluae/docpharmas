

# Plan: Proforma/Invoice UX Overhaul + Filters + Auto Delivery Notes + Searchable Dropdowns

## Summary of Changes

This is a major UX upgrade across the sales workflow: better status colors, filters on every listing page, auto-generating delivery notes when invoices are created, removing Delivery Notes from the sidebar, and replacing all customer/product Select dropdowns with searchable Combobox inputs.

## 1. Status Color Differentiation

**ProformaInvoices.tsx** — Update `statusColor()`:
- `draft` → `bg-warning/10 text-warning` (Orchid Violet — stands out as "pending action")
- `approved` → `bg-primary/10 text-primary` (Sapphire — active/ready)
- `invoiced` → `bg-primary/20 text-primary font-semibold` (stronger sapphire — completed)

**SalesInvoices.tsx** — Update `statusColor()`:
- `draft` → `bg-warning/10 text-warning`
- `dispatched` → `bg-primary/10 text-primary`
- `paid` → `bg-primary/20 text-primary font-semibold`

Apply similar pattern to WarrantyInvoices, PurchaseProforma, PurchaseOrders, etc.

## 2. Filters on Every Listing Page

Add filter bar below the search input on these pages: ProformaInvoices, SalesInvoices, WarrantyInvoices, PurchaseProforma, PurchaseOrders, GoodsReceivedNotes, PurchaseInvoicesPage, Payments, Expenses.

Each page gets:
- **Status filter**: Pill-style toggle buttons (All | Draft | Approved | Invoiced, etc.)
- **Customer/Supplier filter**: Searchable dropdown to filter by party
- Update the `filtered` variable to apply both search + status + customer filters

Implementation pattern (same for all pages):
```tsx
const [statusFilter, setStatusFilter] = useState("all");
const [customerFilter, setCustomerFilter] = useState("");

const filtered = proformas.filter(p => {
  const matchSearch = p.proforma_number.toLowerCase().includes(search.toLowerCase()) 
    || (p.customers?.name || "").toLowerCase().includes(search.toLowerCase());
  const matchStatus = statusFilter === "all" || p.status === statusFilter;
  const matchCustomer = !customerFilter || p.customer_id === customerFilter;
  return matchSearch && matchStatus && matchCustomer;
});
```

Filter UI: A row of glass-pill buttons for status, plus a small searchable customer dropdown.

## 3. Auto Delivery Note on Invoice Creation

When a proforma is converted to an invoice (`handleConvert` in ProformaInvoices.tsx), automatically create a Delivery Note from the invoice items right after creating the invoice. This eliminates the need for a separate DN creation step.

Changes in `handleConvert()`:
- After inserting sales_invoice and sales_invoice_items, auto-generate a DN number via `generate_document_number("delivery_note")`
- Insert a delivery_note with the invoice items (product_name, batch_number, quantity)
- Update invoice status to "dispatched" instead of "draft"
- Remove the DN button from SalesInvoices action column (keep PDF only)
- Remove the DN batch selection dialog from SalesInvoices.tsx (simplify the file significantly)

## 4. Remove Delivery Notes from Sidebar

**AppSidebar.tsx**: Remove the `{ title: "Delivery Notes", url: "/delivery-notes", icon: FileOutput }` entry from the Sales section. The route `/delivery-notes` still exists for direct access but is no longer in the main nav since DNs are auto-generated.

## 5. Searchable Customer & Product Dropdowns (Combobox)

Replace all `<Select>` dropdowns for customer and product selection with a searchable Combobox pattern using the existing `cmdk` (Command) component.

Create a reusable `SearchableSelect` component:
```tsx
// src/components/SearchableSelect.tsx
// Uses Popover + Command (cmdk) for type-to-search
// Props: options[], value, onChange, placeholder
```

Replace in these files:
- **ProformaInvoices.tsx**: Customer select in create dialog, product select in item rows
- **SalesInvoices.tsx**: Customer select in create/edit dialogs, product select in item rows
- **WarrantyInvoices.tsx**: Customer select, product select
- **PurchaseProforma.tsx**: Supplier select, product select
- **PurchaseOrders.tsx**: Supplier select, product select
- **Payments.tsx**: Party select
- **Expenses.tsx**: Bank account select

## 6. Premium UI Polish

- All filter bars get glass-card styling with backdrop blur
- Status pills use refined color palette with subtle gradients
- Combobox dropdowns have smooth animations and premium spacing
- Search inputs have refined focus states

## Files Changed

| File | Changes |
|------|---------|
| `src/components/SearchableSelect.tsx` | **NEW** — Reusable searchable dropdown using Popover + Command |
| `src/pages/ProformaInvoices.tsx` | Status colors, filters (status + customer), searchable selects, auto-DN on convert |
| `src/pages/SalesInvoices.tsx` | Status colors, filters, searchable selects, remove DN dialog/button (auto-created now) |
| `src/pages/WarrantyInvoices.tsx` | Filters, searchable selects |
| `src/pages/PurchaseProforma.tsx` | Filters, searchable selects |
| `src/pages/PurchaseOrders.tsx` | Filters, searchable selects |
| `src/pages/GoodsReceivedNotes.tsx` | Filters |
| `src/pages/PurchaseInvoicesPage.tsx` | Filters |
| `src/pages/Payments.tsx` | Filters, searchable selects |
| `src/pages/Expenses.tsx` | Filters |
| `src/components/AppSidebar.tsx` | Remove Delivery Notes from nav |

