## Goal
Turn the existing `sales_agent` role into a fully usable, locked-down sales workspace by closing the gaps the exploration found, without forking pages. Reuse `/proforma`, `/customers`, `/customers/:id/ledger`, `/delivery-notes` and add two thin agent-only screens: **Stock Availability** and **Record Payment In**. Server-side RLS does the real enforcement; UI tweaks just hide cost/admin chrome.

## Decisions locked
- **Pages strategy:** reuse existing pages, scope by RLS, hide cost/admin in UI when role is `sales_agent`.
- **Payment recording:** new `payment_in` capability + dedicated `/collect-payment` page (no approval workflow in v1).
- **Customer scope:** tenant default via `company_settings.sales_agent_scope ∈ ('assigned','all')`, default `'assigned'`.
- **Agent ↔ auth user linkage:** in `SalesAgents` admin, allow both "Link existing team member" and "Invite new agent" (extends `manage-tenant` edge function).

---

## 1. Database migration (single approval)

**New / changed schema**
- `company_settings.sales_agent_scope text not null default 'assigned'` (`'assigned' | 'all'`).
- `company_settings.require_payment_in_approval bool default false` (placeholder, unused in v1 UI).
- `payments.agent_id uuid references sales_agents(id)`.
- `payments.source text default 'admin'` (`'admin' | 'agent_collection'`) for receipt UI.
- `delivery_notes.agent_id uuid references sales_agents(id)` + backfill from linked invoice.
- `sales_agents.user_id`: add **partial unique index** `(tenant_id, user_id) where user_id is not null` (link is one‑to‑one).
- `role_capabilities` rows for `sales_agent` cleaned up to the matrix below.

**New / updated security definer functions**
- `current_sales_agent_id()` → resolves `auth.uid()` → `sales_agents.id` in current tenant (cached `stable`). All agent RLS uses this.
- Update `is_agent_customer(p_customer_id uuid)`:
  - if `sales_agent_scope='all'` for tenant → `true` for any tenant customer
  - else → exists row in `agent_customers` for `(current_sales_agent_id(), p_customer_id)`
- `agent_can_record_payment(p_customer_id uuid)` — wraps `current_user_can('payment_in','create')` + `is_agent_customer(...)`.
- Auto-stamp triggers (BEFORE INSERT) on `proforma_invoices`, `sales_invoices`, `delivery_notes`, `payments`:
  - if `current_tenant_role()='sales_agent'` and column null, set `agent_id := current_sales_agent_id()`.
  - on `payments`, also set `source='agent_collection'`.

**RLS policies (added/replaced — keyed off role to avoid breaking admins)**

| Table | Sales-agent policy |
|---|---|
| `customers` | SELECT: tenant match AND (`role <> 'sales_agent'` OR `is_agent_customer(id)`) |
| `proforma_invoices`, `sales_invoices`, `delivery_notes` | SELECT/UPDATE: tenant match AND (`role <> 'sales_agent'` OR `agent_id = current_sales_agent_id()`) |
| same tables | INSERT (WITH CHECK): tenant match AND `is_agent_customer(customer_id)` AND capability ok |
| `payments` | INSERT: agent may insert only `type='received'`, `party_type='customer'`, `is_agent_customer(party_id)`, `bank_account_id IS NULL OR via current_user_can('payment_in','create')`; UPDATE/DELETE blocked for agent if `status='approved'` or `created_by <> auth.uid()` |
| `payments` | SELECT for agent: own collections (`agent_id = current_sales_agent_id()`) OR rows tied to assigned customers (read-only ledger lines) |
| `sales_invoice_items`, `proforma_invoice_items` | SELECT for agent only if parent invoice passes agent filter; `unit_cost` continues to live in row but UI hides it |
| `stock_movements`, `grn_items`, `products` | SELECT for agent restricted to non-cost columns via a **view** `agent_stock_availability` (see §4); base tables get a deny policy for `sales_agent` on SELECT |
| `purchase_*`, `expenses`, `bank_accounts`, `suppliers`, `supplier_*`, `salary_payments`, `chart_of_accounts`, `journal_*`, `additional_costs`, `landed_*`, `stock_audit_log`, `tax_records`, `staff`, `agent_commissions`, `document_templates`, `company_settings` (write), `tenant_users`, `tenants`, `backup_runs`, `audit_log` | SELECT/INSERT/UPDATE/DELETE policies updated to require `current_tenant_role() <> 'sales_agent'` |

**`role_capabilities` for `sales_agent` (replace)**

| Resource | r | w | v | a |
|---|---|---|---|---|
| `sales` | ✅ | ✅ | — | — |
| `master` | ✅ | — | — | — |
| `inventory` | ✅ (read-only via view) | — | — | — |
| `payment_in` *(new resource)* | ✅ | ✅ | — | — |
| `reports.sales_agent` *(new)* | ✅ | — | — | — |
| everything else | — | — | — | — |

All other roles keep their existing rows; `purchase`, `finance`, `settings`, `reports` (admin) remain denied.

---

## 2. Auth ↔ agent linkage (Settings → Sales Agents)

`src/pages/SalesAgents.tsx`
- Add **"Linked user"** column.
- Edit dialog gains two mutually exclusive options:
  1. **Link existing team member** — dropdown of `tenant_users` where `role='sales_agent'` and `user_id` not already linked. Saves `sales_agents.user_id`.
  2. **Invite new agent** — name + email; calls extended `manage-tenant` edge function (`action='invite_sales_agent'`) which creates the auth user, inserts `tenant_users(role='sales_agent')`, and returns the new `user_id` which we then write to `sales_agents.user_id` in the same save.
- Block save if the row has no `user_id` AND has any `agent_customers` rows (warning toast: "Link a login or RLS will hide this agent's data").

`supabase/functions/manage-tenant/index.ts`
- New action `invite_sales_agent` mirrors existing invite path but pins role to `sales_agent` and returns `{ user_id }`.

---

## 3. Navigation, dashboard, route guards

`src/components/AppSidebar.tsx`
- Replace the static section list with a role-aware build: when `currentTenantRole === 'sales_agent'`, render exactly:
  - Dashboard (`/`)
  - Customers (`/customers`)
  - Sales Orders (`/proforma`)
  - Sales Invoices (`/warranty-invoices` is admin-only — agents use sales invoice list via `/proforma → convert`; expose a new lightweight list at `/sales-invoices` reusing existing data table component, scoped by RLS)
  - Delivery Notes (`/delivery-notes`)
  - Stock Availability (`/stock-availability` — new agent-safe page)
  - Customer Ledger (`/customers` → row action; same `/customers/:id/ledger`)
  - Record Payment (`/collect-payment` — new)
  - My Reports (`/reports/agent` — new hub)
- Non-agent roles see the existing sidebar untouched.

`src/App.tsx`
- New routes guarded by capability, not hard-coded role:
  - `/stock-availability` → `RequireCap resource="inventory" action="read"` (sales_agent now has it)
  - `/collect-payment` → `RequireCap resource="payment_in" action="create"`
  - `/sales-invoices` → `RequireCap resource="sales" action="read"`
  - `/reports/agent` → `RequireCap resource="reports.sales_agent" action="read"`
- All existing `/purchase*`, `/expenses`, `/bank`, `/salaries`, `/sales-agents`, `/payments`, `/reports/*` (admin), `/settings*`, `/system-health`, `/import`, `/audit-log`, `/insights`, `/credit-notes`, `/debit-notes`, `/products`, `/stock`, `/stock-audit`, `/landed-costs`, `/accounting/*` keep their existing guards (already exclude `sales_agent`). `RequireCap` already redirects with a permission-denied toast — verify the toast text matches the spec ("You do not have permission to access this module.").

`src/pages/Index.tsx` already routes `sales_agent` → `SalesAgentDashboard`. Extend that dashboard:
- Add KPI cards: Today's Sales, Month Sales, Collections Today, Outstanding (assigned), Open Sales Orders, Pending Deliveries, Low Stock, Expiring Soon (30d).
- Sections: My Recent Orders, My Recent Invoices, My Collections, Customers to Follow Up (no invoice in 30d), Stock Alerts, Expiry Alerts.
- All queries rely on RLS scoping; no client-side `agent_id` filters required (server enforces).

---

## 4. Stock Availability page (`/stock-availability`)

- Backed by SQL view `public.agent_stock_availability` (security_invoker) selecting only: `product_id, code, name, category, brand, available_qty, batch_number, expiry_date, location, sale_price, stock_status, expiry_status`. **No cost/landed/profit/supplier columns.**
- Grant SELECT on the view to `authenticated`; underlying base-table RLS denies the agent direct access, so this view is their only window into stock.
- Page: searchable table with batch/expiry chips, "expires in N days" badge using same status logic as ProductExpiry report.

---

## 5. Record Payment In (`/collect-payment`)

- Form: customer (searchable, RLS-scoped to assigned), amount, method (cash/cheque/transfer), date, reference, notes, optional receipt image (Supabase Storage bucket `payment-receipts`, agent-write/own-read policy).
- Insert into `payments`: trigger fills `agent_id`, `source='agent_collection'`, `type='received'`, `party_type='customer'`, `created_by=auth.uid()`, `bank_account_id=null` (cash collections — admin reconciles later).
- Receipt print uses existing PdfPreviewDialog with a new template id `payment_in_receipt`.
- List below: agent's own collections, with print + view; edit/delete blocked once `status='approved'` (column already on `payments`).

---

## 6. UI tweaks on shared pages

When `currentTenantRole === 'sales_agent'`:
- `Products.tsx`, `ProductExpiry`, `StockMovements`, all reports — agent never reaches them (route guard), so no changes needed.
- `ProformaInvoices.tsx`, `SalesInvoices` (new agent list), `SalesInvoiceForm`:
  - Hide `unit_cost`, profit margin column, "Cost" totals row, supplier badges.
  - Hide "Approve / Void / Reopen" buttons.
  - Customer dropdown queries already RLS-scoped; add "(no assigned customers)" empty state with link to ask admin.
  - Credit-limit warning + customer outstanding chip already render — keep.
- `Customers.tsx`: hide "Add Customer", "Import", supplier toggle, and "Convert to Supplier" actions for agent.
- `CustomerLedger.tsx`: hide cost/profit/internal-notes columns; hide bank-balance widgets if any.
- `DeliveryNotes.tsx`: hide supplier columns; status toggles gated by capability flag `delivery_note.update_status` (already in resource `sales` write).

All hides driven by a single helper `useIsSalesAgent()` (wraps `useRoles().tenantRole`).

---

## 7. Cost/profit hardening (defence in depth)

- Even though routes block agents from `/products`, ensure `sales_invoice_items.unit_cost` is **never** sent to the client when role is `sales_agent`: create a view `sales_invoice_items_safe` excluding `unit_cost`, and switch agent-side queries (ProformaInvoices line render, agent SalesInvoices list) to read from the view. RLS on `sales_invoice_items` blocks `sales_agent` SELECT on the base table.
- Same treatment for `proforma_invoice_items` if it carries a cost column (check during implementation).

---

## 8. Dummy-user smoke test (after migration approved)

Use `supabase--insert` to seed in the user's tenant:
1. Create auth user `agent.test@docpharmas.com` via `manage-tenant invite_sales_agent`.
2. Create `sales_agents` row, link `user_id`.
3. Assign 2 existing customers via `agent_customers`.
4. Manual checklist in the chat for the user to run through (login as the dummy, walk the 18 acceptance items).

Provide the test credentials and checklist as the final deliverable.

---

## Files to change

**New**
- `src/pages/StockAvailability.tsx`
- `src/pages/CollectPayment.tsx`
- `src/pages/SalesInvoicesList.tsx` (agent-facing read view)
- `src/pages/reports/AgentReports.tsx` (hub linking to: My Sales Summary, My Sales Orders, My Sales Invoices, My Collections, My Customers Outstanding, Pending Deliveries, Customer Follow-up — all thin reuse of existing report components scoped by RLS)
- `src/hooks/useIsSalesAgent.ts`
- `supabase/migrations/<ts>_sales_agent_workspace.sql` (the big migration in §1)

**Edited**
- `src/App.tsx` — 4 new routes, guards
- `src/components/AppSidebar.tsx` — role-aware section list
- `src/components/dashboard/SalesAgentDashboard.tsx` — full KPI + sections rebuild
- `src/pages/SalesAgents.tsx` — linked-user UI, invite action
- `src/pages/ProformaInvoices.tsx` — hide cost/admin chrome for agent; switch to safe view
- `src/pages/Customers.tsx`, `src/pages/CustomerLedger.tsx`, `src/pages/DeliveryNotes.tsx` — agent UI hides
- `supabase/functions/manage-tenant/index.ts` — `invite_sales_agent` action
- `src/lib/rbac.ts` — matrix sync with new `payment_in` and `reports.sales_agent` resources

## Out of scope (explicit)
- Payment approval workflow (column exists, flag added, but no admin approval queue UI — can be added later).
- Commission auto-payout from `agent_commissions.payment_id` link.
- Mobile-specific layouts beyond the existing responsive patterns.
- Migrating legacy `staff` role users — they continue to work; new agents should be created as `sales_agent`.

---

## Acceptance criteria (mapped to your spec)
Every item in your "FINAL ACCEPTANCE CRITERIA" maps to: §1 (RLS + agent_id stamping + capabilities), §2 (linkage), §3 (sidebar + URL block), §4 (stock view hides cost), §5 (payment in), §6 (UI hides), §7 (cost defence in depth), §8 (dummy-user test). I will not declare done until the dummy-user walkthrough passes all 18 checks.
