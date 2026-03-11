

# Restructure Sales & Purchase Status Grid + Add Delivery Notes to Sidebar

## What the user wants

1. **Delivery Notes in the sidebar** (left navigation) — as its own page, not a tab inside Sales/Purchase Invoices
2. **Sales Invoice status cards**: Only show **All**, **Draft**, **Invoice** at top. Under the "Invoice" filter, the table should display records with statuses: invoiced, dispatched, paid, partial — showing both "Paid" and "Dispatched" as badge labels in the status column
3. **Purchase**: Same pattern — **All**, **Draft**, **Invoice** at top (3 cards only). "Invoice" filter shows ordered, confirmed, received, paid records

## Changes

### 1. `src/App.tsx`
- Add route `/delivery-notes` pointing to the existing `DeliveryNotes` component (already exists as `src/pages/DeliveryNotes.tsx`)
- Import DeliveryNotes

### 2. `src/components/AppSidebar.tsx`
- Add "Delivery Notes" nav item under **Sales** section (after Sales Invoices)
- Add "Delivery Notes" nav item under **Purchase** section (after Purchase Orders) — pointing to same `/delivery-notes` page (it already shows both sales and purchase DNs)

### 3. `src/pages/ProformaInvoices.tsx`
- **Remove** the "Delivery Notes" status card from the grid (5th card)
- **Remove** the "Paid" status card (4th card)
- Keep only 3 cards: **All**, **Draft**, **Invoice**
- The "Invoice" card stats should combine invoiced + dispatched + partial + paid counts
- The "Invoice" filter (`statusFilter === "invoiced"`) should show all non-draft records (invoiced, dispatched, partial, paid)
- **Remove** the entire delivery notes tab/table section (`statusFilter === "delivery_notes"` conditional)
- Remove `loadDeliveryNotes`, `deliveryNotes` state, `dnLoading` state, and related DN tab code

### 4. `src/pages/PurchaseProforma.tsx`
- **Remove** "Received" and "Paid" status cards
- Keep only 3 cards: **All**, **Draft**, **Invoice**
- The "Invoice" card stats should combine ordered + confirmed + received + paid counts
- The "Invoice" filter shows all non-draft records

### Summary of status grid layout (both pages)

```text
┌─────────┐  ┌─────────┐  ┌─────────┐
│   All   │  │  Draft  │  │ Invoice │
│  count  │  │  count  │  │  count  │
│  PKR x  │  │  PKR x  │  │  PKR x  │
└─────────┘  └─────────┘  └─────────┘
```

The "Invoice" card acts as a catch-all for everything post-draft. Individual record statuses (Invoiced, Dispatched, Paid, Partial) still appear as badges in the table rows.

