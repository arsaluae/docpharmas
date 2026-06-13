# Fix PDF Header Alignment + Table Column Wrap

## What's actually broken (from screenshot)

1. **Header row collapses.** Logo sits flush at top-left, but "Mouj Pharmaceuticals" + address render ~120px lower on the right. The flex `.doc-header` is not keeping logo and company block on a single visually-centered row — html2canvas/print rendering of `display:flex; align-items:flex-start` with a 110px image vs. a 4-line text block makes the two sides look detached.
2. **Logo appears "small"** only because of (1) — it's stranded alone in whitespace with nothing beside it for scale.
3. **"SALES INVOICE" title is too low** — pushed down by the collapsed header gap.
4. **Table header "QUANTITY" wraps to "QUANTI / TY"** — the 8% column is too narrow for the 8-letter uppercase word at 12px. "MRP INC. TAX" wraps to 3 lines for the same reason.
5. **Totals card pushed below the fold** — knock-on effect of (1)+(3) eating ~150px of vertical space.

## Fix (scope: `src/lib/pdf-generator.ts` only)

### 1. Replace the flex header with a 2-cell `<table>` (rock-solid in html2canvas + print)

Currently lines 381–383 define `.doc-header` as flex, and lines 406–409 render two divs inside it. Swap to a table:

```html
<table class="doc-header" style="width:100%;border-collapse:collapse;border-bottom:1px solid ${C.border};margin-bottom:6px;">
  <tr>
    <td style="width:55%;vertical-align:middle;padding:8px 0;">${logoHtml}</td>
    <td style="width:45%;vertical-align:middle;text-align:right;padding:8px 0;">${companyBlock}</td>
  </tr>
</table>
```

Remove the old `.doc-header`, `.doc-header > div:first-child`, `.doc-header > div:last-child` CSS rules (lines 381–383).

`vertical-align:middle` on `<td>` is the one CSS rule that html2canvas, Chrome print, and jsPDF all render identically — this is the actual fix for the alignment bug.

### 2. Keep logo prominent but balanced

In `logoHtml` (line 188–192), change to:
```
height:96px !important; width:auto !important; max-width:300px !important; object-fit:contain; display:block;
```
96px is the sweet spot — large enough to feel premium, small enough that the company name (19px × 4 lines ≈ 95px tall) matches its height, so middle-alignment looks perfectly centered.

### 3. Fix cramped table columns (`colWidth`, lines 265–280)

Adjust widths so headers don't wrap:
- `quantity` / `qty`: `8%` → `9%`
- `batch_number` / `batch`: `12%` → `11%`
- `expiry_date` / `expiry`: `11%` → `10%`
- `mrp` / `mrp_inc_tax`: `8%` → `10%`
- `rate`: `9%` → `8%`
- `amount` / `line_total`: `13%` → `12%`

And in the `<th>` style (line 284), change `white-space:normal` → `white-space:nowrap` for headers only (keep cells wrapping). Headers are short (1–2 words); forcing nowrap guarantees "QUANTITY" stays on one line. If a long header like "MRP INC. TAX" still doesn't fit, shorten its label to "MRP" in the column config (no template change needed — display label only).

Actually safer: keep `white-space:normal` but reduce header `font-size:12px` → `11px` and `letter-spacing:0.3px` → `0.2px`. Cleaner and won't break with very long custom headers.

### 4. Reduce top padding of `.page-frame`

Line 380: `padding:10px 24px 18px` → `padding:6px 24px 18px`. Removes the small extra top whitespace.

### 5. Tighten title spacing

Line 208: `margin-top:14px` → `margin-top:10px` so SALES INVOICE sits closer to the header rule.

## Out of scope

- Customer card design — already correct, just looks oversized because of header bug; fixing (1) rebalances the page.
- `PdfPreviewDialog.tsx` — no changes.
- Half-page CSS (HALF_PAGE_CSS) — already overrides logo to 90px; will still work since the new table header inherits the same `img` selector.
- Warranty template — uses its own logo block; not affected by this bug per screenshot.

## QA checklist

1. Open SI-0003 → Preview → confirm logo + "Mouj Pharmaceuticals" sit on the same horizontal centerline, separated only by horizontal space.
2. "SALES INVOICE" title now appears ~30mm from top of page, not ~70mm.
3. Table header row: every column header on a single line, no "QUANTI / TY" split.
4. Click "Download / Print" → saved PDF visually matches preview (logo prominence preserved, no second blank page, totals card on page 1).
5. Test with 1 / 3 / 5 product rows + long product name + long customer address — header stays stable.
