
# ERP Migration Module — Full Spec Build-out

The project already ships a working 6-step wizard at `/import/wizard` with auto-detect mapping, validation, staging in `import_batches` + `import_staging_rows`, posting, audit logs, and per-batch rollback. The spec you gave is wider than what's currently captured, so this plan **extends** the existing module instead of rebuilding it.

## 1. Schema additions (one migration)

Add the missing legacy columns so we never lose data. All are nullable, all are tenant-scoped via existing RLS; no breaking changes.

**`customers`** — add  
`title, first_name, last_name, contact_person, sms_mobile, whatsapp, website, tax_number, credit_days, address_line2, district, province, country, postal_code, status, old_erp_id`

**`suppliers`** — add  
`contact_person, whatsapp, tax_registration, bank_account, bank_name, province, country, postal_code, status, old_erp_id`

**`products`** — add  
`barcode, generic_name, brand, manufacturer, sub_category, trade_price, retail_price, tax_percent, low_stock_level, stock_account, income_account, expense_account, batch_tracking, expiry_tracking, status, old_erp_id`
(Existing `stock_quantity` is kept for legacy reads but the spec rule "stock comes from batches" is already true — `recompute_product_stock()` derives it from `stock_movements`. We will not write to `stock_quantity` from the importer; opening stock is posted as `batches` rows.)

**Inventory** — the existing `goods_received_notes`/`grn_items` + `stock_movements` flow already supports per-batch qty, expiry, batch supplier, manufacturing date (add `manufacturing_date date` to `grn_items`), batch cost, and purchase reference. No new inventory table is needed.

**New staging tables** (alongside the existing generic `import_batches` + `import_staging_rows`, kept for backwards compatibility):

- `migration_batches` (id, tenant_id, started_by, started_at, finished_at, status, source_file, before_counts jsonb, after_counts jsonb, notes)
- `customer_staging`, `supplier_staging`, `product_staging`, `inventory_staging`, `accounting_staging` — one row per legacy row, every legacy field as a column + `raw jsonb`, `errors jsonb`, `status`, `migration_batch_id`, `tenant_id`, `created_by`, `import_batch_id`
- `migration_errors` (id, migration_batch_id, entity, row_number, field, message, severity, created_at)

Each table follows the project's GRANT + RLS + `set_tenant_id` trigger pattern (`tenant_id`, `current_user_can('settings','write')` for write, owner-only for delete).

## 2. Importer field-spec expansion

Edit `src/lib/import/types.ts` and `src/lib/import/aliases.ts`:

- Add every new field to the `customers`, `suppliers`, `products` entity specs with friendly labels and `help` text.
- Add ~60 new alias entries so common legacy headers ("Tax No", "Pay Terms", "Bank A/C", "GTIN", "Generic", "Mfg", "WhatsApp #", "Province", "Zip") auto-map.
- New entity `inventory` (multi-batch with manufacturing date + batch_supplier + purchase_ref) replacing the narrower `batches` template; the existing `batches` template stays as an alias for backwards compatibility.
- New entity `accounting_openings` covering Chart of Accounts + Customer Opening + Supplier Opening + Cash/Bank Opening in one combined or split-template flow.

## 3. Validators (`src/lib/import/validators.ts`)

Add the full rule set from the spec:
- Duplicate `customer_code` / `supplier_code` / `sku` within file and against DB (DB check via batched `select` in `posters.ts`).
- Email regex (already present), Pakistani phone normalizer (already present) — extend to `sms_mobile` and `whatsapp`.
- Missing city / address / product name / product code / batch / expiry — `required` flags on the relevant fields.
- Invalid expiry / past expiry (already present, override switch already in UI).
- Negative qty / negative opening balance — block.
- Duplicate `(sku, batch_number)` within file — already auto-merged for `batches`; same rule for `inventory`.

Every error attaches `{ field, message, severity }` and is written to `migration_errors` plus the existing `import_staging_rows.errors` jsonb for backward compatibility.

## 4. Wizard UI (`src/pages/MigrationWizard.tsx`)

The current 6-step wizard already implements: Select Data Type → Upload → Auto-detect → Manual Mapping → Validation → Preview → Import → Verification → Rollback. Changes:

- Add a "Pre-import snapshot" step that calls a new `migration_pre_snapshot()` RPC and saves `before_counts` on `migration_batches`.
- Verification step (already exists) gets new tiles per the spec: **Products / Customers / Suppliers / Batches / Opening Balances Imported · Failed Rows · Duplicate Rows · Missing Data Rows · Rollback Available**.
- Add a downloadable per-entity error CSV (already exists for failed rows, extend to include "missing data" and "duplicates" tabs).
- Show migration batch ID prominently and a copy-to-clipboard button.

## 5. Posters (`src/lib/import/posters.ts`)

- Map every new field through to the destination tables.
- Set `import_batch_id`, `tenant_id` (via trigger), `created_by` on every insert.
- Refuse to import "draft" transactions: filter out any sales/purchase invoice rows whose status field is `draft`/`pending`.
- For inventory rows, post one `goods_received_notes` (opening) + `grn_items` per (supplier, batch) group so existing stock triggers run normally — no direct writes to `stock_quantity`.

## 6. Audit & rollback

- The existing `rollback_import_batch` RPC stays. Add a parent `rollback_migration_batch(p_migration_id, p_reason)` that iterates the child `import_batches` in reverse posting order, then marks `migration_batches.status='rolled_back'`.
- Every step writes to `audit_log` via the existing `logAudit()` helper with the migration batch id.

## 7. Final verification report

After posting, the wizard already produces a per-entity report; this plan extends it to render and download the exact rows from the brief:

```
text
Products Imported      <n>
Customers Imported     <n>
Suppliers Imported     <n>
Batches Imported       <n>
Opening Balances       <n>
Failed Rows            <n>   ← CSV
Duplicate Rows         <n>   ← CSV
Missing Data Rows      <n>   ← CSV
Rollback Available     yes/no
```

## Files touched

- One new migration adding the columns, the staging tables (with GRANTs + RLS + tenant triggers), `manufacturing_date` on `grn_items`, and the `rollback_migration_batch` / `migration_pre_snapshot` RPCs.
- `src/lib/import/types.ts` — field-spec expansion + new entities.
- `src/lib/import/aliases.ts` — header alias expansion.
- `src/lib/import/validators.ts` — extra rules + duplicate-against-DB hook.
- `src/lib/import/posters.ts` — map new fields, route opening stock to GRN, write to new staging tables.
- `src/lib/import/templates.ts` — refreshed example templates with every column.
- `src/pages/MigrationWizard.tsx` — pre-snapshot step + extended verification tiles + duplicate/missing CSVs.
- `src/pages/DataImport.tsx` — render the new fields in mapping + preview.

## Out of scope (deliberate)

- Editing `auth`, `storage`, or any system schema.
- Importing draft / unposted transactions.
- Cross-tenant moves — tenant isolation is preserved end-to-end.
- Production data wipe — that lives behind the existing Danger Zone modal and is unrelated to this migration build-out.
