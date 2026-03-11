

# Fix: PDF Download Not Working

## Root Cause
The `PdfPreviewDialog` uses `iframe.contentWindow.print()` inside a sandboxed iframe. On mobile browsers (especially Android WebView / Chrome), this fails silently because:
1. The `sandbox` attribute restricts print access even with `allow-modals`
2. Many mobile browsers don't support `window.print()` from within iframes at all
3. The Lovable preview iframe itself adds another layer of sandboxing

## Fix
Change the "Download / Print" button to open the full HTML in a **new browser tab** instead of trying to print from within the iframe. This works reliably on both desktop and mobile:

```
handlePrint → opens new window → writes HTML → user can print/save from there
```

Also add a **"Share" button** that creates a Blob URL for downloading the HTML file directly (useful on mobile where print dialogs are clunky).

## Document Counters: Verified
All 19 document types are confirmed present for Mouj Pharmaceuticals tenant:
- `proforma`, `sales_invoice`, `delivery_note`, `purchase_proforma`, `purchase_order`, `purchase_invoice`, `grn`, `payment`, `expense`, `warranty_invoice`, `credit_note`, `salary`, `sales_return`, `purchase_return`, `print_job`, `journal`, `supplier`, `customer`, `product`

No document number generation issues remain.

## File Changed

| File | Change |
|------|--------|
| `src/components/PdfPreviewDialog.tsx` | Replace `iframe.contentWindow.print()` with `window.open()` approach that works on mobile |

