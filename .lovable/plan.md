

# Plan: AI-Powered Insights Dashboard

## Overview

Create a new **AI Insights** page and an edge function that uses Lovable AI (Gemini) to analyze historical sales data and produce actionable forecasts and business intelligence. Also add a dedicated insights panel on the main dashboard.

## Architecture

```text
Dashboard (Index.tsx)
  └─ "AI Insights" card → links to /insights

/insights (new page)
  └─ Fetches last 6 months of sales data client-side
  └─ Sends aggregated data to edge function
  └─ Edge function calls Lovable AI with structured tool calling
  └─ Returns: demand forecast, slow movers, reorder alerts, customer trends, margin analysis
  └─ Renders results in cards with charts
```

## 1. Edge Function: `supabase/functions/ai-insights/index.ts`

- Accepts aggregated sales data (product-level monthly quantities, customer totals, stock levels, cost/selling prices)
- Constructs a pharma-specific system prompt asking for structured analysis
- Uses **tool calling** (not raw JSON) to extract structured output with these categories:
  - `demand_forecast`: Top 10 products predicted to sell most next month with estimated quantities and confidence
  - `slow_movers`: Products with declining sales trend (candidates for discounting/returns)
  - `reorder_alerts`: Products where current stock will run out before next month based on consumption rate
  - `customer_insights`: Customers with growing/declining purchase patterns
  - `margin_warnings`: Products where margin is below 10% or negative
- Model: `google/gemini-3-flash-preview` (fast, cost-effective)
- Add to `config.toml`: `[functions.ai-insights]` with `verify_jwt = false`

## 2. New Page: `src/pages/AIInsights.tsx`

**Layout** (using AppLayout):
- **Generate button** at top — user clicks to run analysis (not automatic, to control AI costs)
- **Loading state** with skeleton cards while AI processes
- **5 insight panels** rendered after response:

| Panel | Content |
|-------|---------|
| Demand Forecast | Table: Product, Last Month Qty, Predicted Next Month, Confidence % |
| Reorder Alerts | Cards with red/amber badges: Product, Current Stock, Days Until Stockout |
| Slow Movers | List of declining products with trend arrows and suggested actions |
| Customer Trends | Growing vs declining customers with percentage change |
| Margin Warnings | Products with thin/negative margins highlighted |

- Each panel is a Card with appropriate icons (Brain, AlertTriangle, TrendingDown, Users, DollarSign)
- Results cached in `useState` so re-navigation doesn't re-trigger

## 3. Dashboard Integration (`src/pages/Index.tsx`)

Add a new card at the bottom of the dashboard:
- "AI Business Insights" card with a Brain icon and gradient background
- Shows a brief summary if insights were recently generated (stored in localStorage with timestamp)
- "View Insights" button navigating to `/insights`

## 4. Data Aggregation (Client-Side)

The insights page fetches and aggregates before sending to the edge function:
- Last 6 months of `sales_invoice_items` joined with `sales_invoices` (for dates) and `products` (for names, costs, stock)
- Group by product_id + month → monthly quantity sold per product
- Current stock levels from `products.stock_quantity`
- Customer monthly totals from `sales_invoices`
- This keeps the AI payload small (~2-5KB) rather than sending raw rows

## 5. Route Addition (`src/App.tsx`)

Add `/insights` as a protected route pointing to `AIInsights`

## Files

| File | Action |
|------|--------|
| `supabase/functions/ai-insights/index.ts` | Create — Edge function with Lovable AI |
| `supabase/config.toml` | Update — Add function config |
| `src/pages/AIInsights.tsx` | Create — Full insights page |
| `src/pages/Index.tsx` | Modify — Add AI insights card |
| `src/App.tsx` | Modify — Add route |

