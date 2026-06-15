## Master Data Sync + Duplicate Merge System

Goal: end the duplicate-supplier / fragmented-contact problem with one cohesive system — fix the contact-import write-back, ship a reversible Data Cleanup hub, and prevent new duplicates at the import layer.

---

### Part 1 — Customer contact import sync (the real fix)

Symptom: wizard shows "matched" but `customers.sms_mobile` / `phone` / `contact_person` never change and the Customer List still shows old data.

Fixes in `src/pages/ContactImportWizard.tsx` + `src/lib/import/contacts.ts`:

- After insert into `customer_contacts`, run the customer write-back in the **same batch** (not as a side effect that can fail silently). Today the update is best-effort and uses fields that don't always exist — switch to a verified payload.
- Re-confirm column names against `customers`: write to `sms_mobile`, `phone`, `contact_person`, `email`, and bump `updated_at`.
- Honor the existing bulk toggle (`overwrite` / fill-blanks-only) per field. When `overwrite=false` and customer field is non-empty, the imported number is still stored in `customer_contacts` as an additional contact.
- On the first contact for a customer set `is_primary=true` automatically; subsequent imports never auto-flip primary.
- Stamp `source='import'` and `import_batch_id` on every inserted contact row.
- After `runImport` completes, invalidate the customers cache and emit a `customer:updated` event so open lists / profile dialogs refetch immediately.

Schema touch-ups for `customer_contacts` (migration): add `whatsapp text`, `source text default 'manual'`, `import_batch_id uuid`, `created_by uuid`. RLS unchanged, GRANTs added.

Display fixes (read-side):
- `Customers.tsx` list row: show `sms_mobile` first, fall back to primary contact's mobile if the customer field is empty.
- `CustomerProfileDialog` already mounts `CustomerContactsCard` — add a "Source" badge (manual / import + batch link) and an Edit-primary action.
- Sales order / invoice customer pickers (`SearchableSelect` consumers): include `sms_mobile` and primary-contact mobile in the searchable string and display.
- `WhatsAppButton` / `whatsapp-share`: prefer `customers.sms_mobile` → primary contact's `whatsapp` → primary contact's `mobile`.

Post-import summary additions: `customers_primary_updated`, `additional_contacts_added`, `duplicates_skipped`, `failed`.

Acceptance: run the existing wizard with a sample sheet → imported numbers appear in Customer List, Customer Profile contacts, sales-order customer picker, and the WhatsApp button uses the new number.

---

### Part 2 — Normalization function (shared)

New SQL function `normalize_party_name(text)` used by suppliers, customers, and the duplicate detector. Rules: lowercase, trim, collapse whitespace, strip punctuation, strip trailing `copy`, `copy N`, `duplicate`, `\(\d+\)`, and strip filler tokens: `m/s`, `ms`, `pvt`, `ltd`, `limited`, `pharma`, `pharmaceutical`, `pharmaceuticals`, `distributor`, `distributors`, `distribution`, `enterprise`, `enterprises`, `traders`, `trading`, `sons`, `brothers`, `supplier`, `suppliers`, `company`, `co`. Also strip a single trailing number when it's a 1–2 digit "copy N" token, but keep numbers that are part of the actual name (heuristic: keep if name has ≥ 3 alphabetic tokens before the number).

Replaces the existing `normalize_supplier_name` (which only stripped a few tokens). The supplier dup-guard trigger added earlier is repointed at the new function.

---

### Part 3 — Aliases + soft-merge schema (reversible 7 days)

New migration:

```text
suppliers / customers:
  + merged_into_id  uuid  (self-FK, null = active master)
  + is_merged       bool  default false
  + merged_at       timestamptz
  + merged_by       uuid
  + merge_reason    text
  + normalized_name text  (generated via trigger using normalize_party_name)
  + (already has is_active — flipped to false on merge)
  index on (tenant_id, normalized_name)
  index on (tenant_id, merged_into_id)

supplier_aliases / customer_aliases:
  id, tenant_id, master_id, old_id, old_code, old_name,
  old_normalized_name, merge_reason, merged_by, merged_at,
  reversible_until timestamptz  (merged_at + 7 days)
```

GRANTs to `authenticated` + `service_role`; RLS via `get_user_tenant_id()`.

---

### Part 4 — Merge RPC (server-side, atomic, reversible)

`merge_suppliers(master_id uuid, duplicate_ids uuid[], reason text)` — `SECURITY DEFINER`, owner-only via `has_role`. Inside one transaction:

1. Validate all ids share tenant + are not already merged.
2. `UPDATE` foreign keys from each duplicate → master, across: `purchase_invoices`, `purchase_orders`, `purchase_proformas`, `purchase_returns`, `goods_received_notes`, `payments` (supplier side), `expenses` (supplier_id), `supplier_products`, `product_landed_costs`, `stock_movements` (supplier_id), `additional_costs`, `debit_notes`, plus `customer_contacts`-style satellite tables if any.
3. Move any non-conflicting contact rows; dedupe by mobile.
4. Insert `supplier_aliases` rows (one per duplicate) capturing old code/name + `reversible_until = now() + 7 days`.
5. Mark duplicates `is_merged=true, is_active=false, merged_into_id=master, merged_at, merged_by`.
6. Sum balances onto master, refresh master `updated_at`.
7. Insert `audit_log` rows: `supplier.merged` per duplicate.

`unmerge_suppliers(master_id, duplicate_ids)` — only succeeds when `reversible_until > now()` for every alias; reverses FK moves using the alias snapshot.

Mirror RPCs for customers: tables touched include `sales_invoices`, `sales_invoice_items` (via header), `proforma_invoices`, `delivery_notes`, `sales_returns`, `payments` (customer side), `warranty_invoices`, `customer_contacts`, `customer_distributors`, `customer_licenses`, `customer_products`, `agent_customers`, `credit_notes`.

---

### Part 5 — Detection RPC + obvious-case auto-merge

`detect_supplier_duplicates(tenant uuid)` returns groups: rows sharing `normalized_name` OR shared mobile/phone/NTN. Each group includes per-row counts pulled from a CTE (invoices / POs / payments / products / balance).

"Obvious" = same `normalized_name` AND (same normalized mobile OR same supplier_code prefix OR exact original-name match ignoring case/whitespace). On first run of the cleanup screen, admin clicks "Auto-merge obvious groups" → backend picks master (most transactions, tiebreak oldest `created_at`) and runs `merge_suppliers` for each. Non-obvious groups stay listed for manual review.

Same pattern for `detect_customer_duplicates`.

---

### Part 6 — Admin → Data Cleanup UI

New route `/admin/data-cleanup` with two tabs: **Suppliers** and **Customers**. Owner-only via `RequireCap`.

Per group card:
- Group header: normalized name, member count, "Auto-pick master" button.
- Member rows with code, mobile, address, city, balance, invoice/PO/payment/product counts, created date, import batch.
- Radio to pick master; checkboxes for which duplicates to merge; "Keep separate" and "Ignore group" actions (persist ignore in a `duplicate_ignores` table so it doesn't reappear).
- Pre-merge confirm dialog: lists exact record counts that will move + 7-day undo notice.
- Top bar: "Auto-merge obvious groups" with count badge.
- Merged tab: groups within 7-day window with "Undo merge" button.

---

### Part 7 — Import duplicate prevention

`src/lib/import/posters.ts` already skips name-dupes; extend to also check aliases + mobile + normalized-name match, and return statuses: `created | updated_existing | matched_existing | duplicate_review | skipped | failed`. Rows in `duplicate_review` surface in the existing import verification step so admin chooses master or "create new".

Customer import gets the same treatment (currently weaker).

---

### Part 8 — Cross-workable search (aliases route to master)

- `searchSupplierIds` / `searchCustomerIds` in `src/lib/search-helpers.ts`: also query `supplier_aliases.old_name`/`old_code` and `customer_aliases.*` and return the master id. Result list is deduped.
- Add a Postgres view `v_supplier_lookup` (`id, label, search_text`) that left-joins aliases for use in pickers; pickers in PO / PI / Ledger / Reports switch to this view.
- Active filters in Suppliers / Customers list pages exclude `is_merged=true` by default with a toggle to "Show merged".

---

### Part 9 — Report consolidation

Reports already query by `supplier_id` / `customer_id` — once FKs are moved by merge they aggregate correctly. Two extras:
- Supplier/Customer ledger: filter out `is_merged=true` rows from the master picker, but allow viewing a merged record (read-only banner: "Merged into X on date").
- Aging + performance reports: add `WHERE is_merged = false` on the master-list side.

---

### Part 10 — Sandbox tests

Extend `supabase/functions/run-sales-agent-uat` (or a new `run-data-cleanup-uat`) with:
1. Seed ABC, ABC copy 1, ABC 2 with one PI + one payment each → merge → assert 3 PIs and 3 payments on ABC, 0 on duplicates, aliases present, search "ABC copy 1" returns ABC.
2. Seed two duplicate customers with sales invoices → merge → assert ledger consolidated.
3. Contact import: import 5 rows → assert `customers.sms_mobile` populated, `customer_contacts` rows linked, WhatsApp link uses new number.

---

### Files

Frontend
- `src/pages/ContactImportWizard.tsx`, `src/lib/import/contacts.ts` — write-back fix + summary
- `src/lib/import/posters.ts` — supplier + customer dup-aware posting
- `src/pages/admin/DataCleanup.tsx` (new) + `src/components/cleanup/*` (group card, merge dialog, undo button)
- `src/App.tsx` — route + sidebar entry (owner-only)
- `src/components/AppSidebar.tsx` — "Data Cleanup" nav under Admin
- `src/lib/search-helpers.ts` — alias-aware search
- `src/components/SearchableSelect.tsx` consumers in PO/PI/Sales pickers — switch to alias-aware lookup view
- `src/components/WhatsAppButton.tsx` / `src/lib/whatsapp-share.ts` — phone resolution fallback
- `src/pages/Customers.tsx`, `src/components/CustomerProfileDialog.tsx` — show primary mobile from contacts when customer field blank; "Source" badge
- Reports list pages — `is_merged` filter
- `src/lib/audit.ts` — new event types

Backend (one migration)
- `normalize_party_name` function (replaces `normalize_supplier_name`, trigger repointed)
- `customer_contacts` columns: `whatsapp`, `source`, `import_batch_id`, `created_by`
- `suppliers` + `customers`: `merged_into_id`, `is_merged`, `merged_at`, `merged_by`, `merge_reason`, `normalized_name` (+ trigger + index)
- `supplier_aliases`, `customer_aliases`, `duplicate_ignores` tables (+ GRANT + RLS)
- RPCs: `detect_supplier_duplicates`, `detect_customer_duplicates`, `merge_suppliers`, `merge_customers`, `unmerge_suppliers`, `unmerge_customers`, `auto_merge_obvious_suppliers`, `auto_merge_obvious_customers`
- View: `v_supplier_lookup`, `v_customer_lookup`

Memory
- New `mem://features/data-cleanup-and-merge` describing the merge/alias model, 7-day undo, normalize rules, and alias-aware search.

### Validation

- Contact import: insert 10 rows, assert customer list + profile + sales-order picker + WhatsApp all show new number.
- Supplier merge: run on the existing ABC duplicates, confirm PI/PO/payment counts move and search by old name resolves to master.
- Customer merge: same flow on a seeded duplicate.
- Undo: trigger `unmerge_suppliers` within 7 days, confirm FKs return and aliases removed; after 7 days the RPC refuses.
- Import dup prevention: re-run an old supplier sheet, expect 0 new rows and `matched_existing` statuses.
