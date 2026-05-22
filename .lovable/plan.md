## Wire ERP Hardening into UI

The DB-level fixes (constraints, neg-stock trigger, `is_active`, `void_document` RPC) are live. This plan wires them into the user-facing pages.

### 1. `is_active` toggle + filter on master-data pages
For `Customers`, `Suppliers`, `Products`, `Printers`, `SalesAgents`:
- Add a small "Active" switch column in the list table (toggles `is_active`).
- Add an "Active only" filter chip in the header (default ON).
- In every party/product `Select` used in document forms (Proforma, Purchase Proforma, GRN, Sales/Purchase Returns, Payments, Warranty), append `.eq("is_active", true)` when loading options. Existing already-saved documents still resolve their FK by id.

### 2. Void buttons in document rows
Add the `<VoidDocumentButton>` component to row actions on:
- `ProformaInvoices.tsx` (for the generated Sales Invoice — `table="sales_invoices"`)
- `PurchaseProforma.tsx` (for the generated Purchase Invoice — `table="purchase_invoices"`)
- GRN list inside `PurchaseProforma` hub (`table="goods_received_notes"`)
- `Payments.tsx` (`table="payments"`)
Show button only when `status !== 'voided'`. Refresh list `onDone`.

### 3. Visual treatment of voided rows
Across the four pages above: when `status === 'voided'`, render the row with `opacity-50 line-through text-muted-foreground` and a small `<Badge variant="destructive">Voided</Badge>`. Hide download/print actions on voided docs.

### 4. Friendlier negative-stock error
The new BD trigger raises `Insufficient stock for product <uuid>...`. Intercept this error on insert in `ProformaInvoices` (sales item save path) and `SalesReturns`, look up the product name from local state, and toast: `Insufficient stock for <name>. On-hand: X, requested: Y.`

### 5. Memory note
Append a short note to `mem://features/erp-hardening` describing the UI wiring.

### Files
- Edit: `Customers.tsx`, `Suppliers.tsx`, `Products.tsx`, `Printers.tsx`, `SalesAgents.tsx`, `ProformaInvoices.tsx`, `PurchaseProforma.tsx`, `Payments.tsx`, `SalesReturns.tsx`.
- No new files, no migrations.

### Out of scope
- Ledger automation triggers (deferred — current report fallback still works).
- Per-field validation polish (low priority).
- Expiry dashboard KPI (low priority).
