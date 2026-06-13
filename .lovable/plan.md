Three targeted fixes to PDF output across Sales Invoice / Sales Order / Delivery Note / all docs that share the generator.

### 1. Logo 1.5× bigger (`src/lib/pdf-generator.ts` line 190)
- `height:96px` → `height:144px`
- `max-width:300px` → `max-width:450px`
- Keep `object-fit:contain` so aspect ratio is preserved.
- Applies to both PDF download and Print (single source of truth).

### 2. Fix "QUANTITY" + "MRP INC. TAX" header wrapping (`src/lib/pdf-generator.ts` lines 269-278)
Column header wrap is caused by columns being too narrow. Reallocate width from product_name:
- `product_name` when money cols present: 32% → 28%
- `quantity` / `qty`: 9% → 11%
- `mrp` / `mrp_inc_tax`: 10% → 11%
- Also change `th` header `letter-spacing:0.2px` → `0` and `padding:8px 6px` → `8px 4px` (line 284) to give text room.

Result: "QUANTITY" and "MRP INC. TAX" fit on one line; no text removed.

### 3. Sharper PDF (no pixelation) (`src/components/PdfPreviewDialog.tsx`)
- `html2canvas.scale: 2` → `scale: 3` in BOTH the half-page and full-page configs (lines ~107 and ~127).
- Add `letterRendering: true` and `imageTimeout: 0` to ensure logo finishes loading before snapshot.

This raises render DPI from ~192 to ~288 — eliminates the soft/pixelated look on logo, table borders, and text in both Save-as-PDF and Print (Print uses the same generated blob).

### Out of scope
- No layout restructuring (header stays as the 2-cell table approved earlier).
- No changes to Warranty template (`page-mode=half` only — different file).
- No customer card / totals card changes.

### QA checklist
1. Open SI-0003 → preview → confirm logo visibly larger (~1.5×), centered with company block.
2. Confirm "QUANTITY" and "MRP INC. TAX" headers each render on a single line.
3. Save as PDF → open the file → zoom to 200% → confirm crisp text/borders, no pixel fuzz on logo.
4. Repeat for one Sales Order and one Delivery Note to confirm the shared generator picks up the changes.