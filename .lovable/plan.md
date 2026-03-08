

# Fix PDF Preview to Show Full Invoice Without Margins

## Problem
The PDF preview dialog shows the invoice with a grey background and excess margins/padding around the white document area, making it look like the invoice is "hidden" behind whitespace. Users have to scroll past empty space.

## Root Cause
The `page-frame` CSS in `pdf-generator.ts` has:
- `body { background: #e2e8f0 }` (grey background)
- `.page-frame { max-width: 800px; margin: 80px auto 40px; padding: 44px 48px }`

The `PdfPreviewDialog` injects override CSS but doesn't fully neutralize these — especially the body background color and page-frame internal padding/margin.

## Fix

### `src/components/PdfPreviewDialog.tsx`
Update the injected CSS to:
- Set `body { background: #fff }` (white, not grey)
- Remove the 80px top margin from `.page-frame`
- Set `.page-frame { margin: 0 auto; padding: 28px 32px }` (tight but readable)
- Hide corner ornaments and the `::before` inner border in embedded mode
- Remove box-shadow

This single change fixes the preview for ALL document types (sales invoice, delivery note, purchase order, etc.) since they all use the same `PdfPreviewDialog`.

## Files
| File | Change |
|------|--------|
| `src/components/PdfPreviewDialog.tsx` | Improve injected CSS to eliminate grey margins and make document fill the window |

