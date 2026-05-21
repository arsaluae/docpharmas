## Goal
Fix the Create Sales Invoice and Create Purchase Order dialogs so every field is clearly labelled, drop the validity-days field, and redesign the Items section into a proper labelled table. Also polish the "Submit / Confirm" flow so quantity and batch are visibly pre-filled from the draft.

## Problems observed
1. **Items rows are unlabelled** — Qty / Rate / Disc% / GST% are number inputs with only placeholder text; the placeholder disappears once a value is typed, leaving anonymous spinner boxes (visible in the user's screenshot).
2. **Cramped column widths** — `col-span-1` collapses Qty / Disc% / GST% so only the spinner arrows show.
3. **Validity (days)** is shown in the header row but the user doesn't use it.
4. **Convert-to-Invoice dialog** already pre-fills `convert_quantity` from draft and auto-selects batch when only one exists, but it isn't obvious to the user. Needs clearer UI: show original draft qty, available stock per batch, and FEFO-sorted batch dropdown with expiry date.

## Plan

### 1. `src/pages/ProformaInvoices.tsx` — Create Sales Invoice dialog
- **Remove Validity field** from the create grid and from the edit grid (lines ~866 and ~1123). Drop `validityDays` / `editValidity` state. In the insert payload (line ~339) and update payload (line ~419), default `validity_days: 30` so the DB column stays satisfied without UI exposure.
- **Header grid** becomes 3 columns: Customer * / Sales Agent / Date.
- **Items section** redesigned:
  - Add a sticky labelled header row (Product · Qty · Rate · Disc% · GST% · Amount · ✕) using the same 12-col grid so labels align with inputs.
  - Each input gets `aria-label` and a small floating label above (text-[10px] uppercase tracking-wider text-muted-foreground) so the field name stays visible even when filled.
  - Widen cramped columns: Product col-span-4, Qty 1 → use `col-span-2` with stepper, Rate 2, Disc% 1, GST% 1 (when enabled), Amount right-aligned remainder, delete icon 1.
  - Wrap the items list in a bordered card with subtle indigo tint, internal padding, and `overflow-x-auto` so it never collapses on narrow viewports.
  - "Add Item" becomes a full-width dashed button at the bottom for clearer affordance.
- **Payment Instructions** moved below items into its own labelled card.

### 2. `src/pages/PurchaseProforma.tsx` — Create Purchase Order dialog
- Remove the Validity field (line ~927) in create and edit (line ~1161). Keep `validity_days: 30` default in the insert/update payloads.
- Header grid becomes 2 columns: Supplier * / Date.
- Apply the same labelled-header Items grid pattern (Product / Qty / Rate / Amount / ✕). Widen cramped columns identically.
- Additional Costs row keeps its current layout but gets the same labelled-header treatment.

### 3. Submit / Convert-to-Invoice dialog polish (`ProformaInvoices.tsx` lines 1161–1202)
- Already auto-fills `convert_quantity` from draft and auto-selects batch when single. Make this **visible**:
  - Show **"Ordered: {qty}"** chip beside the editable Quantity input, so the user sees the draft qty without ambiguity.
  - **Sort batches FEFO** (earliest expiry first) and **show expiry date** in each option label: `BATCH-123 · 240 avail · exp 2027-03`.
  - Fetch `expiry_date` from `grn_items` in the same trip as `stock_movements` (small extra query) and attach to `BatchOption.expiry_date`.
  - When only one batch exists, render it as a read-only pill instead of a dropdown (since it's auto-selected anyway) so the user knows nothing else is required.
  - Show running validation: red border on Qty if `convert_quantity > batch.available`.
- Apply the same batch-display polish to the Purchase Order "Receive (GRN)" dialog if it has a parallel structure — verify only, don't expand scope.

### 4. QA pass
- Open Create Sales Invoice, type into every field, confirm labels stay visible.
- Open Create Purchase Order, same.
- Create a draft → submit → confirm the dialog shows ordered qty + FEFO-sorted batches with expiry → confirm and verify invoice + delivery note are created.
- Re-open existing edit dialogs (Sales + Purchase) — confirm Validity is gone and saves still succeed.

## Out of scope
- No schema, RLS, or DB-trigger changes (`validity_days` stays in DB with a default).
- No changes to invoice numbering, stock-movement logic, or document templates.
- No changes to the landing pages, summary strips, or navigation.

## Technical notes
- All new UI uses existing Tailwind tokens (`bg-muted/40`, `border-border/50`, `text-muted-foreground`); no hard-coded colors.
- Floating labels are a single `<span>` above each input, not a Label component, to keep the row compact.
- The items grid stays a CSS grid (not `<table>`) so the existing SearchableSelect popovers continue to work without z-index issues.
