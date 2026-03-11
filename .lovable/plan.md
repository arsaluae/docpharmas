

# Sales Commission Agent System

## Overview

Add a full sales commission agent module: agent master data, customer-agent allocation, auto-selection on orders, and a monthly commission report with flexible payout (percentage or fixed).

---

## Database Changes (4 new tables, 2 column additions)

### New Tables

1. **`sales_agents`** — Agent master data
   - `id`, `name`, `phone`, `email`, `address`, `status` (active/inactive), `commission_type` (percentage/fixed), `commission_rate` (numeric), `tenant_id`, `created_at`

2. **`agent_customers`** — Which customers belong to which agent
   - `id`, `agent_id` (FK → sales_agents), `customer_id` (FK → customers), `tenant_id`, `created_at`
   - Unique constraint on (agent_id, customer_id)

3. **`agent_commissions`** — Monthly commission records (calculated & issued)
   - `id`, `agent_id`, `month` (text, e.g. "2026-03"), `total_sales`, `commission_amount`, `commission_type`, `commission_rate`, `status` (pending/paid), `payment_id` (nullable FK → payments or salary_payments), `notes`, `tenant_id`, `created_at`

### Column Additions

4. **`proforma_invoices`** — Add `agent_id uuid nullable` (auto-populated from agent_customers)
5. **`sales_invoices`** — Add `agent_id uuid nullable` (carried over on conversion)

All tables get standard tenant RLS policies and `set_tenant_id` triggers.

---

## Frontend Changes

### 1. New Page: `src/pages/SalesAgents.tsx`
- Tabs: **Agents** | **Customer Allocation** | **Commission Report**
- **Agents tab**: CRUD for agents (name, phone, commission_type, commission_rate)
- **Customer Allocation tab**: Select agent → assign/remove customers (multi-select). Shows current allocations in a table.
- **Commission Report tab**: Month picker → shows each agent's total sales, commission earned, status (pending/paid). Button to mark as paid.

### 2. Edit: `src/pages/ProformaInvoices.tsx`
- On customer selection in the create/edit form, auto-lookup `agent_customers` for that customer
- If found, auto-populate a read-only "Sales Agent" field (with option to override)
- Pass `agent_id` into both `proforma_invoices.insert` and `sales_invoices.insert` on conversion

### 3. Edit: `src/components/AppSidebar.tsx`
- Add "Sales Agents" under the **Sales** section with a `Users` icon

### 4. Edit: `src/App.tsx`
- Add route `/sales-agents` → `SalesAgents`

### 5. Edit: `src/pages/Salaries.tsx`
- Add a new tab "Commissions" that mirrors the Commission Report view (or links to `/sales-agents?tab=commissions`)

---

## Auto-Selection Flow

```text
User selects Customer → query agent_customers for customer_id
  → if match found, set agent_id and show agent name
  → user can still override or clear
Order saved with agent_id → carried to sales_invoice on conversion
```

## Commission Calculation

On the Commission Report tab, for a selected month:
1. Query `sales_invoices` where `agent_id` is set and `date` falls in that month
2. Sum totals per agent
3. Apply each agent's `commission_type` and `commission_rate`
4. Display and allow "Issue Commission" (creates a record in `agent_commissions`)

---

## Files Summary

| File | Action |
|------|--------|
| Database migration | **Create** 3 tables + add 2 columns |
| `src/pages/SalesAgents.tsx` | **Create** — Full agent management page |
| `src/pages/ProformaInvoices.tsx` | **Edit** — Auto-select agent on customer pick |
| `src/components/AppSidebar.tsx` | **Edit** — Add sidebar link |
| `src/App.tsx` | **Edit** — Add route |
| `src/pages/Salaries.tsx` | **Edit** — Add commissions tab/link |

