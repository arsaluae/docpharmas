# Demo Data

The current tenant already contains a working dataset (customers, suppliers, products, sales/purchase invoices, GRNs) — enough to exercise every hardened path. Programmatic seeding was intentionally skipped to avoid clutter and to keep posted-document immutability/audit guarantees intact.

If you need a clean demo tenant later:

1. Create a new tenant via Settings → Team or the admin `manage-tenant` edge function.
2. Sign in as that tenant's admin.
3. Use the in-app forms to create:
   - 5 customers, 5 suppliers, 20 products (with batches + expiry)
   - 3 GRNs, 2 sales invoices, 1 sales return, 1 delivery note
   - 1 purchase invoice, 1 purchase return
   - 1 customer payment, 1 supplier payment, 1 expense, 1 bank transfer
   - 1 credit note, 1 debit note

Going through the UI guarantees every trigger, audit-log entry, and journal line is written exactly as production would write them.
