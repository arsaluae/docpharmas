## Plan

1. **Customer Contact Import: real post-import validation**
   - Add row-level import results after posting: `created`, `updated`, `linked`, `skipped duplicate`, `unmatched`, `error`.
   - Add clear unmatched reasons, for example:
     - no customer code/name mapped
     - blank customer/contact value after mapping
     - no ERP customer above match threshold
     - row still pending review
   - Show a final validation table in the Summary step with row number, Excel name used, contact person, matched customer, outcome, and reason.
   - Fix the current misleading summary so it shows:
     - Total Rows
     - Contact Rows Created
     - Contact Rows Updated
     - Rows Linked to Customers
     - Customer Records Synced
     - Duplicates Found
     - Unmatched Rows
     - Errors

2. **Improve contact matching visibility**
   - Add an `unmatchedReason` / `reason` field to contact matching results.
   - Keep the existing flexible column mapping, but make the verification screen expose why a row did not match instead of silently showing “unmatched”.
   - Keep import blocked until pending review/unmatched rows are accepted, manually mapped, created, or skipped.

3. **Prevent duplicate suppliers**
   - Add a database-level duplicate guard so future duplicate suppliers are blocked even if they are created from another screen/import path.
   - Block duplicates by tenant using:
     - normalized supplier name
     - supplier code when present
   - Existing duplicate supplier rows will remain for now, but new duplicates will be prevented.
   - Add friendly checks in the Suppliers form so users see “Supplier already exists” before save.
   - Update supplier import posting so it detects existing suppliers first, skips duplicates, and reports them as skipped with row-level reasons instead of inserting another supplier.

4. **Purchase Order editing**
   - Keep draft purchase orders editable as today.
   - Also allow editing approved/confirmed purchase orders **before GRN/receipt or paid invoice activity**.
   - When editing an approved PO, sync changes to both:
     - the source purchase proforma
     - the linked purchase order and purchase order items
   - Do not allow edits after stock receipt/payment activity, because those affect stock and accounting history.

5. **Ledger sync behavior**
   - Keep supplier ledger syncing on purchase invoice/bill creation, not on draft PO creation.
   - Make the PO screen clearer by ensuring edits before receipt update the linked bill if one was auto-created and still unpaid/unreceived.
   - Avoid changing ledger balances directly from purchase orders, so accounting stays tied to purchase invoices.

## Technical notes

- Files to change:
  - `src/lib/import/contacts.ts`
  - `src/pages/ContactImportWizard.tsx`
  - `src/lib/import/posters.ts`
  - `src/pages/DataImport.tsx`
  - `src/pages/Suppliers.tsx`
  - `src/pages/PurchaseProforma.tsx`
- Database migration:
  - Add a supplier duplicate-prevention trigger/function for normalized names and supplier codes.
- Validation:
  - Confirm contact import summary shows actual created/updated/linked counts.
  - Confirm supplier duplicate attempts are blocked from manual add and skipped during import.
  - Confirm editable purchase orders save changes into linked PO records before receipt/payment.