## 1. Sidebar declutter — move secondary items into Settings → Operations

**Sidebar (`src/components/AppSidebar.tsx`)** — trim sections to essentials:
- **Sales**: Customers, Sales Orders, Warranty Invoices, Returns
- **Purchase**: Suppliers, Purchase Orders, Returns
- **Finance**: Payments, Credit Notes, Expenses, Staff & Salaries, Bank Accounts (unchanged)
- **Inventory**: unchanged

Removed from sidebar (still reachable via routes + Settings): Sales Agents, Couriers, Delivery Notes, Receive Payment, Make Payment.

**Settings page (`src/pages/Settings.tsx`)** — add a new **"Operations"** tab containing a grid of link cards: Sales Agents · Couriers · Delivery Notes · Receive Payment · Make Payment · Freight Providers (existing card moves here from Company tab).

## 2. Warranty Invoice — Sales Order 3-dots shortcut

**`src/pages/ProformaInvoices.tsx`** — in the row actions dropdown (only when order is `invoiced`/`dispatched`), add **"Create Warranty Invoice"**. Navigates to `/warranty-invoices?source_invoice=<id>`.

**`src/pages/WarrantyInvoices.tsx`** — on mount, if `?source_invoice=<id>` query param:
1. Auto-load that sales invoice + its items + customer.
2. Skip directly to `edit_items` step with all lines pre-filled: product, batch_number, expiry_date (from `grn_items` lookup), quantity, mrp, `tp_rate = mrp × 0.85`, amount.
3. User can trim/remove rows before saving.

No ledger/stock hit — warranty insert stays as-is (already dummy).

Also expose the same action on `src/pages/SalesInvoices.tsx` row 3-dots if that page is the one rendering invoiced rows (will verify on read).

## 3. Print Jobs — allotted supplier + factory stock split

**Migration** — alter `print_jobs`:
- `allotted_supplier_id uuid` (nullable) — supplier expected to receive finished goods.
- `quantity_dispatched_to_supplier numeric NOT NULL DEFAULT 0` — running total dispatched.
- `quantity_at_factory numeric GENERATED ALWAYS AS (quantity_delivered - quantity_dispatched_to_supplier) STORED` — auto-calc factory balance.

**`src/pages/PrintJobs.tsx`** — create/edit form additions:
- **Allotted Supplier** dropdown (from `suppliers`, searchable).
- New row action **"Dispatch to Supplier"** opens a dialog: shows `At Factory: <qty>`, lets user enter qty + date + note, increments `quantity_dispatched_to_supplier`, creates a `stock_movements` row (`purchase_in`) tagged with the supplier and batch so it lands in supplier inventory + landed costs as today.

New **Factory Stock** KPI strip at top of Print Jobs page: total pieces at factory, broken down per printer (small chip list). Example: order 5000 → delivered 5000 → dispatched 2000 → **at factory: 3000**.

## 4. Out of scope (explicit)

- No changes to ledgers/triggers beyond the new stock_movement insert on dispatch.
- No purchase-invoice "vendor=printer" support (you confirmed: print-job allotted supplier is what you wanted).
- No KPI strip redesign on Sales page (already done previously).

## Files

**Create**: none.
**Edit**: `src/components/AppSidebar.tsx`, `src/pages/Settings.tsx`, `src/pages/ProformaInvoices.tsx`, `src/pages/SalesInvoices.tsx`, `src/pages/WarrantyInvoices.tsx`, `src/pages/PrintJobs.tsx`.
**Migration**: 1 file — add 3 columns to `print_jobs`.
