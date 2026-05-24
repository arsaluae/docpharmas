
# Launch-Readiness Fix Pack

A single coordinated pass covering all 8 issues you raised. Grouped by area for clarity.

---

## 1. Row serial number (#) on Purchase & Sales Orders

**Problem:** Item rows don't show 1, 2, 3… on screen or PDF.

**Fix:**
- Add a `#` column as the first column in the item table on `ProformaInvoices.tsx` (Sales Order) and `PurchaseProforma.tsx` (Purchase Order) forms.
- In `lib/pdf-generator.ts`, when rendering rows, auto-inject a `#` column at index 0 if the caller passes `numbered: true`.
- Update all PO/SO/Invoice/GRN/DN PDF builders to pass `numbered: true` so the printed copy always shows row numbers.

---

## 2. Amount in words on ALL invoices (number + words side-by-side)

**Problem:** Only some templates show "amount in words", and toggle is per-template.

**Fix:**
- In `pdf-generator.ts`, always render the **Total in figures** AND **Total in words** block on every document type (Sales Invoice, Sales Order, Purchase Invoice, PO, GRN, DN, Credit/Debit Note, Warranty Invoice).
- Remove the `show_total_in_words` opt-in gate for invoices; keep it only for non-financial docs like DN if needed.
- Use existing `numberToWords()` helper. Display format:
  - `Total: PKR 55,000.00`
  - `In words: Fifty Five Thousand Rupees Only`

---

## 3. Separate printing/packaging cost flow

**Your rule (confirmed):**
- Purchase Invoice from product supplier = **material only** (e.g. 1,000 × 50 = 50,000 → supplier ledger).
- Print Job to printer = **printing only** (e.g. 1,000 × 5 = 5,000 → printer vendor ledger).
- Stock cost per unit = material + printing (e.g. 55) — used for COGS / gross profit.
- Customer Sales Invoice is **never inflated** by printing cost; printing only affects margin reports.

**Fix:**
- **Purchase Invoice form** (`PurchaseProforma → invoice` step): remove any auto-add of printing line; line items reflect supplier's bill only. Stop posting printing to supplier ledger.
- **Print Jobs** (`PrintJobs.tsx`, `Printers.tsx`): ensure each completed print job posts a vendor payable to the printer (printer = supplier of type `printer`) — already exists per `features/printer-management`; verify ledger flow and fix if posting to wrong account.
- **Landed cost / COGS:** keep printing as a per-unit landed cost on the product's batch, so Reports → Product Costing, P&L, Item-Wise report show:
  - Sale price
  - Material cost (50)
  - Printing cost (5)
  - **Gross profit per unit**
- **Sales Invoice PDF & customer ledger:** no change — only product price hits customer.
- Add a "Printing Cost" column to:
  - Product Costing report
  - Item-Wise sales report
  - P&L drilldown (split COGS into Material vs Printing)

---

## 4. Print-job helper inline on Purchase Order

**Behavior:** Non-blocking inline panel beside each PO item row.

**Fix in `PurchaseProforma.tsx`:**
- When user adds a product line with qty > 0, fetch and show inline:
  - **Available printed stock** for that product (from `grn_items` / stock with printing done flag).
  - **Open / in-progress print jobs** for that product with qty + ETA.
  - **Shortfall** = PO qty − (printed stock + in-progress print qty).
  - Button: **"Create Print Job for {shortfall} pcs"** → opens print-job dialog pre-filled with product + qty.
- Purely advisory — PO can still be saved without creating a print job.

---

## 5. Free-text city + multi-phone + full address (Customers AND Suppliers)

**Fix:**
- **City field:** replace `CitySelect` constraint with a `Combobox` that allows free typing (saves new city to `areas` table on submit if not present). Applies to `Customers.tsx`, `Suppliers.tsx`, `CustomerProfileDialog`, `SupplierProfileDialog`, distributor dialog.
- **Address:** convert single-line `address` input to multi-line `Textarea` (3 rows) — schema already `text`, no migration needed.
- **Multiple phone numbers:** schema currently has single `phone` column. Add `phones jsonb` column (array of strings) to `customers` and `suppliers`; keep `phone` as primary/first entry for backward compatibility. UI shows a list with +Add buttons. PDFs print all phones joined by `, `.

---

## 6. City → Product allocation (Smart suggestions on Sales Order)

**Open question — I'm proposing this interpretation; tell me if different:**

- New table `city_products(tenant_id, city, product_id, priority, rate?)`.
- New page **Settings → City Allocations** (mirrors party-product allocation UI) to assign products to cities with optional preferred rate.
- On `ProformaInvoices.tsx` Sales Order form: when a customer is selected, read their `city` and show a **Smart Suggestions** panel of products allocated to that city (one-click add, pre-fills rate).
- Vacant Areas report already exists — extend to flag cities with zero allocations.

If you wanted city allocation to work differently (e.g. restrict which products can be sold to a city, not just suggest), reply and I'll adjust before building.

---

## 7. Same row #/formatting fix on Sales side

Covered by §1 + §2 — `ProformaInvoices`, `SalesReturns`, `WarrantyInvoices`, `CreditNotes`, `DeliveryNotes` all get the numbered row column and amount-in-words.

---

## 8. Global font size increase (~+15%)

**Fix:**
- In `src/index.css` `:root`, bump base font-size from current `13px` to **`15px`**.
- Bump `Input` height from `h-9` (36px) to `h-10` (40px) and text from `text-[13px]` to `text-[14px]` in `components/ui/input.tsx`.
- Bump `Button` default to `h-10` and `text-sm` → `text-[14px]`.
- Bump table cell padding from `py-2` to `py-2.5` and text from `text-[13px]` → `text-[14px]` in `components/ui/table.tsx`.
- Sidebar nav labels from `text-[13px]` → `text-[14px]`.
- KPI numbers stay `text-2xl` (already large).
- Verify on 1280px and 1440px screens; mobile (<640px) stacked cards keep current sizing to avoid overflow.

---

## Technical details

**DB migrations needed:**
1. `ALTER TABLE customers ADD COLUMN phones jsonb DEFAULT '[]'::jsonb;`
2. `ALTER TABLE suppliers ADD COLUMN phones jsonb DEFAULT '[]'::jsonb;`
3. `CREATE TABLE city_products (id uuid PK, tenant_id uuid, city text, product_id uuid, priority int default 0, preferred_rate numeric, created_at timestamptz);` + RLS (tenant-scoped) + unique(tenant_id, city, product_id) + `set_tenant_id` trigger.
4. Optional: backfill `customers.phones = jsonb_build_array(phone) WHERE phone IS NOT NULL;` (same for suppliers).

**Files touched (high-level):**
- `src/index.css`, `src/components/ui/{input,button,table,sidebar}.tsx` — font sizing
- `src/lib/pdf-generator.ts` — numbered column + always-on amount in words
- `src/pages/ProformaInvoices.tsx`, `src/pages/PurchaseProforma.tsx` — # column, print helper panel, city smart panel
- `src/pages/Customers.tsx`, `src/pages/Suppliers.tsx`, profile dialogs — free-city, multi-phone, textarea address
- `src/pages/PrintJobs.tsx` / printer ledger flow — verify printing cost posts only to printer vendor ledger
- `src/pages/reports/{ProductCosting,ItemWiseReport,ProfitLoss}.tsx` — split material vs printing cost
- New: `src/pages/CityAllocations.tsx` + sidebar entry
- Edge function: none required

**Out of scope (will not touch):** auth, billing, existing accounting triggers beyond the printing-cost split.

---

After approval I'll execute as one build pass. Confirm the city-allocation interpretation in §6 or tell me what to change.
