## Finish ERP Hardening Wiring

Most of the previous pass is already in place. Remaining gaps after re-scanning:

### 1. Friendly negative-stock errors on remaining write paths
The `prevent_negative_stock` DB trigger raises `Insufficient stock for product <uuid>: on-hand X, requested Y`. Only `ProformaInvoices.tsx` currently translates this into a friendly toast. Add the same interception (resolve product name from local state, show `Insufficient stock for <name> (requested <qty>)`) in:
- `src/pages/SalesReturns.tsx` — on `stock_movements` insert (`return_out` path during return-from-customer corrections).
- `src/pages/WarrantyInvoices.tsx` — on `sale_out` stock insert.
- `src/pages/StockMovements.tsx` — on manual `adjustment_out`, `damage`, `expired` inserts.

Pattern (already used in ProformaInvoices):
```ts
if (err?.message?.includes("Insufficient stock")) {
  const name = products.find(p => p.id === item.product_id)?.name ?? "product";
  toast.error(`Insufficient stock for ${name} (requested ${qty}).`);
  return;
}
```

### 2. Voided-row visual treatment on document lists
The `void_document` RPC already sets `status = 'voided'` on `purchase_invoices`, `goods_received_notes`, `payments`, `sales_invoices`. Apply consistent UI:
- `src/pages/PurchaseProforma.tsx` — for any row where `status === 'voided'`, add `opacity-50 line-through` to the row and hide WhatsApp/PDF action buttons; show a destructive `Voided` badge.
- `src/pages/Payments.tsx` — same styling (voided payments are hard-deleted by the RPC today, so this is primarily defensive for any soft-voided rows that still appear).

No new void buttons added — existing `promptVoid` cascade in PurchaseProforma and `Delete` in Payments already trigger the correct DB reversal triggers.

### 3. Memory update
Append to `mem://features/erp-hardening`: "Friendly Insufficient-stock toasts wired into SalesReturns, WarrantyInvoices, StockMovements. Voided-row styling on PurchaseProforma & Payments lists."

### Out of scope
- Couriers.tsx — read-only monthly report, no master-data CRUD.
- SalesAgents.tsx — already uses its own `status` enum.
- FreightProvidersCard — already has `is_active` toggle.
- New DB migrations, ledger triggers, expiry KPI.

### Files touched
`src/pages/SalesReturns.tsx`, `src/pages/WarrantyInvoices.tsx`, `src/pages/StockMovements.tsx`, `src/pages/PurchaseProforma.tsx`, `src/pages/Payments.tsx`, `mem://features/erp-hardening`.