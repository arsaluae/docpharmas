# Warranty Note — Stamp, Signature & Customization

## Goal
Make the Warranty Note printable the "right way": one **Company Authorized Signature** with the **Company Stamp behind it** on the right side of the footer, plus a fully editable **declaration paragraph** with tokens. Page is **always A4**.

## What you'll do as a user (final flow)
1. **Settings → Company → Document Assets**
   - Upload **Company Stamp** (PNG, transparent preferred, ≤5MB) — preview / replace / remove.
   - Upload **Company Authorized Signature** (PNG, transparent preferred, ≤5MB) — preview / replace / remove.
2. **Settings → Documents → Warranty Note**
   - Edit the **Declaration text** in a textarea, with a token helper panel listing: `{{sales_rep_name}}`, `{{father_name}}`, `{{relation}}`, `{{sales_rep_cnic}}`, `{{agent_license_number}}`, `{{agent_license_expiry}}`, `{{company_name}}`.
   - Live preview shows tokens resolved against a sample row.
   - Toggles: show stamp, show signature, show license #, show CNIC, show footer note.
3. **Sales Hub → Warranty Note → Print/PDF**
   - Always renders A4.
   - Right-side footer block: signature image on top of stamp image (stamp ~140px, signature ~120px, slightly offset so both read), with "Authorized Signature — {{company_name}}" label below.
   - Left side stays "Prepared By: {{sales_rep_name}}" (text only, no image).

## Changes

### 1. Data (already exists, just confirming usage)
`company_settings` already has:
- `warranty_stamp_url`, `warranty_signature_url` — repurpose as **company** stamp/signature for the warranty footer.
- `warranty_note_text` — declaration template.
- `warranty_show_company_stamp`, `warranty_show_rep_signature` — visibility toggles.

No schema changes needed. (If you'd prefer a separate `company_stamp_url` field used across all docs, say so and I'll add a migration.)

### 2. Settings UI (`src/pages/Settings.tsx`)
- **Company tab → Document Assets card**: Two uploaders (Stamp, Authorized Signature) with preview, replace, remove. Validation: PNG/JPG, 5MB max. Save to `warranty_stamp_url` / `warranty_signature_url`.
- **Documents tab → Warranty Note card**:
  - Textarea for `warranty_note_text` (declaration).
  - Token chips (click to insert at cursor).
  - Live A4 preview pane rendering the note with sample data.
  - Toggles for `warranty_show_company_stamp`, `warranty_show_rep_signature`, license #, CNIC, footer note.

### 3. PDF renderer (`src/lib/pdf-generator.ts`)
- Force `data-page-mode="full"` (A4) for the Warranty template — never A5.
- Footer right block, stacked overlay:
  ```text
  ┌──────────────────────────────┐
  │           [STAMP img]        │  ← absolute, opacity 0.95, z-index 1
  │       [SIGNATURE img]        │  ← absolute, offset -20px, z-index 2
  │  ─────────────────────────   │
  │   Authorized Signature        │
  │   {{company_name}}            │
  └──────────────────────────────┘
  ```
  CSS: `position:relative; width:240px; height:140px;` container; stamp `position:absolute; right:0; bottom:30px; max-height:120px;`; signature `position:absolute; right:30px; bottom:50px; max-height:90px;`.
- Render declaration through existing `renderWarrantyDeclaration()` (already token-aware).
- Honor visibility toggles before emitting `<img>` tags.

### 4. PdfPreviewDialog
- No changes needed — warranty note already routes to A4 path. Just ensure the A5 auto-route doesn't catch it (gate on doc kind, not item count).

## Acceptance
- ✓ Upload stamp + signature in Settings → preview visible.
- ✓ Edit declaration text with tokens → live preview resolves them.
- ✓ Generated Warranty Note PDF shows stamp+signature overlaid on the right footer.
- ✓ Toggles hide/show stamp, signature, license, CNIC.
- ✓ Always A4, no stretching/cropping of stamp or signature.

## Out of scope
- Per-sales-rep signature library (you chose company-only).
- Stamp/signature on other doc types (sales invoice, delivery note) — say the word and I'll extend.
