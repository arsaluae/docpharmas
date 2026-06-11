## Goal

Roll back the recent premium/WhatsApp redesign of document templates and restore the **original classic layout** (left logo, right company details, centered title, left doc info, right customer card, product table, bottom-right totals, amount-in-words, footer). Then apply a **light visual polish only** — bigger logo, bigger fonts, customer phone, cleaner spacing — without changing the structure.

All work happens in `src/lib/pdf-generator.ts`. Callers are not touched.

---

## 1. `src/lib/pdf-generator.ts` — restore classic layout

Replace the current A4 renderer with the original layout but tuned to the new font/size spec:

**Header (unchanged structure)**
- Two-column row: logo left, company block right.
- Logo: `max-height: 110px; max-width: 220px` (was ~80px → larger, but not the 200px hero size from the redesign).
- Company name: **22px bold**, tagline 12px italic, then address / phone / email / NTN-STRN in 12px.

**Document title bar**
- Centered title **24px bold uppercase**, thin underline accent.
- Doc number + date shown directly under, 13px muted.

**Two-column meta row**
- Left: "Document Info" plain list — Doc#, Date, Sales Agent, Validity, Payment Terms, Delivery Status. Label/value rows at **15px**.
- Right: "Bill To" / "Ship To" card with thin border and subtle header. Inside:
  - Customer name **18px bold**
  - Mobile / Phone **14px** (📞 prefix; render even when only one is set; never hidden)
  - City · Area **14px**
  - Full address **14px**
  - Optional code / NTN / license / CNIC **12px** muted
- Card sizing kept similar to original (no thick coloured left bar, no dark hero).

**Items table**
- Same column set as before (driven by template).
- Header row: **14px**, uppercase, semi-bold, light grey background (`#f1f2f4`), 1px bottom border.
- Body rows: **15px**, row padding `10px 8px`, zebra (`#fafbfc`), `border-bottom: 1px solid #e6e8eb`.
- Product Name column: `width:auto; white-space:normal; word-break:break-word` so names wrap and never truncate.
- Numeric columns: right-aligned, `font-variant-numeric: tabular-nums`.

**Totals box (bottom-right, original position)**
- Width ~320px, right-aligned, 1px border, no gradient.
- Rows (Subtotal/Discount/Tax/Previous Balance): 14px label / 15px value.
- Grand Total row: separator above, label uppercase 13px, **amount 24px bold**, `PKR` prefix kept visible, tabular-nums.

**Amount in words**
- Directly under totals, full-width, **15px italic**, label "Amount in words:" 13px muted.

**Footer**
- Signature labels row (same as before), bank details line, optional notes/certification.
- Sales agent name + mobile printed as a small left-side line above signatures.

**Spacing/print**
- `@page { size:A4; margin:12mm 12mm }`
- Page frame padding tightened to reduce empty space (`24px 28px`).
- `thead { display: table-header-group }`; `tr { page-break-inside: avoid }`.

## 2. Remove WhatsApp template

- Delete `generateWhatsAppHtml` body and its branding/styles.
- Keep the export name for backward compatibility but have it return the same polished A4 HTML (so existing imports keep compiling).
- Change `generateDocumentViews(opts)` to return a single-view array: `[{ key:"a4", label:"A4 Print", color:"bg-foreground text-background border-foreground", html: generatePdfHtml(opts) }]`. With one view, `PdfPreviewDialog` automatically hides the switcher pills.

## 3. Callers — no logic changes

`ProformaInvoices.tsx`, `DeliveryNotes.tsx`, `PurchaseProforma.tsx`, `WarrantyInvoices.tsx`, `PrintJobs.tsx` continue to call `generateDocumentViews(opts)` and pass `views` to `PdfPreviewDialog`. Because there's only one view now, the user sees the polished classic A4 directly with no pill switcher and no WhatsApp tab.

The WhatsApp side-by-side build inside `ProformaInvoices.tsx` (lines 465–467) that pulls the `whatsapp` view will be repointed to the single A4 view (`.find(v => v.key === "a4")`) so combined SO+SI+DN previews still work.

## Out of scope

- Database / schema changes.
- Renaming any `PdfOptions` fields (all current optional fields remain; unused ones simply don't render).
- Editing `PdfPreviewDialog.tsx`.
- Any new mobile-only template (explicitly rejected this round).

## Acceptance

- Layout matches the original: logo top-left, company top-right, title centered, doc info left, customer card right, table, bottom-right total box, amount-in-words, footer.
- Logo visibly larger than the pre-redesign version (110px tall) but not the dark-band hero from the redesign.
- Fonts match the requested sizes (company 22, title 24, customer 18, details 14, doc info 15, table header 14, table rows 15, total 24, words 15).
- Customer mobile/phone, city, area, and full address always visible.
- Product names wrap fully.
- Grand total prominent with `PKR` and 24px bold number.
- Prints cleanly on A4; preview shows a single template (no WhatsApp pill).
