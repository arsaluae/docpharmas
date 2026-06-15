# Warranty Invoice Module — Full Rebuild

Rebuild the Warranty Invoice end-to-end. Old hardcoded template, declaration text, and PDF pattern are removed completely. One new shared `WarrantyInvoiceTemplate` powers preview, print, and PDF.

---

## 1. Remove the old template (clean cut)

Delete / strip:
- `src/lib/warranty-declaration.ts` — hardcoded "It is certified..." text, token renderer.
- Warranty HTML generator inside `src/lib/pdf-generator.ts` (old fixed layout + declaration block).
- Warranty fields in `useCompanySettings` related to the old declaration: `warranty_note_text`, `warranty_declaration_enabled`, `warranty_require_*`, `warranty_show_*`, `warranty_footer_text`, plus the old "Warranty Note" entry in `useDocumentTemplates` defaults.
- Old preview path in `WarrantyInvoices.tsx` that calls `PdfPreviewDialog` with the legacy HTML.
- Any duplicate warranty template helpers in `whatsapp-share.ts`.

DB: keep existing `warranty_invoices` rows; drop only the now-unused declaration columns in a follow-up (non-destructive — keep data columns).

---

## 2. New configurable template (Settings → Documents → Warranty Invoice)

New tab UI driven by row in `document_templates` where `document_type = 'warranty_invoice'`:

Header toggles: show logo, show company name, address, phone, email.
Signature/Stamp: upload, preview, replace, remove. PNG/JPG/JPEG, transparent PNG preferred. Stored in Storage bucket `document-assets`, URLs saved to `company_settings.warranty_signature_url` / `warranty_stamp_url`.
Notes editor: TipTap rich-text (bold, underline, italic, lists, alignment, line breaks, variable inserter). Saved as sanitized HTML in `document_templates.notes_template_html`.
Footer: text editor, show page number toggle, show "system generated" toggle.

Supported variables (rendered at print time):
`{{company_name}} {{distributor_name}} {{distributor_mobile}} {{distributor_address}} {{license_number}} {{license_expiry}} {{ntn}} {{cnic}} {{warranty_invoice_number}} {{date}} {{due_date}} {{created_by}} {{sales_rep_name}}`

---

## 3. Create / edit form

Existing `WarrantyInvoices.tsx` flow kept, but the form now also includes:
- Per-invoice rich-text notes editor (defaults to template HTML on new invoice; saved to `warranty_invoices.notes_html`).
- Toggles: show stamp, show signature (defaults from template).
- Optional per-invoice signature override (admin only).

Distributor auto-fetch pulls: `business_name`, `customer_code`, `mobile`, `phone`, `city`, `area`, `address`, `warranty_address` (preferred if set), `license_number`, `license_expiry`, `ntn`, `cnic`.

---

## 4. New shared template + print route

New component: `src/components/warranty/WarrantyInvoiceTemplate.tsx` — single source of truth for preview, print, PDF.

New route: `/print-preview/warranty-invoice/:id` — bare page (no sidebar, no topbar, no chrome). Renders only `WarrantyInvoiceTemplate` on a styled A4 sheet.

Buttons in `WarrantyInvoices.tsx`:
- **Preview** → opens route in new tab.
- **Print** → opens route + `window.print()` on load.
- **Download PDF** → opens route + auto-trigger html2pdf in the iframe-free page.

A4 portrait, print CSS, page-break-inside avoidance on table rows, signature/footer kept off table edges.

---

## 5. Rich-text rendering & sanitization

- Library: `@tiptap/react` + extensions Bold, Italic, Underline, BulletList, OrderedList, TextAlign, HardBreak.
- Sanitize on save with `dompurify` (allow `p, br, strong, em, u, ol, ul, li, span[style], div[style]`; block scripts/iframes/event handlers).
- Variables substituted at render time, not at save time.

---

## 6. Database

Migration adds:
- `warranty_invoices.notes_html text`, `show_signature boolean default true`, `show_stamp boolean default true`, `signature_url text null`, `stamp_url text null`, `total_in_words text null` (only the columns that don't already exist).
- `document_templates`: ensure a row exists with `document_type='warranty_invoice'`. Extend the type to carry `notes_template_html`, `footer_text`, `show_logo`, `show_company_details`, `show_signature`, `show_stamp`, `show_page_number` (as JSON in existing extensible columns or new columns — added cleanly).
- Storage bucket `document-assets` (private) + RLS so tenant members can read/write their own assets.

Old declaration columns on `company_settings` left in place for now (data preservation); UI references removed.

---

## 7. Security

- Only owner/admin role can edit the global warranty template settings & upload signature/stamp.
- Sales role can create warranty invoices but cannot edit template.
- All HTML sanitized server-trip-safe via DOMPurify before persist + before render.

---

## 8. Files touched (high level)

Create: `src/components/warranty/WarrantyInvoiceTemplate.tsx`, `src/components/warranty/NotesEditor.tsx`, `src/components/settings/WarrantyTemplateTab.tsx`, `src/pages/PrintWarrantyInvoice.tsx`, `src/lib/warranty-variables.ts`, `src/lib/sanitize-html.ts`.
Edit: `src/App.tsx` (route), `src/pages/WarrantyInvoices.tsx` (notes editor + new buttons), `src/pages/Settings.tsx` (new tab), `src/hooks/useCompanySettings.tsx` (drop old fields from type), `src/lib/pdf-generator.ts` (remove warranty path).
Delete: `src/lib/warranty-declaration.ts`.
Migration: schema additions + storage bucket + policies.
Deps: `@tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-text-align dompurify html2pdf.js` (html2pdf already present).

---

## 9. Acceptance / test pass

Run through Part 9 checklist on a live invoice: create with a real distributor, verify auto-fetch, write bold+underline notes, upload signature & stamp in settings, preview → print → download PDF, confirm all three render identically with no legacy text and no clipped content across page breaks.

---

## Open questions before I build

1. **Storage**: confirm I should create a private `document-assets` bucket for signatures/stamps (vs. reusing an existing one). Default = yes.
2. **Old declaration data**: any existing warranty invoices currently render via the old token-replaced declaration. After cutover their saved `notes_html` will be empty, so they fall back to the new template's default notes. OK to leave historical invoices showing the new template instead of their original text? (Alternative: backfill `notes_html` from the rendered legacy declaration during migration — safer.)
3. **TipTap dependency** is ~120 KB gz. OK to add, or prefer a lighter editor (e.g. Lexical / a minimal contenteditable wrapper)?

Reply with answers (or "go with defaults") and I'll execute the build in one pass.