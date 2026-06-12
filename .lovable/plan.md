## Goal

1. **Renumber document prefixes** so all new docs use the requested codes — **sales orders SO-, sales invoices SI-, delivery notes DN-, purchase orders PO-, purchase invoices PI-** — applied going forward (existing documents keep their historical numbers).
2. **Visually verify** Sales Order, Sales Invoice, and Delivery Note PDFs render the customer block (Name · Code · Mobile · City · Area · Address) correctly without breaking layout.

## Part 1 — Document numbering migration

Single SQL migration that touches `generate_document_number` and the per-tenant `document_counters` table.

### Default prefixes (in `generate_document_number` CASE block)

| doc_type             | current default | new default |
| -------------------- | --------------- | ----------- |
| `proforma`           | SO-             | SO- (keep)  |
| `sales_invoice`      | INV-            | **SI-**     |
| `delivery_note`      | DN-             | DN- (keep)  |
| `purchase_proforma`  | PP-             | **PO-**     |
| `purchase_order`     | PO-             | PO- (keep)  |
| `purchase_invoice`   | BILL-           | **PI-**     |
| `sales_return`       | SR-             | SR- (keep)  |
| `purchase_return`    | PR-             | PR- (keep)  |
| `warranty_invoice`   | WI-             | WI- (keep)  |

Everything else (GRN, PAY, EXP, CN, DBN, JE, PJ, SUP, CUS, PRD, SAL, COM) stays.

### Realign existing tenant counters

For each tenant row in `document_counters`, only flip the prefix when it still matches the *old* default — never overwrite a customer-customised prefix:

```sql
UPDATE document_counters SET prefix = 'SO-' WHERE document_type = 'proforma'          AND prefix IN ('P-','PROF-','PI-','PRO-');
UPDATE document_counters SET prefix = 'SI-' WHERE document_type = 'sales_invoice'     AND prefix = 'INV-';
UPDATE document_counters SET prefix = 'PI-' WHERE document_type = 'purchase_invoice'  AND prefix = 'BILL-';
UPDATE document_counters SET prefix = 'PO-' WHERE document_type = 'purchase_proforma' AND prefix = 'PP-';
UPDATE document_counters SET prefix = 'DN-' WHERE document_type = 'delivery_note'     AND prefix <> 'DN-';
```

Counter values are not reset — only the prefix changes, so numbering continues sequentially.

**Existing historical documents** (already-saved invoices/orders) keep the number they were stamped with at creation. Only documents generated *after* the migration use the new prefix.

## Part 2 — PDF customer block verification (read-only)

The customer fields are already wired in `ProformaInvoices.tsx`, `SalesInvoicesList.tsx`, and `DeliveryNotes.tsx` via `partyName / partyCode / partyMobile / partyCity / partyArea / partyAddress`, and `pdf-generator.ts` renders them in the right-column party card with customer-mobile defaulting ON.

I'll verify visually rather than by guessing:

1. Open the live preview for each list page, trigger the PDF preview dialog on one real record, take a viewport screenshot.
2. Inspect: customer name on top, code mono'd underneath, mobile/phone row, "City · Area" line, full address, no overflow into the items table, header logo stays on its row.
3. If any field overflows or wraps badly, narrow the fix to the party card CSS only (`word-break`, `max-width`) — no structural changes.
4. Confirm the document number on the same render uses the new prefix (SO/SI/DN).

## Out of scope

- No rewrite of historical document numbers.
- No changes to PDF layout beyond a targeted overflow fix if QA finds one.
- No changes to other doc types' prefixes (PAY/EXP/GRN/etc.).

## Acceptance

- New sales orders print as `SO-####`, sales invoices as `SI-####`, delivery notes as `DN-####`, purchase orders as `PO-####`, purchase invoices as `PI-####`.
- Existing documents are untouched and still openable.
- Screenshot QA shows the customer block on SO / SI / DN renders all six fields cleanly with no clipping or layout break.

Approve and I'll run the migration and the visual QA pass.