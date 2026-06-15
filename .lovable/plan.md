## Problem
The merge is failing because your logged-in user is an active tenant `owner`, but has no matching `admin` row in the separate `user_roles` table. The merge RPC currently checks `has_role(user, 'admin')`, so it rejects the owner and shows “Only admins can merge suppliers”.

## Plan
1. **Add an owner-safe admin resolver**
   - Create/update a backend function that treats an active tenant `owner` as admin for that tenant.
   - Keep this server-side only; no local storage or frontend-only role checks.

2. **Backfill current owners**
   - Add missing `admin` entries in `user_roles` for existing active tenant owners, including your current owner account.
   - Do it with conflict protection so repeated migrations do not create duplicate role rows.

3. **Keep future owners synced**
   - Add a backend trigger/helper so any future active tenant `owner` automatically receives the `admin` app role.
   - If an owner is deactivated/demoted, avoid leaving merge permission unintentionally active.

4. **Update merge/unmerge RPC checks**
   - `merge_suppliers`, `merge_customers`, `unmerge_supplier`, and `unmerge_customer` will accept either:
     - explicit `admin` role, or
     - active tenant `owner` role for the tenant being merged.
   - Transaction movement remains intact: purchase invoices, purchase orders, returns, supplier products, payments, notes, landed costs, and aliases continue moving to the master supplier/customer.

5. **Verification**
   - Confirm your user now resolves as owner/admin.
   - Retry supplier merge with existing purchase invoices.
   - Confirm purchase invoices and ledger records point to the master supplier, old names/codes remain searchable through aliases, and undo remains available within 7 days.