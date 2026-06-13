# Global Search Across All Paginated Lists

## Problem
Search inputs on list pages currently filter the **already-loaded page** (50 rows). Typing a SKU/name that lives on page 3 returns nothing. Same issue on the Products tab, Stock Movements tab, and every other paginated list (Customers, Suppliers, Sales Invoices, POs, etc.).

## Fix — server-side debounced search
Push the search term into the Supabase query (`.or(...ilike...)`) so the database searches the whole catalog and pagination follows the filtered set.

### Pattern (applied identically to every list)
```ts
const [search, setSearch] = useState("");
const [debounced, setDebounced] = useState("");

useEffect(() => {
  const t = setTimeout(() => setDebounced(search.trim()), 300);
  return () => clearTimeout(t);
}, [search]);

// reset to page 1 whenever the search term changes
useEffect(() => { pagination.setPage(1); }, [debounced]);

// in loadAll(), before .range():
if (debounced) {
  const q = `%${debounced}%`;
  query = query.or(`name.ilike.${q},sku.ilike.${q},product_code.ilike.${q}`);
}
```

- Debounce 300 ms → no query storm while typing.
- `count: "exact"` already in place → pagination footer stays accurate against the filtered set.
- Remove the now-redundant client-side `.filter(...)` on `products` / `movements`.

## Pages updated (same pattern, different searchable columns)

| Page | Searchable columns |
|---|---|
| Products → Catalog tab (`Products.tsx`) | `name, sku, product_code, generic_name, brand` |
| Products → Stock Movements tab | `batch_number, notes` + product name via cached map (kept client-side after fetch — DB join not available; will switch to server search on `batch_number, notes, reference_number` and keep product-name filter additive) |
| Customers (`Customers.tsx`) | `name, contact_person, phone, city, customer_code` |
| Suppliers (`Suppliers.tsx`) | `name, contact_person, phone, supplier_code` |
| Sales Invoices (`SalesInvoicesList.tsx`, `ProformaInvoices.tsx`) | `invoice_number` + customer name via cached map server filter on `invoice_number` only; customer-name filter stays client-side because customers is a relation |
| Purchase Proforma / Purchase Orders (`PurchaseProforma.tsx`) | `po_number, proforma_number` |
| Sales Returns, Purchase Returns, Credit Notes, Debit Notes, Delivery Notes | their document-number column |
| Payments, Expenses, Warranty Invoices, Landed Costs, Print Jobs, Printers, Bank Accounts | their primary number/name column |

For relation-based search (e.g. "find invoice by customer name") I'll add a second cheap query: when `debounced` is set, fetch matching customer/supplier ids with `ilike` and include `customer_id.in.(...)` in the main `.or()`. This keeps everything server-side.

## Out of scope
- The Sales Order / Invoice **product picker** dropdown — you didn't include it in scope this round; it stays as is.
- No schema changes. No new indexes (existing `name`/`sku` indexes are sufficient at current data volumes; can revisit if slow).
- No UI redesign — only wiring change behind the same search inputs.

## Files touched
- `src/pages/Products.tsx`
- `src/pages/StockMovements.tsx`
- `src/pages/Customers.tsx`, `src/pages/Suppliers.tsx`
- `src/pages/ProformaInvoices.tsx`, `src/pages/SalesInvoicesList.tsx`
- `src/pages/PurchaseProforma.tsx`
- `src/pages/SalesReturns.tsx`, `src/pages/PurchaseReturns.tsx`
- `src/pages/CreditNotes.tsx`, `src/pages/DebitNotes.tsx`, `src/pages/DeliveryNotes.tsx`
- `src/pages/Payments.tsx`, `src/pages/Expenses.tsx`
- `src/pages/WarrantyInvoices.tsx`, `src/pages/LandedCosts.tsx`
- `src/pages/PrintJobs.tsx`, `src/pages/Printers.tsx`, `src/pages/BankAccounts.tsx`

## Verification
1. Products: type a SKU known to live on page 4 → result appears immediately, pagination shows "1 of 1".
2. Customers: search a name from a non-loaded page → found.
3. Clear search → original paginated list restored, page resets to 1.
4. No console errors; network shows one debounced query per keystroke burst.
