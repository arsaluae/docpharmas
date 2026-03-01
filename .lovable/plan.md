

# Artisan PDF Templates + Linked Document Workflow

This is a large scope request with two main pillars: (1) a premium PDF template redesign and (2) a fully linked document lifecycle for both sales and purchase flows.

## Current State Analysis

**Sales flow gaps:**
- Proforma converts to Invoice (works), but proforma status becomes "converted" -- not "invoiced"
- Invoice has a "Create DN" button but doesn't update invoice status to "dispatched"
- No auto-linking: delivery note creation doesn't update the invoice status

**Purchase flow gaps:**
- Purchase Proforma converts to PO (works), status becomes "converted"
- PO has no "Create GRN" flow from it
- No status chain linking PO -> GRN -> Purchase Invoice

**PDF templates:** `generatePdf` already accepts a `template` parameter from `useDocumentTemplates`, but no page actually passes it. The PDF design is good but the template system isn't wired up.

---

## Part 1: Premium PDF Template Design

### `src/lib/pdf-generator.ts`
- Redesign the HTML template with refined typography:
  - Use **Georgia/serif** for company name and document title with elegant letter-spacing
  - Use **Inter** for body text with carefully tuned weights (300 for labels, 600 for values)
  - Monospaced numbers in a warm charcoal (#2d2d3a) instead of pure black
- Refined color palette: deep navy (#1a1a2e) headers, warm gold (#c9a84c) accents, ivory (#faf9f6) alternating rows
- Decorative touches: double-border page frame, gold gradient divider under letterhead, ornamental corners on document title box
- Table header with navy background, gold bottom border, all-caps tracking
- Totals section with subtle border radius and last-row emphasis
- "Total in Words" in italic with gold label prefix
- Signature lines with fine 1.5px rules and small-caps labels
- Footer with a gold gradient fade-line and refined "computer-generated" notice

### Wire templates to all pages
- `SalesInvoices.tsx`, `WarrantyInvoices.tsx`, `ProformaInvoices.tsx`, `PurchaseProforma.tsx`, `DeliveryNotes.tsx`, `PurchaseOrders.tsx`, `GoodsReceivedNotes.tsx`
- Each page imports `useDocumentTemplates`, calls `getTemplate("sales_invoice")` etc., and passes the template to `generatePdf`

---

## Part 2: Linked Document Lifecycle

### Sales Flow: Proforma -> Invoice -> Delivery Note

**`ProformaInvoices.tsx` changes:**
- When "Convert to Invoice" completes, update proforma status to **"invoiced"** (not "converted")
- Show "invoiced" status pill in teal

**`SalesInvoices.tsx` changes:**
- When "Create DN" is clicked, after creating the delivery note:
  - Update invoice status to **"dispatched"**
  - Show "dispatched" status pill in blue
- Add a visual indicator showing source proforma number if invoice was created from a proforma

**`DeliveryNotes.tsx` changes:**
- Show linked invoice number and customer name (join on reference_id)
- Add "Delivered" status button that updates DN status to "delivered"

### Purchase Flow: Purchase Proforma -> PO -> GRN

**`PurchaseProforma.tsx` changes:**
- When "Convert to PO" completes, update status to **"ordered"** (not "converted")

**`PurchaseOrders.tsx` changes:**
- Add a **"Create GRN"** button per PO row
- When clicked: pre-fill GRN form with PO items (product, qty ordered, rate)
- After GRN creation, update PO status to **"received"**
- Link the GRN back to the PO via `po_id`

**`GoodsReceivedNotes.tsx` changes:**
- Show linked PO number
- After GRN is saved, auto-update PO status

### Status Mapping Summary

```text
SALES:
  Proforma:  draft -> approved -> invoiced
  Invoice:   draft -> sent -> dispatched -> paid
  DN:        issued -> delivered

PURCHASE:
  Proforma:  draft -> approved -> ordered
  PO:        draft -> confirmed -> received
  GRN:       (created from PO, links back)
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/pdf-generator.ts` | Premium typography redesign, refined colors, ornamental details |
| `src/pages/ProformaInvoices.tsx` | Status "invoiced", wire template to PDF |
| `src/pages/SalesInvoices.tsx` | DN creation updates status to "dispatched", wire template |
| `src/pages/DeliveryNotes.tsx` | Show linked invoice/customer, "delivered" button, wire template |
| `src/pages/PurchaseProforma.tsx` | Status "ordered", wire template |
| `src/pages/PurchaseOrders.tsx` | Add "Create GRN" button, update status to "received", wire template |
| `src/pages/GoodsReceivedNotes.tsx` | Show linked PO, wire template |
| `src/pages/WarrantyInvoices.tsx` | Wire template to PDF |

No database changes required -- all status fields are text columns already.

