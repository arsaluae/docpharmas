## Scope

Rework Sales + Purchase around a clean quotation→invoice→delivery flow, replace the brand with MOUJ Pharmaceuticals, restrict cities to a Pakistan dropdown, drop `credit_days`, and ship one fast, unified PDF template used by every document.

---

## 1. Brand: MOUJ logo

- Copy uploaded logo to `src/assets/mouj-logo.png` and import it where the brand mark is needed (sidebar header, Auth screen, PDF templates).
- Replace the text-only "Mouj Pharmaceuticals" in `AppSidebar.tsx` and `Auth.tsx` with `logo + "Mouj Pharmaceuticals"`.
- `index.html`: set favicon to the new logo, keep page title.

## 2. Customers — drop credit_days, city dropdown

- DB migration: `ALTER TABLE customers DROP COLUMN credit_days;` (keep `credit_limit` per your answer).
- Same for `suppliers` if it has the field (check `payment_terms_days` on `suppliers`/`printers` and leave those untouched — only `customers.credit_days` is being removed).
- New `src/lib/pakistan-cities.ts` exporting ~150 cities (Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Hyderabad, Peshawar, Quetta, Sialkot, Gujranwala, Sargodha, Bahawalpur, Sukkur, Larkana, Mardan, Mirpur Khas, Sheikhupura, Jhang, Dera Ghazi Khan, Gujrat, Sahiwal, Wah, Kasur, Okara, Chiniot, Kamoke, Hafizabad, Sadiqabad, Khanewal, Burewala, Jacobabad, Muzaffargarh, Khanpur, Gojra, Bahawalnagar, Abbottabad, Muridke, Pakpattan, Jaranwala, Chishtian, Daska, Mandi Bahauddin, Ahmadpur East, Kamalia, Khuzdar, Vehari, Nowshera, Dera Ismail Khan, Mingora, Kohat, Charsadda, Swabi, Mansehra, Haripur, Attock, Chakwal, Jhelum, Bhakkar, Mianwali, Layyah, Rajanpur, Kot Addu, Lodhran, Toba Tek Singh, Narowal, Ferozewala, Wazirabad, Hasilpur, Arifwala, Tando Adam, Tando Allahyar, Mehrabpur, Shikarpur, Khairpur, Nawabshah, Dadu, Thatta, Badin, Mithi, Umerkot, Gwadar, Turbat, Chaman, Sibi, Loralai, Zhob, Pasni, Khuzdar, Hub, Gilgit, Skardu, Chitral, Gilgit-Baltistan capitals, AJK cities, etc. — full ~150 list).
- `Customers.tsx`, `CustomerProfileDialog.tsx`, `Suppliers.tsx`: replace city `<Input>` with searchable `<SearchableSelect>` bound to that list. Remove credit_days input + table column.

## 3. Sales: Quotation (Draft) → Accept → Invoice + Delivery Note

Reuses existing `proforma_invoices` table (acts as the quotation/sales-invoice doc).

**Quotation phase** (`status = 'draft'`):
- Form already exists. Strip out batch fields. Show only Product, Qty, Rate, Disc. No ledger, no stock movement. Label as "Quotation" in UI when status=draft.

**Accept → Invoice** (single modal, single click):
- New component `src/components/AcceptQuotationDialog.tsx`.
- Lists every line with a `<Select>` of available batches built from `stock_movements` grouped by `batch_number` (FEFO via existing `src/lib/batches.ts`). Confirm button disabled until every line has a batch with sufficient qty.
- On Confirm (atomic):
  1. Update `proforma_invoices.status = 'dispatched'` + stamp `accepted_at`.
  2. Insert `stock_movements` rows (`movement_type='sale'`) per line with the chosen batch/expiry → trigger reduces `products.stock_quantity` and `handle_sales_invoice_balance` style code (already inside the existing submit path) increases customer balance via `proforma_invoices` total.
  3. Insert a `delivery_notes` row: `reference_type='sales'`, `reference_id=proforma.id`, `items=[{product_name, batch_number, expiry_date, quantity}]` (no pricing).
- The existing `handleSubmit` path in `ProformaInvoices.tsx` is refactored to call this modal instead of silently posting.

**Schema additions** (migration):
- `proforma_invoices.accepted_at timestamptz null`
- `delivery_notes` already exists and supports this shape.

## 4. Purchase: PO (Draft) → Confirm/Receive → Bill + Delivery Note

- `purchase_proformas` stays the draft "Purchase Order/Quotation". Strip batch fields from the draft.
- New `src/components/ConfirmPurchaseDialog.tsx` (parallels Sales):
  - Per line: Batch No, Expiry, Qty Received (defaults to ordered).
  - On Confirm (atomic):
    1. Insert `goods_received_notes` + `grn_items` (batch/expiry captured here — matches existing `grn_items` schema).
    2. Insert `purchase_invoices` (bill) linked to `grn_id` → existing trigger updates supplier balance.
    3. Insert `stock_movements` (`movement_type='purchase_in'`) per line.
    4. Insert a `delivery_notes` row with `reference_type='purchase'`, supplier-side, items only.
    5. Update `purchase_proformas.status = 'confirmed'`, `converted_po_id = bill.id`.

## 5. Unified, fast PDF template

- Rewrite `src/lib/pdf-generator.ts` as a single template `renderDocument({ kind, brand, party, meta, items, totals })` that handles 4 kinds: `quotation`, `sales_invoice`, `purchase_order`, `purchase_invoice`, `delivery_note`.
- Delivery Note kind renders only: SR, Product, Batch No, Expiry, Qty, Customer/Supplier block, no prices/totals.
- All other kinds: full pricing table.
- Single inline `<style>` block, no external fonts, no images other than the embedded MOUJ logo (base64 in a constant) → first paint <100 ms.
- Replace existing `PdfPreviewDialog` usage paths in `ProformaInvoices.tsx`, `PurchaseProforma.tsx`, `DeliveryNotes.tsx`, `WarrantyInvoices.tsx`, `SalesReturns.tsx`, `PurchaseReturns.tsx` to call the new generator. Open in same `PdfPreviewDialog` (already a single-window full-screen dialog).
- Print button uses `iframe.contentWindow.print()` (no new tab churn) for instant print.

## 6. Security / sync

- Run `supabase--linter` after the migration and address anything it flags on the touched tables.
- Confirm all touched tables (`proforma_invoices`, `purchase_proformas`, `delivery_notes`, `goods_received_notes`, `grn_items`, `purchase_invoices`, `stock_movements`, `customers`) already carry tenant-scoped RLS via `tenant_id = get_user_tenant_id()` — they do (verified). No new policies needed; new columns inherit RLS.
- Regenerate types automatically post-migration.

---

## Files

**New**
- `src/assets/mouj-logo.png` (copied from upload)
- `src/lib/pakistan-cities.ts`
- `src/components/AcceptQuotationDialog.tsx`
- `src/components/ConfirmPurchaseDialog.tsx`

**Edited**
- `src/components/AppSidebar.tsx`, `src/pages/Auth.tsx`, `index.html` (logo)
- `src/pages/Customers.tsx`, `src/pages/Suppliers.tsx`, `src/components/CustomerProfileDialog.tsx`, `src/components/SupplierProfileDialog.tsx` (city dropdown, drop credit_days)
- `src/pages/ProformaInvoices.tsx` (quotation/draft mode, wire AcceptQuotationDialog)
- `src/pages/PurchaseProforma.tsx` (wire ConfirmPurchaseDialog)
- `src/pages/DeliveryNotes.tsx` (use new template)
- `src/lib/pdf-generator.ts` (full rewrite, single fast template)
- `src/components/PdfPreviewDialog.tsx` (iframe-print fast path)

**DB migration**
- Drop `customers.credit_days`
- Add `proforma_invoices.accepted_at timestamptz`
- (No RLS changes needed.)

---

## Out of scope
- Touching `payment_terms_days` on suppliers/printers.
- Changing existing ledger triggers — they already do what we need.
- Warranty invoice flow (already correct per prior turn).
