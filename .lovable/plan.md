# Customer Contact Import Wizard

A dedicated 6-step wizard to bulk-import contact persons from Excel, smart-match them to existing customers, dedupe, and surface them across sales/payment/WhatsApp flows.

## 1. Database

New table `public.customer_contacts` (tenant-scoped, RLS via `get_user_tenant_id()`):

- `customer_id` (FK → customers, cascade delete)
- `contact_name`, `designation`
- `mobile`, `phone`, `email`
- `is_primary` (bool, default false)
- `source` (`manual` | `import`), `notes`
- standard `tenant_id`, `created_at`, `updated_at`, audit timestamps

Indexes on `(customer_id)`, `(tenant_id, mobile)`, `(tenant_id, email)` for duplicate detection.
Partial unique index ensuring only one `is_primary = true` per customer.
GRANTs to `authenticated` + `service_role`, RLS policies mirroring `customers`.

## 2. Import Wizard (new route `/data-import/customer-contacts`)

Reachable as a card on the existing **Data Import** page (`src/pages/DataImport.tsx`) and from **Customers → Import Contacts** button.

### Step 1 — Upload
- Drop Excel/CSV. Accepted headers (case-insensitive, alias-mapped via `src/lib/import/aliases.ts` extension):
  `Customer Name, Customer Code, Contact Person, Mobile, Phone, Designation, Email`
- Download template button (xlsx with sample rows).
- Parse with existing `xlsx` util; show row count + raw preview.

### Step 2 — Smart Match (client-side)
For each row, match against `customers` in this priority:
1. `customer_code` exact (confidence 100)
2. Exact `name` / `company` (confidence 95)
3. Normalized name — lowercase, strip punctuation, collapse whitespace, drop suffixes (`pharmacy`, `medicos`, `pvt ltd`) — fuzzy via Dice/Levenshtein (confidence = similarity %)
   - ≥85 = auto-accept, 60–84 = needs review, <60 = unmatched

### Step 3 — Verification Screen
Table with columns: Excel Customer | Matched ERP Customer (searchable dropdown) | Confidence badge | Status | Actions.

Per-row actions: **Accept**, **Change Match** (opens customer search), **Skip**, **Create Customer** (opens quick-create dialog prefilled from row).

Bulk actions: Accept all ≥85, Skip all unmatched. Filter chips: All / Auto-matched / Needs Review / Unmatched / Skipped.

User cannot proceed to import until every row is Accepted / Skipped / linked to a Created customer.

### Step 4 — Duplicate Detection
Before insert, for each contact compare against existing `customer_contacts` for the matched customer:
- same `mobile` (normalized digits only)
- same `email` (lowercased)
- same `contact_name` (normalized)

For each conflict prompt: **Update existing**, **Skip**, **Create Duplicate**. Offer "apply choice to all remaining".

### Step 5 — Import
Batch insert (chunks of 500). First contact per customer with no existing primary → `is_primary = true`.

### Step 6 — Summary
Show: Total Rows, Matched, Unmatched, Contacts Imported, Updated, Duplicates Skipped, Errors. Export error rows as CSV. Log run to `audit_log` via `logAudit()`.

## 3. Customer Screen Integration

- `CustomerProfileDialog`: new **Contact Persons** tab listing primary (badge) + additional contacts; inline add/edit/delete; "Set as primary" action.
- `Customers.tsx` list: show primary contact name + mobile in expanded row / mobile card.

## 4. ERP Contact Selectors

Add optional `contact_id` field where a customer is chosen, defaulting to that customer's primary:
- Sales Orders (Proforma), Sales Invoices, Delivery Notes — store on header, render on PDFs as "Attn: {contact_name} ({designation}) — {mobile}".
- Payments (CollectPayment) — informational only.
- Customer Ledger — filter/header chip.
- WhatsApp share (`src/lib/whatsapp-share.ts`) — use selected contact's mobile instead of customer phone when present.

Schema additions: `contact_id uuid` (nullable FK) on `sales_invoices`, `proforma_invoices`, `delivery_notes`, `payments`. No data migration needed — old rows stay null.

## Technical Notes

- New files: `src/pages/ContactImportWizard.tsx`, `src/lib/import/contacts.ts` (parse/match/dedupe helpers), `src/components/customer/ContactsTab.tsx`, `src/components/customer/ContactPicker.tsx`.
- Reuse existing import primitives (`cleaners.ts`, xlsx parser, `SearchableSelect`, `QuickCreateCustomer`-style dialog).
- All matching runs client-side after a single bulk customers fetch (id, customer_code, name, company) — same pattern as bulk reports.
- Mobile normalization: strip non-digits, keep last 10; treat `+92300...` and `0300...` as equal.

## Out of Scope

- Importing contacts for suppliers (can be cloned later).
- Per-contact RBAC.
- Bulk WhatsApp blast to contacts (separate feature).

## Acceptance Criteria

- Wizard rejects import until 100% of rows are resolved.
- Re-importing the same file produces 0 new contacts (all caught as duplicates).
- Primary contact auto-flows into a new Sales Invoice's contact field, editable via dropdown.
- Customer profile shows contacts and supports add/edit/delete/set-primary.
