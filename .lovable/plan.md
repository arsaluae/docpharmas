## Goal
Transform the ERP from cramped to premium enterprise-grade — bigger type, stronger spacing, fuller master screens, and polished A4 document templates — without changing existing layout or structure.

---

## Part 1 — Customer & Supplier Master screens

Files: `src/pages/Customers.tsx`, `src/pages/Suppliers.tsx`

- Expand the main list table (or stacked mobile card) to always show, no hover/extra-tab needed:
  - **Customers:** Name, Code, Mobile, Phone, City, Area, Full Address, Credit Limit, Outstanding Balance
  - **Suppliers:** Name, Code, Mobile, Phone, City, Area, Full Address, Payment Terms, Outstanding Balance
- Use a two-line cell pattern (primary value + muted secondary) so 9 fields fit without horizontal scroll on common widths.
- Bump font sizes (see Part 3) and row height; right-align numeric columns with `tabular-nums`.
- Keep filters, search, pagination, and actions exactly where they are.

---

## Part 2 — Document templates (A4)

Files: `src/components/PdfPreviewDialog.tsx`, `src/lib/pdf-generator.ts`, `src/hooks/useDocumentTemplates.tsx`, and the per-document render paths used by Sales Order, Sales Invoice, Delivery Note, Sales Return, Purchase Order, Purchase Invoice.

**Logo** — increase rendered size 200–250% (height ~40px → ~96–110px), keep position and aspect ratio.

**Typography scale (print CSS):**
| Element | Size |
|---|---|
| Company name | 22–24px |
| Document title | 20–24px |
| Section headings | 16–18px |
| Party info / metadata | 14–15px |
| Table header / rows | 14–15px |
| Amount in words | 14–15px |
| Grand Total | 24–32px bold |

**Spacing** — increase row height, cell padding, and inter-section margins; widen header/footer gutters; keep one-page A4 fit by trimming decorative chrome, not content.

**Product table columns (no truncation on Name):**
Code · Name · Batch · Expiry · Qty · Rate · Discount · Tax · Amount.
Stronger header rule, hairline row separators, right-aligned numerics, `tabular-nums`.

**Party block rules:**
- Always show: Name, Code, City, Area, Address.
- **Never** show supplier phone on printed docs.
- Customer mobile/phone hidden unless the new setting (Part 5) is enabled.

**Document info block:** Invoice/Order #, Date, Sales Agent — larger labels, clearer pairing.

**Totals block:** same position, larger amounts, bolder Grand Total with a top rule and subtle background panel (no gradients).

**Visual polish:** crisp 1px borders, consistent alignment grid, generous whitespace — no gradients, no shadows on print.

---

## Part 3 — Global ERP UI scale

File: `src/index.css` (and a few component primitives if needed: `src/components/ui/table.tsx`, `input.tsx`, `button.tsx`, `label.tsx`, `src/components/ui/sidebar.tsx`, `src/components/AppSidebar.tsx`).

- Lift base font size: `html { font-size: 16px }` and body text to 15–16px.
- Table cells: 14–15px, row height +25%, header 12.5–13px uppercase (currently 11.5px).
- Inputs: 15–16px, taller (h-10 → h-11), more horizontal padding.
- Labels: 14–15px.
- Buttons: larger default size, more padding, comfortable touch target.
- Sidebar: larger nav text, larger icons, more vertical spacing between items.
- Forms: increase row gap and section spacing.

Apply via tokens/utility classes — no per-page restyling, so existing layouts stay intact.

---

## Part 4 — New setting: Document Preferences

Files: `src/pages/Settings.tsx`, `company_settings` table (migration), `useCompanySettings.tsx`, document renderers.

- Add a "Document Preferences" card with 4 toggles (all default OFF):
  - Show customer mobile on documents
  - Show customer phone on documents
  - Show supplier mobile on documents *(forced display still suppressed for suppliers per spec — toggle hidden or marked Coming Soon; awaiting your call, see Open Question)*
  - Show supplier phone on documents *(same)*
- Migration adds 4 boolean columns to `company_settings` (default false).
- Document templates read these flags before rendering phone/mobile lines.

---

## Acceptance checklist
- Logo visibly larger on every template
- Fonts larger across screens and printed docs
- Customer/Supplier list shows all required fields without drilling in
- Product tables readable, no Name truncation
- Grand Total dominates the totals block
- Sidebar/forms/tables feel roomy at 100% zoom
- A4 single-page fit preserved
- No layout or navigation restructuring

---

## Open question
Your spec says "Do NOT show supplier phone… ever" but the settings list includes supplier mobile/phone toggles. Should I:
**(A)** include both supplier toggles as requested, or
**(B)** hard-suppress all supplier contact on prints and only ship the two customer toggles?

I'll proceed with **(A)** unless you say otherwise.
