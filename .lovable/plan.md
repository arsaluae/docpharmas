The merge error is confirmed: the live backend functions still contain `updated_at = now()` inside `merge_suppliers` and `merge_customers`, but both `suppliers` and `customers` do not have an `updated_at` column.

Plan:

1. Recreate the live merge functions
   - Update `merge_suppliers` and `merge_customers` in a new migration.
   - Remove only the invalid `updated_at = now()` assignments.
   - Keep the existing owner/admin permission check.
   - Keep the merge audit log and alias/undo tracking.

2. Keep invoice-safe movement intact
   - Supplier merge will continue moving existing linked records to the master supplier, including purchase invoices, purchase orders, returns, payments, additional costs, supplier products, GRNs, product landed costs, and print allocations.
   - Customer merge will continue moving linked sales invoices, returns, proformas, delivery notes, warranty invoices, contacts, payments, credit/debit notes, products, licenses, distributors, and agent mappings.

3. Verify ownership/admin access
   - Confirm active tenant owners are treated as admins server-side.
   - Confirm existing owners already have the `admin` application role backfilled.

4. End-to-end validation after migration
   - Check the function definitions no longer reference `updated_at` on suppliers/customers.
   - Verify the schema still confirms those columns do not exist.
   - Test a real merge path from the app or via the backend RPC using the logged-in preview user where possible.
   - Confirm the original error no longer appears.

Technical detail:
- This is a backend-only migration. No frontend changes are needed unless testing reveals a separate UI issue.
- I will not add `updated_at` columns just to silence the error, because that would change the table schema unnecessarily. The safer fix is to remove the invalid column writes from the merge RPCs.