# Fix Sales Agent module: data visibility + safe product catalog

## Root cause (confirmed in the database)

Two **restrictive `ALL` policies** block the sales agent at the database level, regardless of scope settings or backfills:

1. `sa_restrict_customers_modify` on `customers` — written to block *edits*, but because it's an `ALL` restrictive policy it also blocks **SELECT**. Result: agent sees **zero customers**, even with scope = "All customers".
2. `sa_deny_products` on `products` — blocks **all** product reads for agents. Result: empty product dropdown everywhere.

Everything else (tenant scoping, `agent_id` stamping, historical backfill, `sales_agent_scope='all'`) is already correct.

## Plan

### 1. Database migration

**Customers — restore read, keep writes locked:**
- Drop `sa_restrict_customers_modify` and recreate it as write-only restrictions (INSERT / UPDATE / DELETE), so the existing SELECT policies (`sa_restrict_customers_select` + `agent_scope_customers`) govern reads. Agent immediately sees all company customers (or assigned-only when scope is switched) — same live `customers` table, no duplicates.

**Products — keep cost data hidden, expose a safe catalog:**
- Keep `sa_deny_products` (this is what guarantees agents can never read `cost_price` / purchase cost at DB level).
- Reuse/extend the existing safe views (these already exclude all cost fields and are tenant-filtered server-side):
  - `agent_stock_availability` → product_id, code, name, category, brand, unit, pack size, sale price, MRP, available stock, stock status
  - `agent_batch_availability` → batch number, expiry date, expiry status, per-batch available qty, sale price
- Add `location` to the catalog view if present on products, and verify SELECT grants for `authenticated` on both views.

No new tables. Customers, orders, invoices, delivery notes, payments all stay on the same shared tables — admin and agent see the same live rows instantly.

### 2. Frontend changes

**`ProformaInvoices.tsx` (sales order / invoice form):**
- When the user is a sales agent, load the product picker from `agent_stock_availability` instead of `products`; load batch options + expiry from `agent_batch_availability`.
- After selecting a customer, show a detail strip: mobile, city, address, current outstanding, credit limit (data now flows since customers are readable).
- After selecting a product: show code, sale price, available stock, batch/expiry options.
- Empty states with the exact copy requested ("Customers are not visible because customer access is restricted…", "Products are not visible because product access is restricted or stock is unavailable.").

**`Products.tsx`:** when agent, source the read-only list from `agent_stock_availability` (cost/margin columns already hidden in UI; this makes the data load again).

**Other agent-reachable pages that query `products` directly** (Delivery Notes, Sales Returns, customer profile dialog): switch to the safe view when the role is agent.

No changes needed for orders/invoices/payments sync — agents' documents already carry `agent_id`/`created_by` and appear in admin lists, and admin-created data is on the same tables.

### 3. Verification (against your test list)

Using SQL session simulation of the agent user:
1. Agent SELECT on customers returns all 435 company customers with phone, city, address, balance, credit limit.
2. Agent SELECT on the catalog view returns 187 products with stock, batch, expiry, sale price — and **no** cost columns exist in the view.
3. Agent direct SELECT on `products`/`purchase_invoices`/`expenses`/`bank_accounts` returns zero rows (denied).
4. In the preview: agent creates a sales order → appears in admin list with agent stamped; invoice posting reduces stock and updates the customer ledger (existing triggers, unchanged).
5. Admin edits a customer → agent sees the update on refresh (same table).

## Technical notes

- The fix is ~90% one migration (policy correction) + targeted frontend data-source swaps; no schema or trigger changes.
- The `staff` login in your workspace is currently deactivated (`is_active=false`); the active `sales_agent` login is the one being fixed.
