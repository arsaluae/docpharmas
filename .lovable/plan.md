

# Fix: Missing Document Counters for Tenants

## Root Cause
When tenants `Mouj Pharmaceuticals` and `Medsal PK` were created, the `seedTenantData` function was called but the `credit_note` and `salary` counter types were added later via separate migration. Meanwhile, the core counters (purchase_proforma, purchase_order, etc.) exist for the demo tenant but are missing for these two tenants -- likely they were approved before the seed list was complete, or the seed insert silently failed.

## Fix

### 1. Database Migration -- Backfill missing counters
Run a SQL migration that inserts any missing document counters for all existing tenants. Uses `ON CONFLICT DO NOTHING` to be safe.

The full list of document types:
- sales_invoice, proforma, warranty_invoice, purchase_proforma, purchase_order, purchase_invoice, grn, payment, expense, delivery_note, journal, sales_return, purchase_return, print_job, supplier, customer, product, credit_note, salary

### 2. Update manage-tenant Edge Function
Add `credit_note` and `salary` to `DOCUMENT_COUNTER_SEEDS` so future tenants get all counter types.

### Files
- `supabase/functions/manage-tenant/index.ts` -- Add 2 missing seed types
- Database migration -- Backfill missing counters for all tenants

