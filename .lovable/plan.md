

# Fix Purchase Order Creation Error + Improvements

## Investigation Results

I checked the database schema, triggers, RLS policies, and document counters — everything is properly configured. The triggers for `set_tenant_id` exist on all tables, and the `purchase_proforma` document counter has the correct entry.

The console shows a **DropdownMenu ref warning** on the ProformaInvoices page — this is a cosmetic React warning but doesn't block functionality.

The most likely issue is **insufficient error surfacing** — if the `generate_document_number` RPC or subsequent insert fails, the error toast may not show the real cause. I'll add robust error handling and ensure both pages work correctly.

## Changes

### 1. Add error handling & logging to PurchaseProforma create flow
- Add `try/catch` around the entire `handleSave` to catch unexpected failures
- Log actual Supabase error details to console for debugging
- Show more descriptive error toasts

### 2. Add error handling to ProformaInvoices (sales) create flow
- Same treatment for the sales order creation

### 3. Fix DropdownMenu ref warning
- The warning comes from Radix v1 internals; suppress by ensuring `DropdownMenuContent` doesn't receive stale refs from parent components. The component already uses `forwardRef` — the issue is likely from the Radix Portal layer. Will update the component.

### 4. Verify both pages end-to-end
- Ensure product selection, rate lookup, totals calculation, and document number generation all work
- Ensure items insert includes all required fields

## Files to Change

| File | Change |
|------|--------|
| `src/pages/PurchaseProforma.tsx` | Wrap handleSave in try/catch, better error messages |
| `src/pages/ProformaInvoices.tsx` | Same error handling improvements |
| `src/components/ui/dropdown-menu.tsx` | Fix ref warning |

