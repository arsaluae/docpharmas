---
name: Data Cleanup & Merge
description: Reversible supplier/customer merge with aliases, alias-aware search, normalize_party_name, 7-day undo, Data Cleanup page at /admin/data-cleanup (owner only)
type: feature
---

Normalization (`public.normalize_party_name`) lowercases, strips punctuation,
"copy" / "copy N" / "duplicate" / "(N)" suffixes, business fillers (m/s, pvt,
ltd, pharma, pharmacy, distributors, traders, enterprises, sons, brothers,
medical, store, surgical, etc.) and a trailing 1–2 digit "ABC 2" number when
the name still has 2+ alpha tokens. `normalize_supplier_name` is now a wrapper
that delegates to this, so the existing pre-insert duplicate guard uses the
stronger rules.

`suppliers` and `customers` carry: `merged_into_id`, `is_merged`, `merged_at`,
`merged_by`, `merge_reason`, generated `normalized_name`. Merging sets
`is_active=false` so the existing list pages hide them automatically (toggle
"Show inactive" to see).

`supplier_aliases` / `customer_aliases` capture each duplicate's old id, code,
name + a `reversible_until = merged_at + 7 days`. Search helpers in
`src/lib/search-helpers.ts` query aliases too and return the master id so old
names/codes resolve correctly. `v_supplier_lookup` / `v_customer_lookup` views
expose the same alias-aware search blob.

RPCs (all owner-only via `has_role`, SECURITY DEFINER):
- `detect_supplier_duplicates()` / `detect_customer_duplicates()` — return
  groups (rows sharing `normalized_name`) + per-row PI/PO/payment/product
  counts, skipping rows in `duplicate_ignores`.
- `merge_suppliers(p_master, p_duplicates[], p_reason)` / `merge_customers(...)`
  — atomically move every supplier_id / customer_id / party_id FK onto master,
  insert aliases, mark duplicates merged+inactive, sum balances, audit.
- `unmerge_supplier(p_old_id)` / `unmerge_customer(p_old_id)` — only succeed
  when `reversible_until > now()`; restore the duplicate to active.

Admin → Data Cleanup (`/admin/data-cleanup`, owner-only sidebar entry):
two tabs (Suppliers / Customers) showing detection groups with per-row
counts, radio-pick master + checkbox dupes, "Auto-merge obvious groups"
(same normalized name + same code or same phone), per-group "Ignore"
(persists to `duplicate_ignores`), and "Undo" on merged rows.

Contact import sync fix: `ContactImportWizard.runImport` now always populates
`primaryContactForSync` with the first non-empty imported row per customer
(not only when the customer had zero existing contacts), then re-fetches
the customer record so "fill blanks only" sees real values before pushing
`sms_mobile` / `contact_person` / `phone` / `email` back onto the customer.
`Customers.tsx` list also prefers `sms_mobile` over the legacy comma-list
`phone` column when rendering.

`customer_contacts` gained `whatsapp`, `import_batch_id`, `created_by`.
`source` already existed and is stamped `'import'` by the wizard.
