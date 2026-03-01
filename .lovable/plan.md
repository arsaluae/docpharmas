

# Plan: Edit/Delete for Expenses & Payments + Dashboard Redesign

## 1. Expenses Page -- Add Edit & Delete

**Edit**: Clicking a row opens the existing dialog pre-filled with the expense data. On save, update the record via `supabase.from("expenses").update(...)`. The database trigger `handle_expense_bank_balance` handles bank balance reversal/re-application automatically on DELETE (but not UPDATE), so for edits we will delete-then-reinsert to let triggers fire correctly. Actually, simpler approach: since the only trigger is on bank_account_id for expenses, we can just do a direct `.update()` and handle bank balance manually only if bank_account_id changed. Even simpler: use delete + re-insert pattern wrapped in the save handler.

Final approach for **edit**: Direct `.update()` call. Since the expense trigger only fires on INSERT/DELETE (not UPDATE), if the amount or bank_account_id changes we need to delete the old row and insert a new one to let triggers recalculate. We'll use a delete-then-insert approach for edits.

**Delete**: Add a trash icon button per row. Clicking opens an AlertDialog confirmation. On confirm, `supabase.from("expenses").delete().eq("id", ...)`. The existing `handle_expense_bank_balance` trigger automatically reverses the bank balance on DELETE.

**UI changes**:
- Add an "Actions" column with Edit (pencil) and Delete (trash) icon buttons
- Reuse the existing dialog for both add and edit modes (track `editingId` state)
- Add AlertDialog for delete confirmation

## 2. Payments Page -- Add Edit & Delete

Same pattern as expenses:
- **Delete**: AlertDialog confirmation, then `supabase.from("payments").delete().eq("id", ...)`. The `handle_payment_balance` trigger automatically reverses party balance and bank balance on DELETE.
- **Edit**: Delete-then-insert approach (since triggers only fire on INSERT/DELETE, not UPDATE). Pre-fill dialog with existing data, on save delete old record and insert new one.
- Add Actions column with edit/delete buttons

## 3. Dashboard Redesign

Transform the static dashboard into a more functional and visually appealing layout:

**New data fetched**:
- Today's sales total (sales_invoices where date = today)
- This month's sales & expenses totals
- Recent payments (last 5)
- Top 5 low-stock products with names

**Layout**:
- **Row 1**: 4 primary KPI cards (Receivables, Payables, Today's Sales, Monthly Revenue) with colored left borders
- **Row 2**: 4 secondary KPI cards (Inventory Value, Low Stock Alerts, Customers, Suppliers)
- **Row 3**: Monthly revenue vs expenses bar chart using Recharts (already installed)
- **Row 4**: 3-column grid -- Recent Invoices, Recent Payments, Low Stock Alerts (with product names and quantities)

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Expenses.tsx` | Add editingId state, edit/delete buttons per row, AlertDialog for delete, reuse dialog for edit with delete+insert pattern |
| `src/pages/Payments.tsx` | Same: edit/delete buttons, AlertDialog, edit via delete+insert |
| `src/pages/Index.tsx` | Full redesign with today's sales, monthly chart (Recharts), recent payments section, low stock product list |

## Technical Notes

- No database changes needed -- existing DELETE triggers handle all balance reversals automatically
- Edit uses delete-then-insert to ensure triggers fire correctly (triggers only handle INSERT and DELETE, not UPDATE)
- Recharts is already installed for the dashboard chart
- AlertDialog component from `@/components/ui/alert-dialog` used for delete confirmations

