

# Dashboard & Analytics Enhancement — Data Analyst Audit

## Current State Analysis

After reviewing every page, here's what exists and what's missing:

### What Exists
- **Dashboard**: 3 stat cards (week/month sales, gross margin), 8 quick-action buttons, top selling items list, top customers table, reorder alerts, AI insights CTA
- **Reports**: P&L, Balance Sheet, Cash Flow (bar chart), Receivables/Payables Aging, Product Costing, Item-wise, Customer-wise, Supplier-wise, Batch-wise, Tax
- **AI Insights**: Demand forecast, reorder alerts, slow movers, margin warnings, customer trends (all table-based, no charts)

### What's Missing — Charts & Visual Analytics

**Dashboard has ZERO charts.** For a world-class pharma ERP, the dashboard needs visual data storytelling. Every report page is also table-only (except Cash Flow which has one bar chart).

## Plan: Add Charts & Missing Analytics Elements

### 1. Dashboard — Add 6-Month Sales Trend Sparkline Chart
- Add a `LineChart` (recharts) showing daily or weekly sales for the last 30 days right below the 3 stat cards
- Data: group `sales_invoices.subtotal` by date for last 30 days
- Compact area chart with gradient fill, no axis labels — just the trend line with hover tooltip

### 2. Dashboard — Add Receivables vs Payables Donut
- Side-by-side mini donut/pie showing total receivables vs payables
- Replace or augment the "Top Customers" table with a visual receivables health indicator
- Shows at a glance if the business is cash-positive or overextended

### 3. Dashboard — Add Expense Breakdown Pie Chart
- Small pie chart showing this month's expenses by category
- Data already available from `expenses` table grouped by `category`

### 4. Dashboard — Add Monthly Comparison Bar
- This month vs last month sales comparison as a simple 2-bar chart
- Instantly shows growth/decline trend

### 5. Dashboard — Add Outstanding Payments Counter
- KPI card: total unpaid invoices count + amount
- KPI card: overdue invoices (past due_date) count + amount
- These are critical business health metrics currently invisible

### 6. P&L Report — Add Revenue vs Expenses Waterfall/Bar
- Visual bar chart showing Revenue → COGS → Gross Profit → Expenses → Net Profit as a waterfall
- Makes the P&L statement visually digestible

### 7. AI Insights — Add Sales Trend Charts
- The demand forecast table should have a mini bar chart per product showing last 3 months trend
- Customer trends should show a visual sparkline instead of just an arrow icon

### 8. Missing Business Features Found

| Gap | Impact | Priority |
|-----|--------|----------|
| No daily sales chart on dashboard | Can't see trends at a glance | High |
| No receivables health indicator | Overdue amounts invisible until you navigate to aging report | High |
| No expense visualization | Category spending patterns hidden | Medium |
| No month-over-month comparison | Growth/decline not visible | High |
| No overdue invoice alerts on dashboard | Cash flow risk hidden | High |
| Reports are all table-only (except Cash Flow) | Hard to digest patterns | Medium |
| No export to Excel on any report | Common business need | Medium |
| No date range filter on Customer-wise or Item-wise reports | Can't compare periods | Medium |
| No inventory value trend | Can't see if inventory is growing/shrinking | Low |

## Files to Change

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add: 30-day sales area chart, expense pie chart, month comparison bars, overdue invoices KPI cards, receivables/payables summary |
| `src/pages/reports/ProfitLoss.tsx` | Add waterfall bar chart visualization above the cards |
| `src/pages/AIInsights.tsx` | Add mini sparkline charts for demand forecast trends |

## Technical Approach
- Use `recharts` (already installed) — `AreaChart`, `PieChart`, `BarChart`, `Cell`
- All data fetched from existing tables, no new DB tables needed
- Dashboard `loadDashboard()` expanded to fetch: expenses by category, last month sales total, overdue invoice count, receivables/payables totals
- Charts use the pharma teal/violet/sage palette from `index.css` custom properties

## Dashboard Layout After Changes

```text
┌─────────────┬──────────────┬──────────────┬──────────────┐
│ Week Sales  │ Month Sales  │ Gross Margin │ Overdue Amt  │
└─────────────┴──────────────┴──────────────┴──────────────┘
┌──────────────────────────────────────────────────────────┐
│  30-Day Sales Trend (Area Chart)                         │
└──────────────────────────────────────────────────────────┘
┌─────────── Quick Actions (2x4 grid) ────────────────────┐
└──────────────────────────────────────────────────────────┘
┌───────────────────────┬──────────────────────────────────┐
│ Month vs Last Month   │ Expense Breakdown (Pie)          │
│ (Bar comparison)      │                                  │
└───────────────────────┴──────────────────────────────────┘
┌───────────────────────┬──────────────────────────────────┐
│ New Stock In          │ Top Selling Items                │
└───────────────────────┴──────────────────────────────────┘
┌───────────────────────┬──────────────────────────────────┐
│ Receivables Summary   │ Top Customers                    │
│ (mini donut)          │                                  │
└───────────────────────┴──────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│ Reorder Alerts + AI Insights CTA                         │
└──────────────────────────────────────────────────────────┘
```

