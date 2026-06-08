## Fixes for Purchase Order creation + PDF heading

### 1. Add column headers to the Items grid (Create + Edit dialogs)
In `src/pages/PurchaseProforma.tsx`, just above the `items.map(...)` row block (around line 983, and the matching block in the Edit dialog), insert a header row using the same 12-col layout used for inputs:

```
# | Product | Qty | Rate | Amount |   (trash)
1   col-span-4   col-span-2  col-span-2  col-span-2  col-span-1
```

Render with `text-[11px] uppercase tracking-wide text-muted-foreground font-medium border-b border-border/60 pb-1 mb-2` so the labels line up exactly over the inputs shown in the screenshot. Same change is mirrored in the Edit Purchase Order dialog.

### 2. Inline "Add new product" from the PO dialog
Currently the product picker (`SearchableSelect`) only lets you pick existing products. Add:

- A `+ New Product` button next to `+ Add Item` in the items header (and matching button in Edit dialog).
- A small inline dialog (`QuickCreateProductDialog`) with the minimum fields needed: **Name (required)**, **SKU (auto)**, **Cost Price**, **MRP**, **Pack Size**, **Unit**. On save it inserts into `products` (tenant scoped, `is_active=true`) using the same logic as `Products.tsx` (only required columns).
- After insert: refresh the local `products` list, and if the user opened the dialog from a specific row, auto-select the new product into that row.
- Also expose it from inside the product `SearchableSelect` dropdown as a sticky `+ Create new product…` row at the top of the list (small UX win — opens the same dialog).

No schema changes. Uses existing `products` RLS.

### 3. Make Print Job creation fully optional (never blocking, never visible during PO creation)
Today the `PrintAvailabilityPanel` renders under every line of the Create-PO dialog, which makes users think a print job is required. It is not blocking in code, but it is visually intrusive.

- **Remove `PrintAvailabilityPanel` from the Create Purchase Order dialog** (line ~998–1002). It will still be visible later (PO detail / GRN / Purchase Invoice screens where it already exists) so packaging can be reserved or a print job started *after* the PO/Bill is created — exactly what the user asked for.
- Keep `allocatePrinting(...)` auto-reservation on confirm (line 518–534) as-is, but **wrap the shortfall toast as `toast.info` with action "Create Print Job"** so the user can optionally jump to print jobs *after* the PO is confirmed. No errors, no blocking.
- Edit dialog is unchanged (it never had the panel).

### 4. Fix PDF/Invoice column headers being hidden when printed
In `src/lib/pdf-generator.ts` the items-table `<th>` cells use light text (`color:#e2e8f0`) on a dark gradient background. When printed, Chrome/Safari often strip the gradient background even with `-webkit-print-color-adjust:exact` on `body`, so the white-on-white headers disappear — matching the user's "doesn't show heading of all things, it hides the heading" complaint.

Changes inside `buildPdfHtml`:
- Add `-webkit-print-color-adjust:exact;print-color-adjust:exact;` directly to the `<thead> <tr>` and each `<th>` inline style so the dark background is forced to print.
- As a safety net, in the `@media print { ... }` block add:
  ```css
  thead tr { background: #0f172a !important; }
  thead th { color: #ffffff !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  tr { page-break-inside: avoid; }
  thead { display: table-header-group; }   /* repeat header on each printed page */
  tfoot { display: table-footer-group; }
  ```
- Apply the same forced color hints to the totals box border-top and the `Amount in Words / Bank Details / Notes` accent labels so their colored backgrounds also survive printing.

This is purely a presentation fix in `pdf-generator.ts`; no template/data changes.

### Out of scope
- No changes to RBAC, RLS, or audit.
- No changes to invoice numbering, totals, GST/WHT logic.
- No redesign — only the missing labels + colors + an extra inline dialog.

### Files touched
- `src/pages/PurchaseProforma.tsx` — column header row, `+ New Product` button + state, remove `PrintAvailabilityPanel` from Create dialog, soften post-confirm toast.
- `src/components/QuickCreateProductDialog.tsx` *(new)* — minimal product creation.
- `src/components/SearchableSelect.tsx` — optional `onCreateNew` prop that renders a sticky "+ Create new…" row at top.
- `src/lib/pdf-generator.ts` — print-safe header colors + `display:table-header-group`.
