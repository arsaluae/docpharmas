

# Plan: Smart Reorder Alerts, WhatsApp Notifications, UX Overhaul & Sales Growth Features

## Scope

Four workstreams: (1) Smart AI reorder alerts with WhatsApp notification, (2) Settings WhatsApp config, (3) Sales Order page UX cleanup and premium buttons, (4) Operational sales-growth improvements across remaining unreformed pages.

---

## 1. Smart Reorder Alerts + WhatsApp Notification

### Edge Function Enhancement (`supabase/functions/ai-insights/index.ts`)
- Add a new endpoint mode `type: "reorder_check"` that:
  - Fetches products with stock below AI-predicted consumption rate (not just fixed reorder_level)
  - Returns structured reorder alerts with urgency levels
  - If `whatsapp_number` is provided in the request, constructs a formatted WhatsApp message URL and returns it

### New: Scheduled Reorder Check
- Create a new edge function `supabase/functions/reorder-alerts/index.ts` that:
  - Queries products and last 3 months of sales data directly from Supabase DB (using service role key)
  - Calculates average daily consumption per product
  - Identifies products where `current_stock / avg_daily_consumption < 14` (2 weeks threshold)
  - Sends WhatsApp notification via WhatsApp Business API URL redirect (since we can't send messages programmatically without a paid API, we'll generate a pre-filled message link and store it for the user to click)
  - Stores alerts in a new `reorder_alerts` table so the dashboard can show them

### Database Migration
- Create `reorder_alerts` table: `id`, `tenant_id`, `product_id`, `current_stock`, `avg_daily_consumption`, `days_until_stockout`, `severity`, `notified`, `created_at`
- RLS policies matching tenant pattern

### Dashboard Integration
- Add a "Reorder Alerts" card on the Dashboard (`Index.tsx`) showing critical/warning items with a "Send WhatsApp Alert" button that opens pre-filled WhatsApp message with all critical items listed

---

## 2. Settings: WhatsApp Number Configuration

### `company_settings` table update (migration)
- Add `whatsapp_number text` column

### Settings Page (`Settings.tsx`)
- Add a new field under Company Profile: "WhatsApp Number for Alerts"
- Input with placeholder "+923001234567"
- Toggle: "Enable WhatsApp Reorder Alerts"
- This number will be used when generating reorder alert WhatsApp messages

### Update `useCompanySettings` hook
- Include `whatsapp_number` in the interface and query

---

## 3. Sales Orders Page UX Overhaul (`ProformaInvoices.tsx`)

### Problem: Data Repetition
The table currently shows Order #, Invoice #, Customer, Date, Status, Total AND the preview sheet repeats all of this. The table columns are fine -- the issue is in the **flow indicator** and **stats cards** being verbose.

### Fixes:
**A. Streamline the table** -- currently good, but action buttons need upgrade:
- Replace generic ghost icon buttons with **premium contextual action buttons**:
  - Draft orders: Prominent gradient "Submit" button with pulsing dot, ghost "View" eye icon
  - Invoiced: "Track" button with truck icon
  - Dispatched: "Mark Paid" button with check icon  
  - Paid: Only "View" and "PDF" buttons
- Actions always visible (remove `opacity-0 group-hover:opacity-100` -- mobile users can't hover)

**B. Replace the flow indicator bar** with a more compact inline breadcrumb that doesn't take a full row

**C. Premium header buttons:**
- "New Order" button gets a gradient background with subtle glow
- Add a "Quick Sale" button for repeat orders (opens dialog pre-filled with last order's customer)

**D. Refactor to AppLayout** -- this page still uses manual SidebarProvider boilerplate

### Same pattern for DeliveryNotes.tsx and WarrantyInvoices.tsx:
- Refactor to AppLayout
- Upgrade action buttons from generic to contextual/premium
- Remove redundant auth checks

---

## 4. Remaining Page Refactoring to AppLayout

These pages still have duplicated boilerplate (20+ files):
- `ProformaInvoices.tsx`, `DeliveryNotes.tsx`, `WarrantyInvoices.tsx`
- `Suppliers.tsx`, `SupplierLedger.tsx`, `CustomerLedger.tsx`
- `Products.tsx`, `StockMovements.tsx`
- `Payments.tsx`, `Expenses.tsx`, `BankAccounts.tsx`
- `Printers.tsx`, `PrinterLedger.tsx`, `PrintJobs.tsx`
- `PurchaseProforma.tsx`, `PurchaseReturns.tsx`, `SalesReturns.tsx`
- `DataImport.tsx`, `Settings.tsx`
- `CashFlow.tsx`, `TaxCompliance.tsx`

Each gets:
- Remove `SidebarProvider`, `SidebarTrigger`, `AppSidebar` imports
- Remove `useEffect` auth check
- Wrap with `<AppLayout title="..." subtitle="..." headerActions={...}>`

---

## 5. Sales-Growth & Operational Features

### A. Dashboard: Reorder Alerts Widget
- New card showing top 5 critical reorder items with days-until-stockout
- "Send WhatsApp Summary" button that opens WhatsApp with formatted message to the configured number

### B. Dashboard: "Inactive Customers" Card
- Shows customers who haven't ordered in 30+ days
- "Reach Out" button opens WhatsApp with a pre-filled follow-up message to the customer's phone number
- This directly drives re-engagement and sales growth

### C. Landing Page Enhancements
- Add pulsing "live" indicators on the dashboard mockup stats
- Add CSS keyframe gradient animation on hero background
- Add floating pill/capsule SVG elements in hero
- Add "Trusted across Pakistan" section with city badges (Karachi, Lahore, Islamabad, Faisalabad, Peshawar)
- WhatsApp CTA button gets green glow pulse animation
- Urgency text: "Limited spots for Q1 2026"

### D. Sidebar: AI Insights Link
- Add an "AI Insights" link under Reports section with Brain icon

---

## Files Changed

| File | Action |
|------|--------|
| Migration SQL | Add `whatsapp_number` to `company_settings`, create `reorder_alerts` table |
| `supabase/functions/reorder-alerts/index.ts` | Create -- reorder calculation edge function |
| `src/pages/Settings.tsx` | Modify -- add WhatsApp field, refactor to AppLayout |
| `src/hooks/useCompanySettings.tsx` | Modify -- add whatsapp_number |
| `src/pages/Index.tsx` | Modify -- add Reorder Alerts widget + Inactive Customers card |
| `src/pages/ProformaInvoices.tsx` | Modify -- premium buttons, remove data repetition, AppLayout |
| `src/pages/DeliveryNotes.tsx` | Modify -- premium buttons, AppLayout |
| `src/pages/WarrantyInvoices.tsx` | Modify -- premium buttons, AppLayout |
| `src/pages/Landing.tsx` | Modify -- pulsing animations, floating elements, trust badges |
| `src/components/AppSidebar.tsx` | Modify -- add AI Insights link |
| ~18 remaining page files | Modify -- refactor to AppLayout |

---

## Implementation Order

1. DB migration (whatsapp_number column + reorder_alerts table)
2. Settings WhatsApp field + useCompanySettings update
3. Reorder alerts edge function
4. Dashboard reorder + inactive customers widgets
5. ProformaInvoices premium UX overhaul + AppLayout
6. DeliveryNotes + WarrantyInvoices + remaining pages refactor
7. Landing page enhancements
8. Sidebar AI Insights link

This is large scope -- will be implemented across the response with priority on the functional features first (reorder alerts, WhatsApp, UX fixes) then cosmetic (landing page, remaining refactors).

