

# Sales & Purchase Invoice UX Enhancements

## User Requests Summary
1. Rename "Sales Order" to "Sales Invoice" throughout the UI
2. Show item names in the order table (currently hidden)
3. Add WhatsApp PDF sharing for invoices (customer & supplier)
4. Add "Receive Payment" quick action directly from the sales invoice row
5. Add "Make Payment" quick action from the purchase order row
6. Payment popup should auto-fill invoice amount, default to Meezan Bank, allow changing to cash/other bank

## Changes

### 1. `src/pages/ProformaInvoices.tsx` — Major Updates
- **Rename all "Sales Order" text** → "Sales Invoice" in page title, buttons, dialogs, PDF titles, WhatsApp messages, empty states, tooltips
- **Add "Items" column** to the table showing truncated product names (e.g., "Panadol, Brufen +2 more")
- **Add WhatsApp PDF share button** in action row — sends invoice link/text via WhatsApp to the customer's phone number
- **Add "Receive Payment" button** (green dollar icon) on invoiced/dispatched rows — opens a payment dialog pre-filled with:
  - Type: "received", Party: the customer
  - Amount: invoice total (editable)
  - Payment method: "bank_transfer" by default
  - Bank account: auto-select first Meezan bank account found (fallback to first bank), changeable via dropdown to cash/other
  - On save: inserts payment record, reloads, shows success

### 2. `src/pages/PurchaseProforma.tsx` — Mirror Changes
- **Add "Make Payment" button** on ordered/received rows — opens payment dialog pre-filled with:
  - Type: "made", Party: the supplier
  - Amount: order total (editable)
  - Same Meezan-default bank logic
- **Add WhatsApp share** for purchase orders to supplier's phone

### 3. `src/hooks/useDocumentTemplates.tsx`
- Rename default template title from "Sales Order" to "Sales Invoice"

### 4. `src/pages/Index.tsx`
- Rename quick action label "Sales Order" → "Sales Invoice"

## Technical Details
- Payment insertion reuses the existing `payments` table + `generate_document_number` RPC
- Bank account fetching: query `bank_accounts`, find one where `bank_name` includes "meezan" (case-insensitive), else use first
- No new DB tables or migrations needed — all data already exists
- The `handle_payment_balance` trigger automatically updates customer/supplier balances and bank balances on insert

## Files to Edit
| File | Changes |
|------|---------|
| `src/pages/ProformaInvoices.tsx` | Rename to "Sales Invoice", add items column, add receive payment dialog, add WhatsApp PDF share |
| `src/pages/PurchaseProforma.tsx` | Add make payment dialog, add WhatsApp share to supplier phone |
| `src/hooks/useDocumentTemplates.tsx` | Rename template title |
| `src/pages/Index.tsx` | Rename quick action label |

