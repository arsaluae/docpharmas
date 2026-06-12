## Goal

On every generated document (Sales Order/Invoice, Delivery Note, Warranty Note, Purchase Order/Proforma/Invoice, GRN, Returns, Credit/Debit Notes):

1. **Hide the internal party code** (e.g. `CUS-0001`, `SUP-0001`) — it should never appear in the printed/PDF header.
2. **Always show party mobile + phone** (both, on the same line, separated by `·`) pulled from the customer/supplier record, immediately above the address block.

Address rendering already works; this only adjusts the party card.

## Changes

### 1. `src/lib/pdf-generator.ts` — party card

In the `partyHtml` block (around line 234):

- **Remove** the line that renders `opts.partyCode`. The PDF will no longer print the internal code regardless of what callers pass in.
- **Default both mobile and phone ON** for customers AND suppliers, ignoring the `show_*_mobile_on_docs` / `show_*_phone_on_docs` flags for the visibility decision (still skip a value if it's empty). Concretely, replace the `showMobile`/`showPhone` gating (lines 217-223) with:
  ```
  const showMobile = true;
  const showPhone = true;
  ```
  Keep the de-duplication so we don't print the same number twice when `mobile === phone`.

No other changes to layout, spacing, or columns. NTN/License/CNIC/Account-code rows untouched.

### 2. `src/pages/PurchaseProforma.tsx` — supplier mobile

The four supplier party blocks (lines 381, 531, 675, 720) currently pass only `partyPhone`. Add `partyMobile: (order.suppliers as any)?.mobile || (order.suppliers as any)?.sms_mobile || undefined` next to each `partyPhone`, so suppliers print both numbers like customers do. (If the `suppliers` table only has `phone`, the mobile line is simply skipped — no breakage.)

### 3. Callers that already pass `partyCode`

`ProformaInvoices.tsx`, `DeliveryNotes.tsx`, `SalesInvoicesList.tsx`, etc. still pass `partyCode` — leave the calls as-is. The renderer now ignores it. (Cleaner than touching ~10 call sites and risking regressions.)

## Out of scope

- No DB / schema changes.
- No UI changes to the in-app list/detail pages (the internal code still shows inside the app for staff lookup — only the printed/PDF output is affected).
- No template-builder option to re-enable the code; the user explicitly wants it gone everywhere.
- No changes to NTN/License/CNIC visibility.

## Acceptance

- PDF preview of a Sales Order, Sales Invoice, Delivery Note, Warranty Note, Purchase Order/Proforma, Purchase Invoice, GRN, Sales/Purchase Return all show: party name → mobile · phone → city · area → address, with **no `CUS-####` / `SUP-####` line**.
- When only one of mobile/phone exists, only that one prints. When both equal, only one prints.
- Existing in-app tables and dialogs are unchanged.

Approve and I'll apply the edits and visually verify with the live preview.