

# System Audit: Issues, Duplications & Improvements

---

## CRITICAL BUGS

### 1. DOUBLE STOCK DEDUCTION on Sales Invoice Conversion
**Severity: Data-Corrupting**

When a Sales Order is submitted (converted to invoice) in `ProformaInvoices.tsx`, the code:
1. Inserts into `sales_invoice_items` (line 365) — triggers `trg_sales_item_stock` which runs `handle_sales_item_stock()` and **deducts stock**
2. Then manually inserts into `stock_movements` (lines 370-374) — triggers `trg_stock_movement` which runs `handle_stock_movement()` and **deducts stock again**

**Result**: Every sale deducts inventory **twice**. For a 100-unit sale, 200 units are removed from stock.

**Fix**: Remove the manual `stock_movements` insert loop (lines 368-376) since the `sales_invoice_items` trigger already handles the deduction. OR drop `trg_sales_item_stock` trigger and keep the manual stock_movements approach (preferred, since stock_movements provides batch-level audit trail).

### 2. `purchase_in` vs `purchase` Movement Type Mismatch
**Severity: Incorrect Stock Tracking**

The `handle_stock_movement()` function recognizes `'purchase'` as an inbound type, but `PurchaseProforma.tsx` inserts movements with type `'purchase_in'` (not in the trigger's list). The batch availability check in `ProformaInvoices.tsx` line 313 also checks for `'purchase_in'`.

This means: **purchased stock never gets counted by the trigger** (the trigger ignores `purchase_in`), BUT it might still work because of a separate mechanism. However, the batch availability calculation in the submit dialog uses `purchase_in` which won't match what the trigger recognizes. These need to be aligned.

**Fix**: Either update the trigger to include `'purchase_in'` or change the insert code to use `'purchase'`.

---

## ORPHANED / DEAD CODE

### 3. Redirect-Only Pages (4 files, ~32 lines of dead code)
These pages exist only to redirect and serve no purpose since they're not in the sidebar:
- `src/pages/SalesInvoices.tsx` → redirects to `/proforma`
- `src/pages/PurchaseOrders.tsx` → redirects to `/purchase-proforma`
- `src/pages/GoodsReceivedNotes.tsx` → redirects to `/purchase-proforma`
- `src/pages/PurchaseInvoicesPage.tsx` → redirects to `/purchase-proforma`

Routes `/sales-invoices`, `/purchase-orders`, `/grn`, `/purchase-invoices` still exist in `App.tsx` but are unreachable from the UI. These should be removed entirely.

### 4. Delivery Notes Not in Sidebar
`DeliveryNotes.tsx` (293 lines) exists with a route `/delivery-notes` but has **no sidebar link**. Users cannot reach it without typing the URL manually.

---

## DUPLICATED PATTERNS

### 5. Auth Check Copy-Pasted in Every Single Page (~20 pages)
Every page has this identical block:
```typescript
useEffect(() => {
  const check = async () => { 
    const { data: { session } } = await supabase.auth.getSession(); 
    if (!session) navigate("/auth"); 
  };
  check();
}, [navigate]);
```
This should be a single `<ProtectedRoute>` wrapper component or handled in `App.tsx` with a route guard. It's duplicated across 20+ files.

### 6. Duplicated Page Layout Boilerplate
Every page repeats:
```tsx
<SidebarProvider>
  <div className="min-h-screen flex w-full bg-background">
    <AppSidebar />
    <main className="flex-1 overflow-auto">
      <header>...<SidebarTrigger />...</header>
      ...
    </main>
  </div>
</SidebarProvider>
```
This should be a shared `<AppLayout>` component, reducing ~15 lines per page across 20+ pages.

### 7. Duplicated `updateItem` / `updateEditItem` Logic in ProformaInvoices
`ProformaInvoices.tsx` has two nearly identical functions: `updateItem` (line 153) and `updateEditItem` (line 211). Same logic, same calculation — should be one shared function taking a setter.

### 8. Duplicated PDF Generation Code
`ProformaInvoices.tsx` has the invoice PDF generation logic duplicated: once in `printInvoice` (line 272) and again inline after submit (line 418). Identical column definitions, row mapping, totals structure.

---

## DATA INTEGRITY ISSUES

### 9. Balance Sheet Missing Printer Payables
`BalanceSheet.tsx` calculates payables from `suppliers.balance` only. It completely ignores `printers.balance`, meaning money owed to printers is invisible on the balance sheet.

### 10. No Error Handling on Most Supabase Operations
Many insert/update calls don't check the `error` result:
- `ProformaInvoices.tsx` line 178: `handleSave` insert doesn't check error
- `ProformaInvoices.tsx` line 227: `handleEditSave` update doesn't check error  
- `PurchaseProforma.tsx` line 188: create insert doesn't check error
- Multiple stock_movement inserts in submit flow have no error handling
- If any insert in the multi-step submit flow fails mid-way, you get partial data (invoice created but no items, or items but no delivery note)

### 11. No Transaction Safety on Multi-Step Operations
The Sales Order → Invoice conversion involves 5+ sequential database operations (insert invoice → insert items → insert stock movements → insert delivery note → update proforma status). If any step fails, the previous steps are NOT rolled back, leaving the database in an inconsistent state. This should ideally use an edge function with a database transaction.

### 12. Document Counter Desync Risk
`generate_document_number` increments the counter atomically, but if the subsequent insert fails, the number is consumed and lost forever. Over time this creates gaps (PAY-0001 missing, PAY-0002 exists). Already happened with payments (counter was reset to 0).

---

## UI/UX ISSUES

### 13. Dashboard Doesn't Include Printer Data
`Index.tsx` dashboard shows customers, suppliers, products, but no printer stats or print job data. Printers are a core business entity but invisible on the dashboard.

### 14. No Sidebar Link for Stock Movements
The `StockMovements` page exists at `/stock` but there's no sidebar link. It's only reachable by direct URL.

---

## RECOMMENDED FIX PRIORITY

| Priority | Issue | Impact |
|----------|-------|--------|
| P0 | #1 Double stock deduction | Corrupting inventory data NOW |
| P0 | #2 Movement type mismatch | Stock triggers not firing correctly |
| P1 | #10 Missing error handling | Silent failures, data loss |
| P1 | #9 Balance sheet missing printers | Incorrect financial reports |
| P2 | #5+#6 Auth & layout duplication | Maintenance burden, 300+ lines removable |
| P2 | #3 Dead redirect pages | Code clutter |
| P2 | #4+#14 Missing sidebar links | Features unreachable |
| P3 | #7+#8 Code duplication | Maintainability |
| P3 | #11+#12 Transaction safety | Edge case data corruption |
| P3 | #13 Dashboard gaps | Incomplete visibility |

---

## Implementation Plan

### Phase 1 — Critical Data Fixes (immediate)
1. **Drop `trg_sales_item_stock` trigger** — let stock_movements be the single source of truth for stock changes (provides batch audit trail)
2. **Update `handle_stock_movement`** to include `'purchase_in'` in inbound types
3. **Add error handling** to all Supabase operations in ProformaInvoices and PurchaseProforma
4. **Fix BalanceSheet** to include `printers.balance` in payables

### Phase 2 — Cleanup & DRY
5. Create `<ProtectedRoute>` wrapper and `<AppLayout>` component, refactor all pages
6. Delete 4 dead redirect pages + their routes
7. Add missing sidebar links (Delivery Notes, Stock Movements)
8. Deduplicate PDF generation and item update logic

### Phase 3 — Robustness
9. Move multi-step operations (submit, receive) to edge functions with proper transactions
10. Add printer stats to dashboard

