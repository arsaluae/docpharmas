## Goals
1. Consistent Pakistan city dropdown everywhere a party/address is captured.
2. "Area" works end-to-end (entry → filter → reports).
3. Memory-based last rate visible in Sales & Purchase item rows (both customer & supplier).
4. A clear, filterable Vacant Area – Product List.

---

## 1. City dropdown coverage
Already wired: Customers, Suppliers, Printers.
Add `SearchableSelect` with `CITY_OPTIONS` to every remaining party/address form:
- `CustomerProfileDialog` (distributor sub-form)
- `SupplierProfileDialog` (if it has city)
- `Couriers.tsx`, `SalesAgents.tsx` (if they capture city/region)
- Data Import: validate/normalize city against the list (warn on mismatch)

## 2. Area – end-to-end
Currently `customers.area` is a free-text input.
- Introduce a managed list: new table `areas` (tenant-scoped: `name`, `city`, optional). Seed from existing distinct customer.area values on first load.
- Replace the plain Area input in Customers with a `SearchableSelect` (areas filtered by selected city) + "Add new area" inline option.
- Add `area` column to Suppliers (optional) so geographic reports balance.
- Add **Area filter** to:
  - `CitywiseSales` (group by City → Area sub-rows)
  - `CustomerWiseReport`
  - `SalesTrend`, `ProductPerformance`
- New report **`AreaWiseSales`** (`/reports/area-sales`): revenue, orders, unique customers, top product per area, with city filter and bar chart.

## 3. Last-rate memory (already partial — make it prominent & reliable)
Today `last_price` is fetched and shown as a tiny "Last: PKR …" label in `ProformaInvoices` and `PurchaseProforma`.
Improvements:
- Show the badge in a stronger style (chip next to rate field) and also expose **"Use last rate"** quick-click to repopulate when user has edited.
- Tooltip with date + document number of the source invoice.
- Extend coverage to:
  - Sales Invoice direct add (if any non-PI path)
  - GRN line entry (`grn_items`) — show last received rate for that supplier+product
  - Warranty Invoices item picker
- Centralize the lookup in `src/lib/party-products.ts` (already has `getCustomerProductIds` / supplier variant) by adding `getLastRate(partyType, partyId, productId)` that returns `{rate, date, doc_number}`.

## 4. Vacant Area – Product List
Current `VacantAreas` report shows per-product cities not covered. Make it the **primary "Vacant Areas" dashboard** the user expects:
- Two view modes (tab toggle):
  - **By Product** (current): for each product, list cities/areas with no sales OR no allocation.
  - **By City/Area**: for each city/area, list products NOT yet sold there (the inverse view — this is what "vacant area product list" reads as).
- Filters: city, area, product category, "based on" (allocations vs actual sales last 12 months).
- Export to CSV.
- Surface KPI cards: total vacant city-product pairs, top 5 underserved cities, top 5 products with weakest coverage.
- Link from Reports landing under Geographic section, and add a shortcut card on Dashboard.

---

## Technical notes
- New migration: `areas` table (id, tenant_id, name, city, created_at) + RLS (tenant_select/insert/update/delete). Backfill from `SELECT DISTINCT area, city FROM customers WHERE area IS NOT NULL`.
- Optional `suppliers.area` column.
- `getLastRate` helper queries `sales_invoice_items` (joined to `sales_invoices` for customer/date/number) or `grn_items` (joined to `goods_received_notes` for supplier/date), ordered by date desc limit 1.
- New page: `src/pages/reports/AreaWiseSales.tsx`, `src/pages/reports/VacantAreas.tsx` upgraded with tabs (rename keep route).
- Update `src/App.tsx` routes and `src/pages/Reports.tsx` index.

## Out of scope
- Changing how documents are numbered or how RLS works.
- New stock/accounting logic (already audited in prior loop).
