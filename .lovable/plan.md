# Fix product picker, sales order prefix, and agent invoice header

## Root causes found (verified in the database)

**1. Products still don't show** — the three agent-facing views (`sales_product_catalog_view`, `agent_stock_availability`, `agent_batch_availability`) have **no GRANTs at all**. The previous fix removed `security_invoker`, but nobody can SELECT from them — every query returns a permission error, so the picker is empty for everyone using it.

**2. Sales order number shows "PI-"** — the `document_counters` row for sales orders has prefix `PI-`, and the `generate_document_number` function defaults to `PI-` for this document type.

**3. Company name missing on agent's invoice template** — `company_settings` (and `document_templates`) are protected by a restrictive policy requiring the `settings:read` capability. The `sales_agent` role has **no settings capability row**, so the template query returns zero rows for agents → "Company Name" placeholder.

## Fix (one migration, no frontend changes)

1. **Grant view access**
   - `GRANT SELECT` on all three views to `authenticated` (and `ALL` to `service_role`). Tenant isolation stays enforced inside each view via `tenant_id = get_user_tenant_id()`. Cost columns remain excluded, so agents still cannot see cost/profit data.

2. **Sales order prefix → SO-**
   - Update the existing counter row: prefix `PI-` → `SO-` (next order will be `SO-0006`; existing documents keep their old numbers).
   - Update the default in `generate_document_number` so new tenants also get `SO-`.

3. **Let agents read company branding**
   - Insert `role_capabilities` rows: `(sales_agent, settings, read-only)` and `(staff, settings, read-only)`.
   - This is server-side only — the client-side menu matrix is unchanged, so agents still don't see the Settings page; they just get the company name/address/logo on printed documents.

## Verification
- Open Create Sales Order as agent and as admin → product picker lists products with MRP, rate, stock, batches, expiry.
- Create a new sales order → number starts with `SO-`.
- Open a document preview as a sales agent → company name, address, phone, and logo appear in the header.
- Confirm agents still get zero rows querying `products` directly (cost stays hidden).