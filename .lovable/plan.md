# Verify and harden the sales agent product picker

## What I confirmed is already fixed (database)

- All three agent views (`sales_product_catalog_view`, `agent_stock_availability`, `agent_batch_availability`) now have the correct read permissions — a live API test returned HTTP 200 with the exact columns the picker requests.
- Your tenant has 187 active products, and the sales agent account is active and properly linked.
- The earlier "permission denied" that emptied the picker is gone. **A fresh login (or hard refresh) as the agent is required** because the old session cached the failed state.

## Remaining work (frontend hardening + verification)

1. **Surface fetch errors instead of silently showing an empty picker**
   - In `src/pages/ProformaInvoices.tsx`, the product query currently ignores errors (`if (prod.data) ...`). Add error handling: if the product fetch fails, show a toast ("Couldn't load products — please refresh") and log the error so this never silently appears as "no products" again.
   - Apply the same to the batch availability fetch used for batch/expiry selection.

2. **Force fresh data on dialog open**
   - Re-fetch the product list every time the Create Sales Order dialog opens (no stale cached empty result from before the fix).

3. **End-to-end browser verification**
   - Open the preview, log in, open Create Sales Order, and confirm:
     - Product picker lists products with code, MRP, rate, and stock.
     - Selecting a product shows its batches with expiry dates.
     - New order number starts with `SO-`.
   - If you can share the agent test login (or just re-test yourself after the change), we confirm the agent view specifically.

## Technical notes

- No further database changes needed — grants, view ownership, tenant isolation, and role capabilities are all verified correct.
- Cost columns remain hidden from agents (views exclude them; base `products` table stays blocked for agents).
