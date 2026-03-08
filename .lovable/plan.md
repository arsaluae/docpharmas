

# Plan: Premium Pharma PDF Template + Preview-First Download Flow

## Two Changes

### 1. New Color Palette (No Gold)
Replace the gold/navy scheme with a pharma-grade **teal + slate** palette:
- Primary accent: `#0e7490` (deep teal — medical/pharma feel)
- Light accent: `#99f6e4` (soft mint)
- Header background: `#0f172a` (deep slate) with teal accent line
- Section labels: `#0e7490` instead of gold `#c9a84c`
- Borders: `#e2e8f0` (cool gray) instead of warm ivory
- Alternating rows: `#f8fafc` / `#ffffff` (cool whites)
- Corner ornaments: teal instead of gold
- Gradient dividers: teal gradient instead of gold gradient
- Party card border-left: teal
- Overall feel: clinical, clean, pharmaceutical-grade premium

### 2. Preview-First Flow (No Auto-Print)
Currently `generatePdf()` opens a new window and auto-triggers `print()` after 600ms. Change to:
- Open the document as a styled preview page
- Add a floating **Download / Print** button bar at the top (hidden on print via `@media print`)
- Button triggers `window.print()` on click
- User sees the beautiful document first, then clicks to download/print

## Files Changed

| File | Changes |
|------|---------|
| `src/lib/pdf-generator.ts` | Full color palette swap (gold→teal), add download toolbar, remove auto-print |

No other files change. The template system and all callers remain the same.

