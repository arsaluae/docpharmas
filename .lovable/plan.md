

# Fix: Sales Order "Failed to generate number" Error

## Root Cause
Two document type strings in the frontend code don't match the `document_counters` table values:

| File | Code uses | DB has |
|------|-----------|--------|
| `ProformaInvoices.tsx` line 298 | `"proforma_invoice"` | `"proforma"` |
| `PurchaseProforma.tsx` line 631 | `"goods_received_note"` | `"grn"` |

The `generate_document_number` function raises an exception when it can't find the document type, causing the "Failed to generate number" error.

## Fix (2 one-line changes)

**File: `src/pages/ProformaInvoices.tsx` (line 298)**
Change `p_document_type: "proforma_invoice"` to `p_document_type: "proforma"`

**File: `src/pages/PurchaseProforma.tsx` (line 631)**
Change `p_document_type: "goods_received_note"` to `p_document_type: "grn"`

No database changes needed. All other document type strings (`sales_invoice`, `purchase_proforma`, `purchase_order`, `purchase_invoice`, `delivery_note`, `payment`, `expense`, `warranty_invoice`, `credit_note`, `salary`, `supplier`, `customer`, `product`) are already correct.

