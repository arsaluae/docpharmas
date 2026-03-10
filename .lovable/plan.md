

# Fix Payment Status + Power-User UX Overhaul

## Root Cause: Payment Status Not Updating

I investigated the database and found the issue. The system allocates payments **oldest-first across ALL invoices** for a customer. Your customer has an older unpaid invoice (INV-0001, PKR 48,672 outstanding). When you pay PKR 220 against SI-0011, the money goes to INV-0001 first — so SI-0011 never shows "Paid."

**Fix**: Change payments to be **invoice-specific**. When you click "Receive Payment" on a specific invoice, that payment should apply to THAT invoice, not get lost in the oldest-first pool.

## Changes

### 1. Database: Invoice-Specific Payment Tracking
- Add `invoice_id` column to `payments` table (nullable UUID)  
- Update `recalc_customer_invoice_status` to first allocate invoice-specific payments, then distribute remainder oldest-first
- Same for `recalc_supplier_invoice_status`

### 2. Payment Code Fix (`ProformaInvoices.tsx` + `PurchaseProforma.tsx`)
- Pass the linked `invoice_id` when inserting payment from the quick-pay button
- After payment, the trigger now correctly marks THAT invoice as paid/partial
- Show remaining balance per-invoice in the payment dialog header

### 3. Add "Paid" Status Card to Grid
- Currently 4 cards: All, Draft, Invoice, Delivery Notes
- Add a 5th **"Paid"** card (emerald gradient) so paid invoices are visible at a glance

### 4. Sidebar Rename
- Change "Sales Orders" → "Sales Invoices" in `AppSidebar.tsx`

### 5. Power-User UX (50+/day Operations)
These changes eliminate unnecessary scrolling and clicks:

- **Dropdown action menu**: Consolidate secondary actions (WhatsApp, PDF, DN, Edit) into a `...` dropdown. Keep only **Submit** and **Payment** as primary visible buttons — the 2 actions you do 50+ times
- **Keyboard shortcut**: `Ctrl+N` opens "New Order" dialog instantly from anywhere on the page
- **Auto-focus**: When create dialog opens, auto-focus the Customer field
- **After payment → auto-scroll to next unpaid**: After receiving payment, highlight the next unpaid invoice briefly
- **Remaining balance column**: Add a "Balance" column showing what's still owed per invoice (0 for draft, total-paid for invoiced)
- **Row color coding**: Paid rows get a subtle green tint, overdue (if applicable) get subtle red

### Files to Change

| File | Changes |
|------|---------|
| **Migration SQL** | Add `invoice_id` to payments, update recalc functions |
| `src/pages/ProformaInvoices.tsx` | Pass invoice_id in payment, add Paid card, dropdown actions, balance column, keyboard shortcut, auto-focus |
| `src/pages/PurchaseProforma.tsx` | Mirror payment fix and UX improvements |
| `src/components/AppSidebar.tsx` | Rename "Sales Orders" → "Sales Invoices" |

