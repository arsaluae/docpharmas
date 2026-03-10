

# Fix Payment Double-Entry, Status Updates & WhatsApp Sharing

## Issues Identified

### 1. Payment Double-Entry Bug
The "Receive Payment" button always auto-fills the **full invoice total**, even if partial/full payment already exists. Clicking it again creates a duplicate payment, double-debiting the customer balance. Fix: calculate remaining balance and pre-fill that instead. Also disable the payment button on already-paid invoices.

### 2. Status Not Updating After Payment
The DB trigger `handle_payment_invoice_status` recalculates invoice status (paid/partial/dispatched) after payment insert. However, the UI `load()` function reads status from `sales_invoices` but the proforma page maps statuses inconsistently. Fix: ensure the reload correctly reflects "paid" status after payment.

### 3. WhatsApp Not Working Properly
Current `wa.me` links work but feel generic. Fix:
- Use `https://web.whatsapp.com/send?phone=...` as primary (falls back to app if installed)
- If no phone number, open WhatsApp contact picker via `https://wa.me/?text=...`
- Add branded, emoji-rich message with company name, invoice details, item list, and total
- Include a professional closing line

## Technical Changes

### `src/pages/ProformaInvoices.tsx`
1. **Payment amount**: Fetch existing payments for this customer and calculate remaining balance for the specific invoice. Pre-fill remaining amount (not full total). If fully paid, hide/disable the payment button.
2. **WhatsApp**: Rewrite `shareWhatsApp()` with branded emoji message format:
   ```
   📋 *SALES INVOICE #SI-0042*
   🏢 DocPharmas Pvt Ltd
   ━━━━━━━━━━━━━━━━━
   👤 Customer: ABC Pharmacy
   📅 Date: 2026-03-09
   
   📦 Items:
   1. Panadol × 100 @ PKR 25
   2. Brufen × 50 @ PKR 40
   
   💰 *Total: PKR 4,500*
   
   Thank you for your business! 🙏
   ```
3. **Status badge**: After payment, ensure "paid" status shows correctly in the table row.
4. **Disable payment button** on paid invoices.

### `src/pages/PurchaseProforma.tsx`
1. Same payment remaining-balance logic for supplier payments.
2. Same branded WhatsApp message format for purchase orders.
3. Disable "Make Payment" on fully paid orders.

## Files to Edit
| File | Changes |
|------|---------|
| `src/pages/ProformaInvoices.tsx` | Fix payment pre-fill to remaining balance, branded WhatsApp, disable on paid |
| `src/pages/PurchaseProforma.tsx` | Same fixes mirrored for purchase side |

