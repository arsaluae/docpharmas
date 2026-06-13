## Issue
In the rendered PDF, the logo sits tiny in the top-left while the company name block on the right is large and visually dominant. The two are not on the same baseline — the logo floats up because of `align-items:center` against a much taller right block, and the logo itself is capped too small (`max-height:90px`, `max-width:180px`, but in practice renders much smaller because the source SVG/PNG is wide-aspect and the height cap never kicks in).

## Fix (single file: `src/lib/pdf-generator.ts`)

### 1. Header row — true alignment + bigger logo
Replace the header block (lines 380–408) so logo and company text share the same row, vertically centered, with the logo sized to match the visual weight of the company name (≈ same height as the name + tagline stack).

- `.doc-header`: `display:flex; align-items:center; justify-content:space-between; gap:28px; padding:4px 0 12px; border-bottom:1px solid <border>;`
- Logo wrapper: `flex:0 0 auto; display:flex; align-items:center;`
- Logo `<img>`: bump to `height:84px; max-height:84px; width:auto; max-width:280px; object-fit:contain; display:block;` (height is the binding dimension so wide logos still grow tall; max-width prevents extreme widescreen marks from blowing out).
- Right block wrapper: `flex:1; min-width:0; display:flex; flex-direction:column; justify-content:center;` so the text column matches the logo row height instead of pulling the logo upward.
- Company name: keep `font-size:22px; font-weight:800; line-height:1.15;` (already correct).

### 2. Half-A4 override — keep logo prominent
In `HALF_PAGE_CSS` (line 452), raise the logo cap so the half-page Delivery Note also shows a real logo, not a thumbnail:
- `.page-frame img { max-height: 72px !important; max-width: 220px !important; }`

### 3. Warranty template (lines ~740)
Mirror the same change in the warranty header so the warranty invoice logo also matches: `height:84px; max-height:84px; max-width:280px; object-fit:contain;` and `vertical-align:middle` on both logo and company cells (already there).

### 4. Remove dead top whitespace
`.page-frame` `padding:14px 24px 18px` → `padding:10px 24px 18px` so the header sits flush to the top edge of the page without that extra band of empty space above the logo.

## Out of scope (not touched)
- Table layout, totals card, customer card, watermark — all already redesigned in the previous pass.
- `PdfPreviewDialog.tsx` — no changes needed; the larger logo flows through automatically.

## QA
- Open Sales Invoice SI-0003 preview → logo should be ~84px tall, baseline-centered with "Mouj Pharmaceuticals".
- Save as PDF → logo renders at the same prominence as the company name block, no top whitespace band.
- Delivery Note (half-A4) → logo is ~72px, still visible and balanced.
- Warranty invoice → logo matches.
