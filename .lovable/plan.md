

# Sync Delivery Notes with Invoices + UI Polish

## Current Issues

1. **Delivery Notes tab lacks invoice number** — DN listing shows DN#, Customer, Date, Items but no link to which invoice it belongs to.
2. **Deleting a DN doesn't delete the invoice (and vice versa)** — The void flow deletes both, but standalone DN delete (`deleteDn`) only removes the DN without touching the invoice. Similarly, if an invoice were deleted independently, the DN would be orphaned.
3. **DN tab shows all delivery notes** including potentially orphaned ones — should only show DNs that have a valid linked invoice.
4. **UI could be more polished** — the DN table is bare, missing invoice reference, status badges, and visual refinements.

## Plan

### 1. Add Invoice Number to Delivery Notes Tab
- In `loadDeliveryNotes`, join with `sales_invoices` via `reference_id` to fetch the linked `invoice_number`
- Add an "Invoice #" column to the DN table showing the linked invoice number
- Make it clickable to open the invoice PDF

### 2. Cascade Delete: DN ↔ Invoice Sync
- **Deleting a DN**: When user deletes a DN from the DN tab, also delete the linked invoice, its items, stock movements, and reset the proforma back to draft (same as void logic)
- **Deleting an invoice independently**: Already handled by void flow. Will ensure consistency.
- Replace the simple `deleteDn` with a full `voidFromDn` function that mirrors `confirmVoid` logic but starts from the DN side

### 3. Filter to Only Show DNs with Valid Invoices
- Query delivery notes with an inner join check — only show DNs where `reference_id` matches an existing `sales_invoices` record

### 4. Visual Polish
- Add Status badge (issued/delivered) with colored styling to DN table
- Add Invoice # column with mono font
- Add total items count in the stat card for DN tab
- Improve empty state with better messaging
- Add row hover effects and consistent spacing

## Files to Change

| File | Change |
|------|--------|
| `src/pages/ProformaInvoices.tsx` | Update `loadDeliveryNotes` to fetch invoice numbers; replace `deleteDn` with full cascade void; add Invoice # column; polish DN table UI |

## Technical Details

**loadDeliveryNotes update:**
```typescript
// Fetch DNs, then batch-fetch linked invoices
const invIds = data.map(d => d.reference_id);
const { data: invs } = await supabase.from("sales_invoices").select("id, invoice_number").in("id", invIds);
// Map invoice_number onto each DN row
```

**Cascade delete from DN:**
```typescript
const voidFromDn = async (dn: DeliveryNoteRow) => {
  // Find the proforma linked to this invoice
  const { data: proforma } = await supabase.from("proforma_invoices")
    .select("id").eq("converted_invoice_id", dn.reference_id).single();
  // Delete stock movements, invoice items, invoice, DN
  // Reset proforma to draft
};
```

