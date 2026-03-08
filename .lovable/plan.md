

# Plan: Streamlined Filters + Status-Themed PDF Templates

## 1. Filter Bar Redesign (Both Sales & Purchase)

**Remove** the duplicate status text filter buttons (the `STATUS_OPTIONS` pill group) — these duplicate the premium status buttons above.

**Add "All" as a 5th premium button** at the start of the status buttons row (grid becomes 5 columns). Style it with a neutral slate/gray gradient. When active (default), shows total order count.

**Replace customer/supplier dropdown** with a search Input field that filters by customer/supplier name (text-based search, not combobox dropdown).

**Redesign time filter** — style the date range pills (All/Today/Week/Month) as small premium pill buttons with subtle gradient backgrounds instead of plain text tabs. Keep them inline with the search bar.

**Final filter bar layout:**
```text
[ 🔍 Search orders & customers...          ] [ All | Today | Week | Month ]
```

## 2. PDF Templates Per Status

Enhance `generatePdf` to accept an optional `statusTheme` parameter that changes the accent colors and title styling:

| Status | PDF Title | Accent Color | Header Accent |
|--------|-----------|-------------|---------------|
| Draft | SALES ORDER (DRAFT) | Amber (#d97706) | Amber gradient |
| Invoiced | SALES INVOICE | Blue (#2563eb) | Blue gradient |
| Dispatched | DELIVERY NOTE | Violet (#7c3aed) | Violet gradient |
| Paid | SALES INVOICE (PAID) | Emerald (#059669) | Emerald gradient |

For **Purchase**:
| Draft | PURCHASE ORDER (DRAFT) | Amber |
| Ordered | PURCHASE ORDER | Blue |
| Confirmed | PURCHASE ORDER (CONFIRMED) | Violet |
| Received | GOODS RECEIVED NOTE | Emerald |

The PDF generator's color palette (`C` object) will be parameterized — `statusTheme` overrides `C.primary`, the header gradient, and the accent divider color while keeping the same clean layout.

## Files Changed

| File | Action |
|------|--------|
| `src/pages/ProformaInvoices.tsx` | Add "All" button, remove STATUS_OPTIONS pills, replace customer dropdown with search input, restyle date filters |
| `src/pages/PurchaseProforma.tsx` | Same filter changes for purchase |
| `src/lib/pdf-generator.ts` | Add `statusTheme` option to `PdfOptions`, parameterize colors per theme |

