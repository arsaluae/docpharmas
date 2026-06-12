## Plan: Hide Cost/Profit/Margin Data for Sales Agent Role

### Scope
Gated by the `sales_agent` / `staff` role. Other roles see everything unchanged.

### 1. Products Page — Catalog Tab
- **Table columns**: Hide **Cost** and **Margin** columns when user is a sales agent.
- **Add/Edit product form**: Hide the **Cost Price (PKR)** input field.
- The `selling_price`, `mrp`, `gst_rate`, and stock fields remain visible (agents need selling prices to create orders).

### 2. Products Page — Stock Overview Tab
- No cost fields exist here; no changes needed.

### 3. Products Page — Movements Tab
- No cost fields exist here; no changes needed.

### 4. ProformaInvoices Editor
- After audit, the create/edit item tables contain **no cost/profit/margin columns** today (columns are: #, Product, MRP, Qty, Rate, Disc%, GST%, Line Total). No changes needed.
- The `last_price` hint shows the previous **selling rate**, not cost — this stays visible so agents can price consistently.

### 5. Dashboard / Other Sales-Agent Routes
- `StockAvailability` already uses agent-scoped views with no cost columns.
- `SalesAgentDashboard` already excludes cost/margin/P&L data.
- `CollectPayment` has no cost fields.
- No additional changes needed.

### Implementation Detail
- Use `useRoles()` → `role` to check `isSalesAgentRole(role)` from `@/lib/rbac`.
- Conditionally render table `<TableHead>` cells and form inputs based on this flag.
- No database or RLS changes required; this is pure UI gating.

### Files to Touch
- `src/pages/Products.tsx`
- `src/lib/rbac.ts` (already exports `isSalesAgentRole`)

### Not in Scope
- Print/PDF templates (those are generated server-side or from shared HTML builders; cost data is not currently rendered on sales-agent documents).
- Reports pages (sales agents cannot access reports except `/reports/agent`).