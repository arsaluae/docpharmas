

# Plan: Ultra-Premium Pharmaceutical Dashboard

## What Changes

Replace the grouped action hubs section with **8 premium action buttons in 2 rows of 4**, remove inactive customers (already done), and refine the overall dashboard feel with pharmaceutical-grade styling.

### Row 1 — Sales Operations (Teal/Sapphire tones)
| Button | Route | Color |
|--------|-------|-------|
| Sales Order | /proforma | Indigo gradient |
| Sales Invoice | /delivery-notes | Blue gradient |
| Warranty Invoice | /warranty-invoices | Violet gradient |
| Payment In | /payments | Cyan/Teal gradient |

### Row 2 — Operations (Warm/Earthy pharma tones)
| Button | Route | Color |
|--------|-------|-------|
| Inventory | /products | Amber/Orange gradient |
| Purchase Order | /purchase-proforma | Emerald gradient |
| Print Jobs | /print-jobs | Fuchsia/Purple gradient |
| Expenses | /expenses | Rose gradient |

### Button Design
Each button is a tall card (~120px) with:
- Subtle gradient background (e.g., `from-indigo-500/8 to-indigo-600/15`)
- Large centered icon (h-8 w-8) with matching gradient icon background circle
- Label below in `font-heading` small caps
- Hover: scale-[1.02] + shadow-lg + gradient intensifies
- Bottom colored accent line (2px gradient bar)
- Smooth `transition-all duration-300`

### Additional Polish
- Stats strip: Keep as-is (already clean)
- Remove the `actionHubs` array and the 5-column card grid entirely
- Keep: Stats, 8 buttons, New Stock In, Top Selling, Top Customers, Reorder Alerts, AI CTA

## Files Changed

| File | Action |
|------|--------|
| `src/pages/Index.tsx` | Replace actionHubs section with 8 premium gradient buttons in 2×4 grid |

