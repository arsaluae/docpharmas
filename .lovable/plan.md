## Extend ERP Hardening UI to remaining surfaces

Wire the existing `is_active` + void infrastructure into the pages that were skipped in the previous pass, plus tighten a few document workflows.

### 1. Active toggle on remaining master-data pages
- `src/pages/Printers.tsx` and `src/pages/SalesAgents.tsx`: add the same "Show inactive" `Switch`, `Power` toggle column, and `opacity-50` row styling already used on Customers/Suppliers/Products.
- `src/pages/Couriers.tsx` (if present): same treatment.
- In any select/dropdown that loads printers, sales agents, or couriers for new documents, append `.eq("is_active", true)`. Existing rows still resolve by id.

### 2. Void buttons on remaining document lists
Add `<VoidDocumentButton>` to row actions and hide download/print + apply voided styling (`opacity-50 line-through` + destructive badge) when `status === 'voided'`:
- `PurchaseProforma.tsx` → `purchase_invoices`
- GRN list page → `goods_received_notes`
- `Payments.tsx` → `payments`

(ProformaInvoices already has its own `promptVoid` and stays unchanged.)

### 3. Friendly negative-stock errors elsewhere
Apply the same "Insufficient stock for <name>" toast interception used in `ProformaInvoices.tsx` to:
- `SalesReturns.tsx` (return_out)
- `WarrantyInvoices.tsx` (sale_out)
- Any stock adjustment / damage / expiry write paths

### 4. Memory update
Append a short note to `mem://features/erp-hardening` listing the additional pages now wired up.

### Out of scope
- New DB migrations (none needed; uses existing `is_active`, `void_document` RPC, `prevent_negative_stock` trigger).
- Ledger automation triggers.
- Expiry dashboard KPI.
