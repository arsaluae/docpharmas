

# Plan: Bootstrap Tenant + Seed Dummy Data + In-App PDF Preview

## Critical Fix First: Tenant & Admin Setup

Your account has **no tenant, no tenant_user record, and no admin role**. The entire app is broken because of this. A migration will seed:

1. Insert `arsaluae@gmail.com` into `user_roles` as `admin`
2. Create a tenant "PharmaZen Demo" with `owner_email = arsaluae@gmail.com`, active subscription
3. Create `tenant_users` record linking your user to this tenant as `owner`

## Dummy Data Seeding (via migration)

All records will get the same `tenant_id` so RLS works. The flow:

1. **Supplier**: "MediPharma Labs" (Karachi)
2. **Customer**: "City Pharmacy" (Lahore), "HealthPlus Store" (Islamabad)
3. **Printer**: "National Printers" (Karachi)
4. **Products**: "Paracetamol 500mg Tablets", "Amoxicillin 250mg Capsules", "Cough Syrup 100ml"
5. **Bank Account**: "Meezan Bank Operating"
6. **Company Settings**: Basic company config
7. **Document Counters**: Initialize SO, INV, PO, BILL, DN, GRN, PAY, EXP, PJ, PR, SR counters
8. **Purchase Order** (draft) → **Confirm** (creates GRN + Bill + stock_movements for batch/expiry)
9. **Print Job**: 1 job with some rejection
10. **Sales Order** (draft) → **Submit** (creates Invoice + DN + stock_movements with batch selection)
11. **Payment**: Received from customer, made to supplier
12. **Expense**: Business expense (office supplies)

This creates a complete audit trail hitting all ledgers.

## PDF Preview: In-App Modal Instead of New Tab

Currently `generatePdf()` calls `window.open("", "_blank")` — opens a full new tab. Change to:

1. **New component**: `PdfPreviewDialog.tsx` — a dialog/sheet with an `<iframe>` rendering the HTML
2. **Modify `pdf-generator.ts`**: Add `generatePdfHtml()` that returns the HTML string instead of opening a window. Keep `generatePdf()` for backward compat but default to returning HTML.
3. **Update all pages** that call `generatePdf()` to use the new preview dialog — opens as a centered modal (not full page), has "Download/Print" button inside, screenshot-friendly

The dialog will be ~80% viewport width, scrollable, with the invoice rendered inside an iframe using `srcdoc`.

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | Seed admin role, tenant, tenant_user, dummy business data |
| `src/lib/pdf-generator.ts` | Add `generatePdfHtml()` returning HTML string |
| `src/components/PdfPreviewDialog.tsx` | New: modal with iframe for PDF preview |
| `src/pages/ProformaInvoices.tsx` | Use PdfPreviewDialog |
| `src/pages/PurchaseProforma.tsx` | Use PdfPreviewDialog |
| `src/pages/DeliveryNotes.tsx` | Use PdfPreviewDialog |
| `src/pages/Payments.tsx` | Use PdfPreviewDialog |
| `src/pages/PrintJobs.tsx` | Use PdfPreviewDialog |
| `src/pages/WarrantyInvoices.tsx` | Use PdfPreviewDialog |
| `src/pages/PurchaseReturns.tsx` | Use PdfPreviewDialog |
| `src/pages/SalesReturns.tsx` | Use PdfPreviewDialog |

