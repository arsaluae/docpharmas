
## Goal

Import the uploaded `Batch and Quantity.xlsx` (and any future file in the same legacy shape) through the existing **Batches** importer so that every product can carry multiple batches, each with its own quantity and expiry.

## What the file looks like

Columns:

```text
Code | Product | To Location | Base Unit | Base Quantity | Batch No. | Batch Expiry
```

- Multiple rows per product (one per batch) — already supported by the current batches validator.
- Sub-section header rows where only `Product` has a value (e.g. `Cap's`, `Cosmetics`, `Drops`, `Total`) with no Code / Batch / Qty.
- Quantity values like `13.`, `1,132.`, `-64.` (legacy stock adjustments).
- Expiry values like `0000-00-00` for unknown / blocked batches.
- `Code` is the legacy product code (e.g. `1015`) — the same code already imported as the product SKU.

## Why the current importer fails on this file

1. Header aliases already map (`Code → sku`, `Base Quantity → quantity`, `Batch No. → batch_number`, `Batch Expiry → expiry_date`, `Base Unit → unit`, `To Location → to_location`) — no change needed there.
2. Section-header rows (`Cap's`, `Total`) flow into the validator and produce noisy "missing SKU / batch / qty" errors.
3. Generic number validator (`validators.ts` lines 113-114) rejects negatives on `quantity` before the batches case runs, so the row appears as a hard error instead of a clean "skipped: negative qty".
4. Past-expiry rows are blocked unless the wizard's `allowPastExpiry` is on — for a legacy migration we need to surface that toggle clearly.
5. `postBatches` already groups by supplier and tolerates missing supplier, but unmatched SKUs need to be logged to `migration_errors` with `severity = "warning"` so the verification report shows them.

## Changes

### 1. `src/lib/import/validators.ts`
- Add a pre-filter inside `validateAll` for `entity === "batches"`: drop rows where **all** of `sku`, `batch_number`, `quantity`, `expiry_date` are empty (section headers / `Total` rows). Tag them as `merged: true` so they don't count as errors, with `warnings: ["section header — ignored"]`.
- In the generic number branch, special-case `entity === "batches" && f.key === "quantity"`: accept negatives (store the value), do not push the `must be ≥ 0` error. The batches cross-field block will still skip `qty <= 0` rows with a clearer message.
- Replace the existing `quantity` / `expiry` error messages in the batches case with `severity: "skipped"` tags (extend `ValidationError` with optional `severity`) so the wizard buckets them as "skipped" rather than "failed":
  - negative or zero qty → `severity: "skipped"`, message `"non-positive quantity (legacy adjustment) — skipped"`.
  - missing/invalid expiry (`0000-00-00`) → `severity: "skipped"`, message `"missing or sentinel expiry — skipped"`.
  - missing SKU / batch → `severity: "error"` (genuine data problem).

### 2. `src/lib/import/types.ts`
- Extend `ValidationError` with `severity?: "error" | "skipped" | "warning"` (default `"error"`).

### 3. `src/lib/import/posters.ts` — `postBatches`
- After loading the product lookup, push every row whose `sku` is not matched into `migration_errors` with `severity = "warning"`, `field = "sku"`, `message = "product code <code> not found — batch skipped"`, and skip the row instead of failing the whole batch.
- For matched rows with no `batch_supplier`, fall back to the product's `supplier_id` (already implemented — confirm path still runs after the new skip logic).
- Continue to merge `(product_id, batch_number, expiry_date)` duplicates so the same batch appearing twice for one product is summed.

### 4. `src/pages/MigrationWizard.tsx`
- Surface an "Allow past-expiry batches" switch on the Batches step (binds to `validateAll`'s `allowPastExpiry`) so legacy expired stock can still be brought in for traceability.
- Extend the Batches coverage card with sub-counts:
  - rows imported,
  - rows skipped (section headers),
  - rows skipped (non-positive qty),
  - rows skipped (invalid expiry),
  - rows skipped (SKU not found in products) — link to download CSV from `migration_errors`.

### Out of scope

- No DB schema changes; `grn_items`, `batches` import infra, and `migration_errors` are already in place.
- No changes to the Products / Customers / Suppliers importers.
- No new RPC or RLS work.

## Files touched

```text
src/lib/import/types.ts          (add ValidationError.severity)
src/lib/import/validators.ts     (pre-filter, allow negative qty, severity tags)
src/lib/import/posters.ts        (log unmatched SKUs to migration_errors)
src/pages/MigrationWizard.tsx    (allow-past-expiry toggle + sub-counts)
```

## Verification after build

1. Upload `Batch and Quantity.xlsx` on the Batches step.
2. Confirm header auto-detect maps all 7 columns.
3. Validate — expect: section-header rows ignored silently, negative/zero qty rows shown as "skipped", `0000-00-00` rows shown as "skipped".
4. Post — confirm products with multiple batches receive one GRN line per (batch, expiry) and unmatched legacy codes appear in the report's "SKU not found" bucket.
