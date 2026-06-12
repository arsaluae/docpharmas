# Add Products entry to the sales-agent sidebar

## Issue
The sales agent's left sidebar uses a dedicated flat nav (`salesAgentNav` in `src/components/AppSidebar.tsx`) that lists "Stock Availability" but no "Products" link. The agent can't reach the Products page (`/products`) from the sidebar even though:
- The route is registered in `App.tsx` under `RequireCap resource="inventory" action="read"`.
- `sales_agent` has `inventory: read = true` in `src/lib/rbac.ts`.
- The Products page already loads via `sales_product_catalog_view` for agents (no cost exposure).

## Change
**`src/components/AppSidebar.tsx`** — insert a `Products` item into `salesAgentNav` right after `Sales Invoices` (keeps Stock Availability as well so they have both the catalog and the per-batch availability list):

```ts
{ title: "Products",           url: "/products",             icon: Package },
```

No other file changes needed — Products page already renders the catalog correctly for agents.

## Verification
1. Log in as the sales agent → "Products" appears in the left sidebar.
2. Click it → product list loads with code, name, MRP, sale price, available stock, batch count, nearest expiry. No cost column.
3. Edit/Delete/+New buttons stay hidden for the agent (existing `readOnly` gating).
