# Warranty Note — Standalone Module Redesign

Make Warranty Note a fully independent document: own settings, own data sources, own template, own PDF — no shared layout with Sales Invoice.

---

## 1. Database changes

### `customers` — add missing warranty fields
- `warranty_address` (text, multi-line)
- `license_number` (text)
- `license_expiry` (date)
- `ntn` (text)
- `cnic` (text)

Keep existing `customer_licenses` untouched; warranty pulls from `customers.*` first, falls back to latest active row in `customer_licenses` if blank.

### `sales_agents` — add rep/warranty fields
- `father_name` (text)
- `cnic` (text)
- `agent_license_number` (text)
- `agent_license_expiry` (date)
- `signature_url` (text — Storage path)

### `staff` (or `profiles`) — current-user fallback
Same five fields as above so a logged-in user without a `sales_agents` row can still sign.

Resolution order at warranty creation: selected `sales_agents` row → current user's `staff/profile` → blanks.

### `company_settings` — stamp & signature
- `warranty_stamp_url` (text)
- `warranty_signature_url` (text — optional company-wide default)
- `warranty_declaration_text` (text — overrides default in `src/lib/warranty-declaration.ts`)
- `warranty_footer_text` (text)

### `warranty_invoices` — snapshot fields
Snapshot at issue time so historical notes don't change if master data is edited:
- `sales_rep_name`, `sales_rep_father_name`, `sales_rep_cnic`
- `agent_license_number`, `agent_license_expiry`
- `signature_url`, `stamp_url`
- `customer_warranty_address`, `customer_license_number`, `customer_license_expiry`, `customer_ntn`, `customer_cnic`, `customer_mobile`

### Storage
New private bucket `warranty-assets` with RLS scoped by `tenant_id` for: company stamps, company signatures, agent signatures.

---

## 2. Settings UI

### Settings → Company → Warranty Documents (new sub-section)
- Upload Company Stamp (image)
- Upload Default Signature (image, optional)

### Settings → Documents → Warranty Note (new tab)
- Editable Warranty Declaration text (with `{{placeholders}}` reference panel)
- Editable Footer text
- Live preview using sample data

### Settings → Sales Agents → Agent Profile (extend existing dialog)
- Father Name, CNIC, Agent License #, Agent License Expiry, Signature upload

### Settings → Team Members / My Profile
- Same five fields for current-user fallback

### Customers → Profile dialog (extend)
- Warranty Address (textarea), License #, License Expiry, NTN, CNIC

---

## 3. Warranty Note Page (`src/pages/WarrantyInvoices.tsx`)
- Create dialog: pick customer → auto-fill warranty/license fields (editable); pick sales rep (default = current user agent) → auto-fill rep block
- Line items already exist (TP = MRP × 0.85 logic preserved)
- On save: snapshot rep + customer + stamp/signature URLs into the warranty row

---

## 4. PDF / Print Template — brand-new

New file: `src/lib/warranty-note-pdf.ts` (or React component for `PdfPreviewDialog`) — does NOT reuse sales invoice template.

### Layout (A4 portrait)
```text
┌──────────────────────────────────────────────────────┐
│ [LOGO 200px]              Company Name (right-align) │
│                           Address                    │
│                           City                       │
│                           Mobile                     │
├──────────────────────────────────────────────────────┤
│ WARRANTY NOTE  (22px bold, left)                     │
├──────────────────────────────────────────────────────┤
│ Mobile: …               │ Warranty Note #: …         │
│ Warranty Address: …     │ Date: …                    │
│   (multi-line, no clip) │ Due Date: …                │
│ License #: …            │ Created By: …              │
│ License Expiry: …       │ Sales Rep: …               │
│ NTN: … | CNIC: …        │                            │
├──────────────────────────────────────────────────────┤
│ Sr│ Product │ Desc │ Qty │ Rate │ Batch │ Exp │ Disc │ Amount │ MRP Inc Tax │
│  1│ …       │ …    │  10 │ 100  │ B-12  │ … │  5%  │ 950    │ 117         │
│  …                                                    │
├──────────────────────────────────────────────────────┤
│                                Total: Rs. 12,345.00  │
├──────────────────────────────────────────────────────┤
│ Note                                                 │
│ It is certified that I {{sales_rep_name}} D/O …      │
│ (full declaration, 2 numbered clauses + trailer)     │
├──────────────────────────────────────────────────────┤
│ Total in Words: …                                    │
│ Inv Balance in Words: …                              │
├──────────────────────────────────────────────────────┤
│ [STAMP]                              [SIGNATURE]     │
│ Company Stamp                        Sales Rep       │
│                                      Prepared By     │
├──────────────────────────────────────────────────────┤
│ This is a system generated invoice and does not …    │
│                                          Page 1 of N │
└──────────────────────────────────────────────────────┘
```

### PDF rules enforced
- A4 portrait, 15mm margins
- Multi-page auto-flow with repeating header + table header
- Long product descriptions wrap (no truncate)
- Right-align amounts, center qty/batch
- No content overlaps signature block (signature pins to last page bottom-right)

---

## 5. Files touched

**Migrations (1)**
- Add columns to `customers`, `sales_agents`, `staff`, `company_settings`, `warranty_invoices`; create `warranty-assets` bucket + RLS

**New files**
- `src/lib/warranty-note-pdf.ts` — standalone PDF generator
- `src/components/WarrantyNoteTemplate.tsx` — on-screen + print template
- `src/components/settings/WarrantyDocumentSettings.tsx`
- `src/components/settings/WarrantyNoteTemplateSettings.tsx`
- `src/components/settings/SalesRepProfileFields.tsx`

**Edited**
- `src/pages/Settings.tsx` — wire new tabs/sections
- `src/pages/WarrantyInvoices.tsx` — create flow snapshot + new PDF preview
- `src/components/PdfPreviewDialog.tsx` — route warranty docs to new template
- `src/components/CustomerProfileDialog.tsx` — add warranty fields
- `src/pages/SalesAgents.tsx` — add rep/license/signature fields
- `src/lib/warranty-declaration.ts` — read override from `company_settings`

---

## 6. Acceptance checklist
- Warranty Note renders with own template (no sales-invoice CSS reuse)
- Warranty Declaration block always present, editable via settings
- Customer Mobile, Warranty Address, License #, License Expiry, NTN, CNIC visible
- Stamp + Signature uploads work; auto-pulled into PDF
- Sales Rep details auto-fill from agent → user fallback
- Total in Words + Inv Balance in Words present
- Preview == Print == PDF (A4, no clipping, no overflow)
- Long descriptions wrap cleanly across pages
