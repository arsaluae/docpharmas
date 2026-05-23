This is a large multi-week scope (3 major modules + cross-cutting audit log). I'll be honest about what already exists, what's a gap, and propose a **phased build** so we ship working chunks instead of one giant unverifiable change.

## What already exists (verified)

| Area | Status |
|---|---|
| Sales Returns + Credit Notes (with `handle_credit_note_balance` trigger, reverse stock via `stock_movements`) | ✅ Exists |
| Purchase Returns + Debit Notes (with `handle_debit_note_balance`) | ✅ Exists |
| `void_document(table, id, reason)` RPC that reverses stock + balances | ✅ Exists, but no 48h gate |
| `print_jobs` with `quantity_dispatched_to_supplier`, computed `quantity_at_factory`, `printer_share_percent`, `our_share_amount`, `quantity_rejected` | ✅ Exists |
| Printer ledger page | ✅ Exists |
| Accounting Periods + lock trigger (just shipped) | ✅ Exists |

## Gaps vs. spec

| Section | Gap |
|---|---|
| 1B/1C 48h grace | No `approved_at` timestamp, no countdown UI, no auto-replace of Delete with "Raise Return" button |
| 1D/1E auto-prefill | Sales Return dialog exists; need to confirm prefill from invoice + mandatory reason dropdown |
| 1D/1E Credit/Debit Note "apply to next invoice" | Notes exist but not automatically deductible on next invoice |
| 2 Audit log | No `audit_log` table, no timeline component, no global filterable page, no IP capture |
| 3A PJO header | `print_jobs` exists but missing: `purchase_order_id` link, `factory_id`, `special_instructions`, multi-line `print_type` items |
| 3B Partial deliveries | Only single `quantity_delivered` field — no separate `print_deliveries` table for multiple records-of-receipt |
| 3C Rejection accounting | `printer_share_amount` calculated but **never posted to GL** — no auto debit-note creation, no Printing Rejection Expense account |
| 3E PO → printing status | No widget on PO detail page |

---

## Proposed phased plan

### **Phase A — Audit Log foundation** (ships independently, unblocks Sections 1 & 2)

1. New table `audit_log` (immutable: RLS allows INSERT for any authenticated user, SELECT for tenant, **no UPDATE/DELETE policies**). Columns: `tenant_id, user_id, user_email, user_role, action, entity_type, entity_id, entity_number, changes jsonb, ip_address, user_agent, created_at`.
2. New helper `src/lib/audit.ts` — `logAudit({entity_type, entity_id, action, ...})` reads IP via `https://api.ipify.org` (one-time per session cached).
3. New component `<ActivityTimeline entityType entityId />` — vertical timeline at bottom of detail pages.
4. New page `src/pages/AuditLog.tsx` under Reports → Compliance — filters by user / date / entity type, CSV export, owner+admin only.
5. Wire logAudit into 6 high-value places: SO create/approve/delete, SI create/approve/delete, PI create/approve/delete (where applicable), Sales Return create, Purchase Return create, Credit/Debit Note issue.

**Out of A:** auto-diff of edits (logs only major lifecycle actions).

### **Phase B — 48h Grace Window on Sales & Purchase Invoices**

1. Migration: add `approved_at timestamptz`, `deletion_locked_at` to `sales_invoices` + `purchase_invoices`. Backfill from `created_at`. Add settings field `invoice_delete_grace_hours int default 48` on `company_settings`.
2. `delete_invoice_with_grace(p_table, p_id)` SQL function — checks `now() - approved_at < grace_hours`, otherwise raises exception. Calls `void_document` to reverse.
3. UI in Sales Invoice & Purchase Invoice tables: a `useEffect` countdown badge ("Deletable for 31h 14m") + Delete button gated by grace window. Once expired, button morphs to "Raise Sales/Purchase Return" linking to existing return dialog.
4. logAudit on every grace-period deletion.

### **Phase C — Printing Job Module upgrade**

1. Migration:
   - Add to `print_jobs`: `purchase_order_id uuid`, `factory_name text`, `special_instructions text`, `status` enum extension (`partially_delivered`, `fully_delivered`, `closed`).
   - New table `print_deliveries` (one PJO → many): `print_job_id, date, delivery_note_no, qty_delivered, received_by, notes`.
   - New table `print_rejections`: `print_job_id, date, qty_rejected, reason, cost_per_unit, total_cost, our_share_percent, our_share_amount, vendor_share_amount, debit_note_id, evidence_notes`.
   - Trigger `enforce_print_delivery_balance()` — blocks `qty_delivered + qty_rejected > qty_ordered`.
   - Trigger `post_print_rejection()` — on insert: auto-creates a `debit_notes` row for vendor's share AND inserts into a new `expenses` row (or directly into a "Printing Rejection Expense" CoA account) for our share. Also updates `print_jobs.quantity_delivered` / `quantity_rejected` aggregates.
2. UI:
   - New `src/pages/PrintJobs.tsx` rewrite with the tracker card (Ordered / Delivered / Rejected / Pending progress bar) + Deliveries history table + Rejections history table.
   - "Record Delivery" + "Record Rejection" dialogs.
   - On Purchase Order detail (`PurchaseProforma.tsx`): "Printing Status" panel showing all linked PJOs with progress.

### **Phase D — Return-flow polish & Credit/Debit Note apply-to-next-invoice**

1. Verify Sales/Purchase Return dialogs auto-prefill all line items from source invoice with editable qty.
2. Add mandatory `return_reason` enum field (`damaged | wrong_product | expiry | customer_request | other`) to `sales_returns` + `purchase_returns`.
3. On Sales Invoice creation form: detect open (unapplied) Credit Notes for the customer and offer "Apply credit PKR X" checkbox. Same for Purchase Invoice + Debit Notes.

---

## What I'm flagging for human review (not implementing without sign-off)

- **Exact journal-entry shape for rejection accounting.** The spec itself lists two competing entries and asks for clarification. I will implement: **DR Printing Rejection Expense (our share); CR Bank/Accrued (our share)** as an `expense` row, **PLUS** a `debit_notes` row of `amount = vendor share` to reduce vendor payable — but want sign-off before posting.
- **IP capture via third-party (`api.ipify.org`).** This adds a network call on first audit log per session. Alternative: drop IP and just log user_id (recommended for privacy + perf). I'll default to IP-disabled unless you want it.

---

## What I'd like to start with

This is realistically 4 separate ships. I recommend starting with **Phase A (Audit Log)** because it's a clean foundation and unblocks Phase B. Then B, then C, then D.

**Please confirm which phase to build now**, or say "all of A and B" and I'll do those two together. Phase C alone is roughly the size of A+B combined and should ship on its own.