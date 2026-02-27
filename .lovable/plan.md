

# Comprehensive Flow Restoration + PDF + Settings + Delivery Notes

This is a large set of changes. Here is the full plan:

## Summary of Requirements

1. **Restore sidebar links** — Proforma (Sales & Purchase), GRN, Purchase Proforma were removed from sidebar. Add them back.
2. **Delivery Notes** — After invoice is created (sales or purchase), a Delivery Note can be generated showing item name, batch, expiry, quantity — but NO price/total.
3. **Additional Costs (printers)** — Already exists in Purchase Proforma. The vendor (printer) is NOT a supplier — they are a separate entity. Their cost hits the printer's ledger, not the supplier's. Cost is added to the product's landed cost. This already partially works — needs the vendor to be selectable from a "vendors/printers" list separate from suppliers.
4. **FBR integration toggle** — Settings page with on/off for FBR. When off, FBR QR column and button hidden from invoices.
5. **PDF download** — All documents (proforma, invoice, delivery note, warranty invoice) downloadable as PDF with letterhead (logo, company name, address, phone, email, website).
6. **Settings page** — Company profile (logo upload, name, address, phone, email, website). FBR toggle. These settings stored in database and used across all PDFs.

## Database Changes

### New table: `company_settings`
- `id` uuid PK default gen_random_uuid()
- `company_name` text
- `address` text
- `phone` text
- `email` text
- `website` text
- `logo_url` text (stored in storage bucket)
- `fbr_enabled` boolean default false
- `ntn` text
- `strn` text
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()
- RLS: authenticated users can CRUD

### New table: `delivery_notes`
- `id` uuid PK
- `dn_number` text NOT NULL (DN-0001)
- `date` date default CURRENT_DATE
- `reference_type` text NOT NULL (sales_invoice / purchase_invoice)
- `reference_id` uuid NOT NULL
- `customer_id` uuid nullable
- `supplier_id` uuid nullable
- `items` jsonb NOT NULL default '[]' (product_name, batch_number, expiry_date, quantity — NO price)
- `notes` text nullable
- `status` text default 'issued'
- `created_at` timestamptz default now()
- RLS: authenticated users can CRUD

### Storage bucket: `company-assets`
- Public bucket for logo uploads

## Files to Create

1. **`src/pages/Settings.tsx`** — Company profile form (logo, name, address, phone, email, website, NTN, STRN) + FBR toggle switch
2. **`src/pages/DeliveryNotes.tsx`** — List and create delivery notes (generated from invoices)
3. **`src/lib/pdf-generator.ts`** — Shared PDF generation utility using browser print/HTML-to-PDF approach. Generates formatted documents with letterhead for: Sales Proforma, Sales Invoice, Purchase Proforma, Purchase Order, Delivery Note, Warranty Invoice, GRN

## Files to Modify

1. **`src/components/AppSidebar.tsx`** — Restore all sidebar links:
   - Sales: Customers, Proforma, Invoices, Warranty Invoices, Delivery Notes, Returns
   - Purchases: Suppliers, Purchase Proforma, Purchase Orders, GRN, Bills, Delivery Notes, Returns
   - Add Settings link with gear icon

2. **`src/pages/SalesInvoices.tsx`** — Add "Delivery Note" button per invoice row + "Download PDF" button. Conditionally show FBR column based on `company_settings.fbr_enabled`.

3. **`src/pages/ProformaInvoices.tsx`** — Add "Download PDF" button per row.

4. **`src/pages/PurchaseOrders.tsx`** — Add "Download PDF" button.

5. **`src/pages/PurchaseProforma.tsx`** — Add "Download PDF" button. For additional costs vendor selection, currently uses suppliers list — keep as-is since printers can be added as suppliers with a flag, or we add a note that vendor costs hit vendor's ledger not the main supplier's.

6. **`src/pages/GoodsReceivedNotes.tsx`** — Add "Download PDF" button (delivery note style, no prices).

7. **`src/pages/WarrantyInvoices.tsx`** — Add "Download PDF" button.

8. **`src/pages/PurchaseInvoicesPage.tsx`** — Add "Delivery Note" button + "Download PDF".

9. **`src/App.tsx`** — Add routes: `/settings`, `/delivery-notes`

## PDF Format (via browser print window)

All PDFs will open a print-ready HTML window with:
- **Header**: Company logo (left), Company name + address + phone + email + website (right)
- **Document title**: e.g. "SALES INVOICE" / "DELIVERY NOTE" / "PROFORMA"
- **Document meta**: Number, Date, Customer/Supplier details
- **Items table**: Columns vary by document type (Delivery Notes exclude price columns)
- **Footer**: Totals (where applicable), Notes, NTN/STRN

## Technical Approach for PDF

Use `window.open()` to create a print-ready HTML page and call `window.print()`. No external library needed. The `pdf-generator.ts` utility will:
- Accept document type, company settings, and document data
- Generate formatted HTML string
- Open in new window with print dialog

This avoids adding heavy PDF libraries and works reliably across browsers.

## Additional Costs / Printer Vendors

The current system already stores additional costs with a `vendor_id` referencing suppliers. The vendor (printer) cost should:
- Add to the product's landed cost calculation
- Show on the vendor's (printer's) ledger as a payable
- NOT affect the main supplier's ledger

This already works correctly with the `additional_costs` table. No schema change needed — just ensure the Reports/Ledger pages account for `additional_costs` when calculating vendor balances.

