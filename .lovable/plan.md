# Migration importer — field-coverage fix

The schema is already wide enough (customers, suppliers, products, grn_items, migration_errors all have the needed columns). The gaps are in the importer pipeline: header aliases, validators rejecting rows that should warn, posters not linking suppliers, and the wizard not surfacing unmatched/failed buckets clearly. No new tables needed.

## 1. Aliases — guarantee every legacy header lands (`src/lib/import/aliases.ts`)

Audit shows most legacy headers already map. Add the missing ones the user listed explicitly so auto-detect never misses:

- `business name`, `business` → `name`
- `mobile`, `mobile #`, `mobile number`, `contact #` → `phone`
- `a/c no.`, `a/c #` (already partial — add trailing-dot variants) → `old_erp_account_code`
- `sale price` → `selling_price`
- `low stock`, `low stock qty` → `low_stock_level`
- `large pack size`, `large pack`, `outer pack` → `pack_size`
- `sale information`, `sale info` → `sale_information`
- `to location`, `warehouse`, `location` (when entity = batches) → `to_location`
- `base unit`, `unit` → `unit`
- `base quantity`, `qty`, `quantity` → `quantity`
- `batch no.`, `batch #`, `batch number`, `lot no.` → `batch_number`
- `batch expiry`, `expiry`, `expiry date`, `exp date`, `exp.` → `expiry_date`
- `payment terms`, `pay terms`, `terms` → `payment_terms_days`
- `county`, `province`, `state` → `province` (customers/suppliers) / `county` if county column used
- `supplier`, `vendor`, `preferred supplier` → `supplier_name` (products entity)
- `code`, `product code`, `item code` → `sku` (already present — keep)

## 2. Validators — turn hard-fails into warnings where the spec allows (`src/lib/import/validators.ts`)

- Products: drop `required: true` from `cost_price` and `selling_price` in `types.ts`; in the validator, when either is missing or non-numeric, set value to `0` and push a warning ("price defaulted to 0").
- Customers / Suppliers: when `city`, `address`, `phone` or `email` are missing, push a warning (do not error). When `phone` looks invalid (cleanMobile returns null but value present), keep raw text and append it to `notes` (`mobile-field: …`).
- Batches: keep the current zero-qty / missing-batch / invalid-expiry behaviour, but tag each error with a `severity` (`"skipped"` for zero-qty / invalid-expiry, `"error"` for missing SKU / batch). The wizard uses this to bucket rows correctly.

Add this to `NormalizedRow.errors` items (extend `ValidationError` with optional `severity: "error" | "skipped" | "warning"`).

## 3. Posters — link supplier_id, write to `migration_errors`, log skipped rows (`src/lib/import/posters.ts`)

- `postProducts`: after insert, capture each posted product's `id` + `sku` + normalized `supplier_name`. Run a single supplier-name resolver:
    1. Pre-load all suppliers for the tenant (`id`, `name`, `supplier_code`, `old_erp_account_code`).
    2. Normalize both sides (trim, lower, collapse whitespace, strip punctuation) and try direct match.
    3. Matches → bulk `update products set supplier_id = …`.
    4. Unmatched product SKUs are written to `migration_errors` with `severity = "warning"`, `field = "supplier_name"`, `message = "supplier '<name>' not found — needs manual mapping"`, and returned to the caller as `unmatchedSuppliers: { sku, supplier_name }[]`.
    5. If `company_settings.auto_create_missing_suppliers` is true, create stub supplier rows (name only) and link them before writing warnings.
- `postBatches`:
    - For rows with no `batch_supplier`, fall back to the product's `supplier_id` (looked up via the SKU map).
    - Skip rows where qty<=0 / invalid expiry / unknown SKU but write each to `migration_errors` with the appropriate severity (`skipped` vs `error`) and `field` set so the wizard's downloads include them.
    - On duplicate `(product_id, batch_number, expiry_date)` within the GRN, merge into the first row (already done in the validator — confirm and add a DB-side check too via existing `idx_grn_items_product_batch`).
- All posters: write every validation error/warning to `public.migration_errors` (one row per error) with `import_batch_id` and `migration_batch_id` so they survive page refresh and feed the report.

## 4. Wizard report (`src/pages/MigrationWizard.tsx`)

Add four buckets to the existing verification screen, each as a card + downloadable CSV:

- Customers imported (with sub-counts: with city / with address / with phone or email)
- Suppliers imported (with sub-counts: with city / with address / with phone or email / with payment terms)
- Products imported (with sub-counts: with sale price / with cost price / with supplier linked / **without supplier — needs mapping**)
- Batches imported (with sub-counts: with batch / with expiry / with qty, skipped rows, invalid-expiry rows, SKU-mismatch rows)

CSV exports read from `migration_errors` filtered by `migration_batch_id` + `severity`.

## 5. Unmatched-supplier mapping screen (new component used inside the wizard)

After product posting, if `unmatchedSuppliers.length > 0`:

- Render a table: legacy supplier name | row count | dropdown of existing suppliers + "Create new" option.
- "Apply mapping" button bulk-updates `products.supplier_id` for the affected SKUs in the current `import_batch_id` and deletes the corresponding rows from `migration_errors`.
- Skip button leaves the warning in place so the admin can revisit it from the migration report later.

## 6. Settings toggle

Add `auto_create_missing_suppliers boolean default false` to `company_settings`. Settings → Data Migration adds a single switch; the poster reads it via `useCompanySettings`.

## 7. Files touched

```text
src/lib/import/aliases.ts            ← header coverage
src/lib/import/types.ts              ← drop required on price fields, add severity type
src/lib/import/validators.ts         ← warnings vs errors, severity tagging
src/lib/import/posters.ts            ← supplier linking + write migration_errors + batch fallback
src/pages/MigrationWizard.tsx        ← extended buckets + downloads
src/components/migration/UnmatchedSuppliers.tsx   ← new mapping UI
src/hooks/useCompanySettings.tsx     ← surface auto_create_missing_suppliers
supabase migration                   ← add company_settings.auto_create_missing_suppliers column only
```

## Out of scope

- No new tables (existing schema covers every field listed).
- No changes to RLS / tenant isolation.
- No changes to historical-transaction importers (sales/purchase invoices) beyond what's already shipped.
- No data wipe.
