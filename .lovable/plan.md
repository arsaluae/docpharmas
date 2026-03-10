

# WhatsApp Message Templates + Payment Info + PDF Sharing

## What's Changing

### 1. Distinct WhatsApp Message Templates
Currently, all WhatsApp shares use the same invoice-style message. We'll create **4 separate message formats**:

- **Sales Invoice** — itemized list with amounts, payment instructions, bank details
- **Payment Receipt** — confirmation of payment received/made, amount, method, reference
- **Delivery Note** — items shipped with batch/expiry, no prices
- **Warranty Invoice** — warranty-specific format with MRP/TP details

### 2. Payment Info in WhatsApp Messages
Invoice messages will include bank account details and payment instructions from company settings (e.g. "Meezan Bank: 09020102207667"). Payment receipt messages will confirm amount, method, and balance remaining.

### 3. Shareable PDF Link
We'll create a backend function that stores the PDF HTML in file storage and returns a public URL. The WhatsApp message will include this link so the recipient can view the document in their browser.

## Technical Plan

### New Edge Function: `share-document`
- Accepts HTML content + document reference
- Stores in a public storage bucket (`shared-documents`)
- Returns a public URL (auto-expires after 30 days via lifecycle policy)
- URL format: `https://<project>.supabase.co/storage/v1/object/public/shared-documents/<uuid>.html`

### DB Change
- Create storage bucket `shared-documents` (public, 30-day expiry)

### New Utility: `src/lib/whatsapp-share.ts`
Centralized WhatsApp message builder with typed templates:

```typescript
type DocType = "sales_invoice" | "payment_receipt" | "delivery_note" | "warranty_invoice";

function buildWhatsAppMessage(type: DocType, data: MessageData): string
function openWhatsApp(phone: string, message: string): void
```

**Message formats:**

**Sales Invoice:**
```
📋 *SALES INVOICE #INV-001*
🏢 Mouj Pharmaceuticals
━━━━━━━━━━━━━━━━━
👤 Customer: ABC Pharmacy
📅 Date: 10 Mar 2026

📦 Items:
1. Paracetamol × 100 @ PKR 5,000
2. Amoxicillin × 50 @ PKR 8,000

💰 *Total: PKR 13,000*

🏦 *Payment Details:*
Meezan Bank: 09020102207667
(Mouj Pharmaceuticals)

📄 View Document: [link]

Thank you for your business! 🙏
```

**Payment Receipt:**
```
✅ *PAYMENT RECEIPT #PAY-001*
🏢 Mouj Pharmaceuticals
━━━━━━━━━━━━━━━━━
👤 Party: ABC Pharmacy
📅 Date: 10 Mar 2026
💳 Method: Bank Transfer
🏦 Account: Meezan Bank

💰 *Amount Received: PKR 13,000*
📊 Outstanding Balance: PKR 5,000

Thank you for your payment! 🙏
```

**Delivery Note:**
```
🚚 *DELIVERY NOTE #DN-001*
🏢 Mouj Pharmaceuticals
━━━━━━━━━━━━━━━━━
👤 Customer: ABC Pharmacy
📅 Date: 10 Mar 2026

📦 Items Dispatched:
1. Paracetamol | Batch: B001 | Exp: Dec 2027 | Qty: 100
2. Amoxicillin | Batch: B045 | Exp: Jun 2027 | Qty: 50

Please confirm receipt. 📋
```

**Warranty Invoice:**
```
🛡️ *WARRANTY NOTE #WN-001*
🏢 Mouj Pharmaceuticals
━━━━━━━━━━━━━━━━━
🏪 Pharmacy: XYZ Distributors
📅 Date: 10 Mar 2026

📦 Items:
1. Paracetamol | Batch: B001 | MRP: 50 | TP: 42.50 | Qty: 100

💰 *Total: PKR 4,250*

📄 View Document: [link]
```

### UI Changes

| Page | Change |
|------|--------|
| `ProformaInvoices.tsx` | Update `shareWhatsApp` to use new invoice template with bank details + PDF link |
| `PurchaseProforma.tsx` | Update `shareWhatsApp` to use purchase-specific template + PDF link |
| `Payments.tsx` | Add WhatsApp share button per payment row using payment receipt template |
| `DeliveryNotes.tsx` | Add WhatsApp share button per row using delivery note template |
| `WarrantyInvoices.tsx` | Add WhatsApp share button using warranty template + PDF link |

### Files to Create/Edit

| File | Action |
|------|--------|
| `src/lib/whatsapp-share.ts` | New — centralized message builder |
| `supabase/functions/share-document/index.ts` | New — stores HTML, returns public URL |
| DB migration | Create `shared-documents` storage bucket |
| `src/pages/ProformaInvoices.tsx` | Update WhatsApp with bank details + PDF link |
| `src/pages/PurchaseProforma.tsx` | Update WhatsApp with PDF link |
| `src/pages/Payments.tsx` | Add WhatsApp share button |
| `src/pages/DeliveryNotes.tsx` | Add WhatsApp share button |
| `src/pages/WarrantyInvoices.tsx` | Add WhatsApp share button |

