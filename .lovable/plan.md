
## Goal

You already have a solid per-entity importer (`DataImport`, `ImportHistory`, `import_batches`, `import_staging_rows`, `rollback_import_batch`). What's missing for a true legacy-ERP migration is:

1. A **fixed, guided sequence** (Suppliers → Customers → Products → Batches → Opening Balances → Verification).
2. **Field aliases** matching your legacy column names (Product Code, A/C No., Business Name, To Location, Base Quantity, Batch Expiry, etc.).
3. **Pharma-grade row rules** (drop qty=0, drop unknown SKUs, reject `0000-00-00`, Excel-serial dates, merge duplicate product+batch).
4. **Data cleaners** (mobile normalization, email validation, license-text-in-email → notes).
5. **Final verification report** screen rolled up from `import_batches` + `import_staging_rows`.

Rollback, staging tables, audit, failed-rows CSV, and column auto-mapping already work — we extend, not rebuild.

---

## Plan

### 1. New file `src/lib/import/cleaners.ts`
Pure helpers reused by validators:
- `cleanMobile(v)` — strip non-digits, normalize `+92`/`0092`/`0` prefixes to canonical `03XXXXXXXXX`.
- `cleanEmail(v)` → `{ email: string|null, overflowNote: string|null }`. Regex test; if fails but value looks like license/address text (length > 10 or contains spaces/`,`/`Lic`), push to `overflowNote`.
- `parseExcelDate(v)` — already in `validators.ts`; extract here. Treat `"0000-00-00"`, `"0"`, blank as null.
- `mergeBatchKey(sku, batch)` — lowercased key for duplicate-merging.

### 2. Expand `src/lib/import/aliases.ts`
Add legacy headers → canonical keys, per entity:
- Products: `product code`→`sku`, `product name`→`name`, `sale price`→`selling_price`, `cost`→`cost_price`, `low stock`→`reorder_level`, `large pack size`→`pack_size`, `supplier`→`supplier_name`, `type`→`category`, `weight`/`unit`/`base unit`→`unit`, plus carry-only fields (`expense_account`, `income_account`, `stock_account`, `sale_information`) stored in `notes`.
- Customers: `business name`/`title`/`first name`/`last name`→ composed `name`, `mobile`/`sms mobile`/`phone`→`phone`, `a/c no.`→`old_erp_account_code`, `cnic`→`cnic`, `country`/`county`/`website`→`notes` overflow.
- Suppliers: `business name`+`first name`+`last name`→`name`, `a/c no.`→`old_erp_account_code`, `payment terms`→`payment_terms_days`.
- Batches: `code`→`sku`, `product`→`name` (informational), `to location`→`location` (notes), `base unit`→`unit`, `base quantity`→`quantity`, `batch no.`→`batch_number`, `batch expiry`→`expiry_date`.

### 3. Extend `src/lib/import/types.ts`
- Add optional fields where needed: `products.notes`, `products.supplier_name`; `customers.old_erp_account_code`, `customers.cnic`, `customers.notes`; `suppliers.old_erp_account_code`, `suppliers.notes`; `batches.notes`.
- Add new `EntityType: "opening_balances"` (umbrella for customer + supplier opening, single sheet with `party_type` column) — kept alongside existing `customer_opening`/`supplier_opening`.

### 4. Extend `src/lib/import/validators.ts`
Apply legacy-ERP rules per entity:
- **All entities**: run cleaners; email overflow appended to `notes`.
- **Batches**:
  - drop (mark `errors`) qty `0` / missing → error "zero quantity";
  - missing SKU/batch → error;
  - expiry parses `0000-00-00` & Excel serials via `parseExcelDate`;
  - cross-row merge: if same (`sku`,`batch_number`) appears twice → sum `quantity`, keep first row, others marked `merged` (new status, treated as valid with no insert, counted in report).
  - existence check against products table happens during posting (already does); validators flag missing SKU only if products were already imported in this wizard (best-effort — actual block at post time).
- **Products**: dedup by SKU (already done). Coerce category aliases (Type column) to known enum via lookup table; unknown → fall back to `other`.

### 5. Extend `src/lib/import/posters.ts`
- `postProducts`: write `notes`, `supplier_name` (resolve `supplier_id` from suppliers table when found).
- `postCustomers`/`postSuppliers`: write `old_erp_account_code`, `cnic`, `notes`.
- `postBatches`: skip rows already marked `merged`. Final list goes through existing GRN flow.
- Add `import_batch_id` to all inserts (already there).

### 6. DB migration (single file)
- Add nullable cols if not present:
  - `customers.old_erp_account_code text`, `customers.cnic text`, `customers.notes text`
  - `suppliers.old_erp_account_code text`, `suppliers.notes text`
  - `products.notes text`, `products.legacy_codes jsonb`
- Tenant-scoped partial unique index on `old_erp_account_code` (where not null) for both customers & suppliers — prevents re-importing same legacy code twice.
- No new tables (staging already exists).

### 7. New page `src/pages/MigrationWizard.tsx` (route `/import/wizard`)
A linear 6-step shell that reuses existing `DataImport` flow inside each step:
```text
[ Suppliers ] → [ Customers ] → [ Products ] → [ Batches ] → [ Opening Balances ] → [ Verification ]
```
- Each step shows: short instructions, "Download template", embedded `DataImport` sub-flow locked to that entity (props `lockedEntity`), and a "Skip step" option.
- Wizard tracks `wizard_run_id` (uuid in localStorage) so verification report can filter `import_batches.created_at >= wizard_started_at`.
- Step is marked complete when at least one batch for that entity has status `completed`.

### 8. Refactor `DataImport.tsx` minimally
Accept optional `lockedEntity?: EntityType` prop and `onComplete?: () => void`. When `lockedEntity` is set: skip Step 1 (entity picker), header changes, and on success call `onComplete`. No behavior change for existing `/import` route.

### 9. Verification report (Step 6)
A new card-driven view inside `MigrationWizard.tsx` that queries:
- counts from `import_batches` for this wizard run, grouped by `entity_type` (posted vs invalid).
- counts from `import_staging_rows` joined to wizard batches, broken down by error reason (zero qty / invalid expiry / unknown SKU / missing batch / merged duplicates / missing phone+email).
- "Download full report" → CSV with one row per entity.
- "Rollback entire migration" button → loops the wizard's batch ids through existing `rollback_import_batch` RPC after confirmation + reason.

### 10. Navigation
- Add a prominent "ERP Migration Wizard" button on `DataImport` and a sidebar entry under Settings (admin-only via existing `RequireCap`).
- `App.tsx` route: `/import/wizard` → `MigrationWizard`.

---

## Out of scope (intentionally)
- No new staging tables — existing `import_staging_rows` already does what `product_import_staging`/`customer_import_staging` would do; per-entity staging is implicit via `batch_id + entity_type`.
- No edge function — all logic runs client-side using authenticated supabase calls under RLS, same as current importer.
- No change to rollback RPC — already cascades across products/customers/suppliers/grn/stock/payments.

---

## Files touched

**New**
- `src/lib/import/cleaners.ts`
- `src/pages/MigrationWizard.tsx`
- one migration in `supabase/migrations/`

**Edited**
- `src/lib/import/aliases.ts` (add legacy headers)
- `src/lib/import/types.ts` (extra fields, opening_balances type)
- `src/lib/import/validators.ts` (cleaners + merge + qty/expiry rules)
- `src/lib/import/posters.ts` (write new cols, skip `merged` rows, resolve supplier_id)
- `src/pages/DataImport.tsx` (accept `lockedEntity`/`onComplete`)
- `src/App.tsx` (new route)
- `src/components/AppSidebar.tsx` or Settings nav (link)

## Risks
- Adding columns to `customers`/`suppliers`/`products` is additive and nullable → safe with RLS unchanged.
- Wizard's "rollback entire migration" uses the same RPC for each batch sequentially; if user has *other* batches mixed in, they remain untouched (filter is by batch_id list, not entity).
- Excel files >50k rows can be slow in browser — same constraint as today; we keep 500-row chunks.

Reply **go** to build, or tell me what to adjust (e.g. drop the umbrella `opening_balances` entity, change wizard order, add a separate `product_import_staging` table for auditors, etc.).
