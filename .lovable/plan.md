# Fix Data Cleanup merge failure

## Root cause
The merge buttons all fail with HTTP 400:
`invalid input value for enum app_role: "owner"`

Inside `merge_suppliers`, `merge_customers`, `unmerge_supplier`, `unmerge_customer` the guard uses `has_role(v_user, 'owner'::app_role)`, but the project's `app_role` enum only contains `admin / moderator / user` (Owner = `admin` per project convention). PostgREST evaluates the cast before the function body runs, so every call is rejected without touching any data — that's why purchase invoices "block" the merge even though they aren't actually the cause.

## Fix (single SQL migration)

1. Recreate the four RPCs with `has_role(v_user, 'admin'::app_role)` instead of `'owner'`.
2. While rewriting `merge_suppliers`, also move two FK references that the current version misses, so future merges don't leave orphan rows pointing at a now-inactive supplier:
   - `additional_costs.vendor_id`
   - `expenses.supplier_id` (only if the column exists — guarded with `to_regclass` / `information_schema` check)
3. Keep all other logic identical (alias snapshot, balance roll-up, mark `is_merged/is_active=false`, audit log). Behavior, signature, and reversibility window stay the same.
4. No frontend changes — `DataCleanup.tsx` already surfaces the RPC error via toast, which is how we caught this.

## Verification
- Reload `/admin/data-cleanup`, click "Auto-merge obvious groups" for suppliers → expect success toast and rows flipping to merged.
- Pick a supplier group that has purchase invoices on a duplicate → merge → confirm PI list on master now includes those PIs (`select count(*) from purchase_invoices where supplier_id = <master>`).
- Click Undo on a merged row within 7 days → confirm rows revert.

## Files
- New migration recreating the 4 functions.
- No application code changes.
