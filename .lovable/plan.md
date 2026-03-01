

# Document Template System in Settings

## The Right Approach

You're absolutely right -- a proper ERP system should have configurable templates per document type. Here's what I recommend:

### Architecture: Template Profiles stored in a `document_templates` table

Each document type (Sales Invoice, Proforma, Warranty, Delivery Note, Purchase Order, GRN) gets its own template configuration row. Users can customize per document type:

- **Which columns to show** (e.g. Warranty needs Batch No, Batch Expiry, Discount; Sales Order needs MRP Inc. Tax)
- **Footer text** (e.g. Warranty has a legal certification paragraph; Sales Order shows bank details)
- **Signature labels** (e.g. "Sales Rep / Prepared By" vs "Approved By" vs "Authorized Signature")
- **Show/hide sections**: Total in Words, Bank Details line, Notes section, NTN/CNIC fields
- **Custom title override** (e.g. "Sales Order" instead of "Sales Invoice")
- **Party section fields**: which party fields to display (Mobile, License Number, Area, CNIC, etc.)

### Database

New table `document_templates` with columns:
- `id`, `document_type` (unique key like `sales_invoice`, `warranty_invoice`, `proforma`, `purchase_proforma`, `delivery_note`, `purchase_order`, `grn`)
- `title` (display title on the PDF, e.g. "Sales Order", "Warranty Note")
- `columns_config` (JSONB -- array of column definitions with header, key, align)
- `show_total_in_words` (boolean)
- `show_bank_details` (boolean)
- `bank_details_text` (text -- e.g. "Meezan Bank: 09020102207667 (Mouj Pharmaceuticals)")
- `footer_text` (text -- e.g. the warranty certification paragraph)
- `signature_labels` (JSONB -- array like ["Sales Rep", "Approved By"])
- `show_party_area` (boolean)
- `show_party_license` (boolean)
- `show_party_cnic` (boolean)
- `extra_meta_fields` (JSONB -- additional meta fields like Currency, Created By)
- `created_at`

### Settings UI

Add a new "Document Templates" tab/section in Settings page with:
- A list of document types as cards or accordion items
- Click to expand and configure: title, toggle sections on/off, edit bank details text, edit footer text, configure signature labels
- Live preview button to see how the template looks with sample data
- Each template auto-seeds with sensible defaults on first load

### PDF Generator Update

`generatePdf` will accept a `template` parameter. It reads the template config and dynamically:
- Uses the custom title
- Shows/hides Total in Words section
- Shows/hides bank details footer line
- Renders the custom footer/certification text
- Uses configured signature labels
- Adds the configured extra columns

### Files Changed

| File | Change |
|------|--------|
| New migration | Create `document_templates` table with RLS |
| `src/pages/Settings.tsx` | Add "Document Templates" section with per-type config cards |
| `src/lib/pdf-generator.ts` | Accept template config, render Total in Words, bank details, custom footer, dynamic signature labels |
| `src/hooks/useDocumentTemplates.tsx` | New hook to load templates by document type |
| All pages calling `generatePdf` | Pass the relevant template config |

### Seeded Defaults

On first load (no templates exist), auto-insert defaults matching the reference images:
- **Sales Invoice/Proforma**: Title "Sales Order", columns: SrNo, Product Name, Quantity, Rate, Amount, MRP Inc. Tax; show bank details; signatures: "Approved By"
- **Warranty Invoice**: Title "Warranty Note", columns: SrNo, Product Name, Product Description, Quantity, Rate, Batch No, Batch Expiry, Discount, Amount; show Total in Words; footer = warranty certification paragraph; signatures: "Sales Rep / Prepared By"
- **Delivery Note / GRN / Purchase**: sensible defaults

