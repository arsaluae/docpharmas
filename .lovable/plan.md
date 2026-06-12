## Goal

Make the ERP feel like premium enterprise software (Odoo / Zoho / NetSuite class) — without changing any functionality, routes, or business logic. Pure scale, hierarchy, and document polish.

## 1. Sidebar redesign (`src/components/AppSidebar.tsx` + `src/index.css`)

Keep the same component, route map, and RBAC filtering. Only restyle and reorder.

- **Width**: expand expanded state from current ~240px to **312px**; collapsed stays icon-only (~72px). Adjust `--sidebar-width` token in `src/index.css`.
- **Brand header** (`.mouj-brand`): taller block (~96px) with larger logo glyph, "MOUJ PHARMA" wordmark at 20px, and a secondary line showing **Fiscal Year** (from `company_settings.fiscal_year_start` if present, else "FY 2026") and tenant name. Company selector placeholder (single-tenant today → renders tenant name as a static "switcher" chip; no functional change).
- **Surface Sales Invoices in the Sales group** for admin/owner roles too. Current admin sidebar Sales group shows: Customers, Sales Orders, Warranty Invoices, Returns. New order:
  - Sales → Customers, Sales Orders, **Sales Invoices** (`/sales-invoices`), **Delivery Notes** (`/delivery-notes`), Sales Returns, **Payments In** (`/payments?tab=received`), Warranty Invoices
  - Purchase → Suppliers, Purchase Orders, **Purchase Invoices** (`/purchase-proforma?tab=invoices` if that exists, else keep PO entry), Purchase Returns
  - Inventory → Products, Stock Movements, **Batches** (`/products?tab=batches`), **Expiry Monitor** (`/products?tab=expiry`), Landed Costs, Printers, Print Jobs
  - Finance → **Receivables** (`/payments?tab=received`), **Payables** (`/payments?tab=paid`), **Cash** (`/bank?tab=cash`), **Banks** (`/bank`), Credit Notes, Expenses, Staff & Salaries
  - Reports, Settings (Settings already accessible via footer; also add a top-level Settings row)
  - Verify each route exists before wiring; for any new tab params, confirm the destination page reads them — if not, point to the existing top-level route instead (no new pages created).
- **Type & spacing**: nav rows 44px tall, font 15px, icons 18px, section labels 12.5px uppercase with more breathing room. Active state gets a solid left accent bar + slightly brighter row background.

## 2. Dashboard scale-up (`src/pages/Index.tsx` and KPI/metric components)

- Page heading: **44px** semibold, larger subtitle (15px muted).
- Section titles: 19px.
- KPI cards (`src/components/ui/metric-card.tsx` + dashboard usage): min-height **148px**, label 14.5px uppercase tracked, value **36px** tabular-nums, delta chip 13px. Increase internal padding to 24px and gap between cards.
- Charts/section cards: bigger headers, 24px padding.

## 3. Global UI scaling

- `src/components/ui/input.tsx`: `h-12` (48px), text 15px.
- `src/components/ui/button.tsx`: default `h-12` (~48px), `lg` `h-13`, `sm` stays.
- `src/components/ui/table.tsx`: header 14.5px, body 15px, row vertical padding bumped (+~25% → `py-4`), product/name columns get `min-w-[260px]` via per-page class where used (no logic change).
- `src/components/ui/label.tsx`: 14.5px.
- Form spacing: increase default gaps in page containers via existing utility classes — no structural changes.

## 4. Document templates (`src/lib/pdf-generator.ts`)

Applies to Sales Order, **Sales Invoice**, Delivery Note. Keep existing layout skeleton.

- **Logo**: max-height bumped from current 140px to **~210px** (≈ 250% of pre-redesign 56px baseline) and given more horizontal room in the header grid.
- **Customer block** on Sales Order / Sales Invoice / Delivery Note renders, in this order, whenever the field is non-empty on the customer record:
  - Customer Name, Customer Code, **Mobile** (auto from `customers.phone`/`mobile`), City, Area, Address.
  - Respect the existing `show_customer_mobile_on_docs` / `show_customer_phone_on_docs` flags — when both are off, fall back to mobile-on for these three doc types (override flag scoped to invoice/SO/DN only) so the user's "must auto-appear" requirement holds without breaking the privacy toggle for other docs.
- **Items table**: header 14.5px, body 14.5px, row height +25%, product-name column widened (set explicit % widths in colgroup).
- **Totals block**: Grand Total **30px** bold with prominent "PKR" label (16px), amount-in-words 14px, more whitespace above the total.

## 5. Out of scope (explicit)

- No new pages, no schema changes, no route changes, no business-logic edits.
- No changes to PDF structure beyond scale + the customer-info fields above.
- Multi-company switcher stays visual-only (single tenant today).

## Acceptance

Sidebar 312px wide with fiscal year + tenant in header; Sales Invoice + Delivery Note + Payments In visible directly under Sales; dashboard KPIs read clearly from across the room; inputs/buttons/tables ~20% chunkier; PDF logo ~2.5× larger; Sales Order / Sales Invoice / Delivery Note auto-print customer mobile + city + area + address from the customer master.

Approve and I'll implement.