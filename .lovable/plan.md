## Scope

Three remaining gaps from Phase B–D follow-ups. All UI-level wiring against already-shipped DB schema, plus one optional accounting tightening.

## 1. Place GraceDeleteButton on invoice lists

- **Sales Invoices** (`src/pages/ProformaInvoices.tsx` — sales invoice table): swap the existing destructive delete action for `<GraceDeleteButton table="sales_invoices" ... />`, passing `approvedAt={row.approved_at}` and an `onRaiseReturn` that opens `SalesReturnDialog` prefilled with the invoice.
- **Purchase Invoices** (`src/pages/PurchaseProforma.tsx` — purchase invoice rows): same treatment with `table="purchase_invoices"`, `onRaiseReturn` linking to the existing Purchase Return flow.
- Read `invoice_delete_grace_hours` from `company_settings` once via `useCompanySettings` and pass through.

## 2. Mirror Credit Note "Apply" flow on Debit Notes

- Generalize `ApplyCreditNoteDialog.tsx` → rename to `ApplyNoteDialog.tsx` with a `kind: "credit" | "debit"` prop (chooses table, party type filter, and target invoice table — `purchase_invoices` for debit).
- Update `src/pages/DebitNotes.tsx` to match `CreditNotes.tsx`:
  - Add **Remaining** column (`amount - applied_amount`).
  - Add **Apply** button per row that opens the dialog filtered to open purchase invoices of that supplier.
  - Show applications history in the row-expand or a small inline list.
- Re-export `ApplyCreditNoteDialog` as a thin wrapper for backward compat so `CreditNotes.tsx` keeps working without churn.

## 3. Tighten print-rejection accounting (pending CA sign-off)

Current trigger `post_print_rejection()`:
- DR (implicit) "Printing Rejection Expense" via `expenses` row for our share
- Reduces vendor AP via `debit_notes` row for vendor share

Proposed tightening (only if you confirm):
- Ensure a system-locked CoA account **"Printing Rejection Expense"** exists (seed on tenant creation) and force `expenses.account_id` to it instead of leaving generic.
- Add `notes` on the auto-generated debit_note that references `print_rejection_id` so the audit trail is traceable both ways.
- No change to the journal-entry shape itself.

## Out of scope

- New `journal_entries`/`journal_lines` rows for rejections (current shortcut via `expenses` + `debit_notes` is what's in place; converting to strict GL postings is a separate ticket).
- Bulk-apply of notes across multiple invoices.
- IP-address capture toggle in audit log (already on by default; can be disabled later).

## Open question for you

**Rejection accounting**: confirm the current shape (Expense row + Debit Note) is acceptable, OR say "do strict GL" and I'll add proper double-entry `journal_entries` instead — that's a bigger migration and trigger rewrite.

If you just say "go", I'll proceed with #1 and #2 as specified and do #3's small tightening (CoA seed + cross-reference notes) without changing the journal shape.
