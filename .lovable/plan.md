## What's still wrong
The logo in the preview is rendering tiny (~40px tall) even though we set `height:84px`. Root cause: the logo image is being scaled by the browser's default `width:auto` calculation against a wide-aspect SVG, and `align-items:center` on the flex row leaves it floating mid-air against a much taller right-side text block. The company block is also too large, so it dwarfs the logo no matter what.

## Fix — single file: `src/lib/pdf-generator.ts`

### A. Force the logo to a real, prominent size
Inline style on the `<img>` (line 190):
- Use `height:110px !important; width:auto !important; max-width:320px !important; object-fit:contain; display:block;`
- Drop `max-height` (it was redundant and confused the browser when paired with explicit `height`).
- Add `!important` so the half-page CSS doesn't compete.

### B. Align top, not center — and shrink the company block so the two balance
`.doc-header` (line 381):
- `align-items: flex-start` so the logo sits flush with the company name baseline at the top.
- `gap: 32px`.

Company name (line 201): reduce from 22px → 19px so it doesn't tower over the logo.
Address/phone/email lines (line 203): keep at 12.5px but reduce `line-height` to 1.45.

### C. Half-page override matches
`HALF_PAGE_CSS` `.page-frame img` (line 453):
- `max-height: 90px !important; max-width: 240px !important; height: 90px !important;` so the Delivery Note logo is also prominent.

### D. Warranty template (line 620)
Match: `height:110px;width:auto;max-width:320px;object-fit:contain;display:block;`

## Out of scope
- Customer card, table, totals — all already redesigned.
- `PdfPreviewDialog.tsx` — no change needed.

## QA
- Reopen Sales Invoice preview → logo is ~110px tall, top-aligned with "Mouj Pharmaceuticals". No big white gap.
- Save as PDF → same prominence preserved.
- Delivery Note (half-A4) → logo ~90px, still readable.
- No text missing (address, phone, email all render — they already do).
