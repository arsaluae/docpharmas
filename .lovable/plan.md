## What's broken

1. **Duplicate close (X) button** on the Create Sales Order dialog. The shadcn `DialogContent` already renders an X in the top-right corner; `ProformaInvoices.tsx` (line 1121) adds a second custom X next to it.
2. **Sales agent sees no customers / no products / no existing sales orders or invoices.** Root cause is a mix of issues, not a single bug:
   - One of the two agent users (`role = 'staff'`, legacy alias) has **no `sales_agents` row** — backfill missed them, so `current_sales_agent_id()` returns NULL and triggers/RLS can't stamp them.
   - All 5 existing proforma invoices and 1 sales invoice were created **before** the `agent_id` triggers existed, so `agent_id IS NULL` on every legacy record. The "All customers" scope hides this, but the moment the admin flips scope to "Assigned customers only" those records vanish.
   - `ProformaInvoices.tsx` loads customers with `.eq("is_active", true)` and products with `.eq("is_active", true)`. The tenant has 187 active customers, so the dropdown *should* populate — but the dialog mounts before `load()` finishes when an agent opens the page fresh and `customers` state stays empty until the first list query returns. There's no skeleton/loader on the dropdown to make this visible.

## Fix plan

### A. Duplicate close button
- `src/pages/ProformaInvoices.tsx`: delete the custom `<Button …><X/></Button>` at line 1121–1123. Keep the existing `Badge` for credit-limit warning. Wire close-confirmation by intercepting the built-in shadcn close via the existing `onOpenChange` (already done at line 1102). No other dialog in the project has the same duplicate.

### B. Sales-agent end-to-end sync (single migration)
- **Backfill `sales_agents` for every `tenant_users` row whose `role IN ('sales_agent','staff')` that doesn't already have one** (covers the missing `staff` user and any future drift).
- **Backfill `agent_id` on legacy documents** (`proforma_invoices`, `sales_invoices`, `delivery_notes`, `sales_returns`, `warranty_invoices`, `payments` where `party_type='customer'`) where `agent_id IS NULL`:
  - If exactly one `sales_agents` row exists for the tenant → stamp that agent.
  - Else if `agent_customers` has a row for the document's customer → stamp the mapped agent.
  - Else leave NULL (admin-created, no owner).
- **Make the auto-stamp triggers also fire for `role='staff'`** (currently they only fire when `current_tenant_role() = 'sales_agent'`, so the legacy `staff` user creates orphan rows).
- **Add a one-row `company_settings` upsert** to guarantee `sales_agent_scope` defaults to `'all'` for tenants that never set it (so a brand-new agent isn't greeted with an empty list).

### C. Frontend visibility polish
- `ProformaInvoices.tsx`: show "Loading customers…" placeholder in the `SearchableSelect` while `customers.length === 0 && loading`, instead of the current "No results found." which looks like a permissions error.
- Same treatment for the product picker on each line row.
- Add a one-line empty-state hint under the customer picker when the agent truly has zero assigned customers: *"No customers assigned to you yet. Ask your admin to assign customers in Settings → Team."*

### D. Verification (manual after migration)
1. Log in as the sales-agent user → Sales Orders → click **Create Sales Order**. Confirm:
   - Only **one** X button in the top-right.
   - Customer dropdown lists all 187 active customers.
   - Product dropdown lists products on row add.
   - The 5 existing proforma orders and 1 sales invoice appear in the list pages.
2. Create a new sales order → confirm `agent_id` is auto-stamped to the agent's `sales_agents.id` (works for both `sales_agent` and `staff` roles).
3. In Settings → Sales Agent Scope, toggle to "Assigned only" → confirm only customers in `agent_customers` remain visible, and toggle back to "All" → full list returns.

## Files touched

- `src/pages/ProformaInvoices.tsx` — remove duplicate X, add loading/empty-state copy on customer + product pickers.
- New migration `supabase/migrations/<timestamp>_sales_agent_sync.sql` — backfill `sales_agents`, backfill `agent_id` on legacy docs, extend stamp triggers to `staff`, default `company_settings.sales_agent_scope`.

## Out of scope

- No change to RLS policies (they already handle scope='all' correctly).
- No change to `manage-tenant` edge function — provisioning of new agents already works; this plan only repairs historical data.
- No change to other dialogs — only `ProformaInvoices` has the duplicate X.
