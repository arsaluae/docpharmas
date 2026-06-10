# ERP Hardening & Audit — Phased Plan

This request spans 10 phases and would take many sessions to do safely. I'll do it in **5 implementation waves**, each ending with a verified, working state. Wave 0 (this turn, if you approve) is a **read-only audit** so we have a real defect list before changing anything.

## Wave 0 — Read-only Audit (no code changes)

Deliverable: a single audit report at `.lovable/audit/findings-2026-06-10.md` containing:

1. **RLS coverage matrix** — for every public table: RLS on? policies count? tenant filter present? `service_role` GRANT? `anon` GRANT? Flagged rows = needs fix.
2. **Cross-tenant leak probes** — run `supabase--read_query` as the DB owner on each business table to list tables where a policy is missing `tenant_id = get_user_tenant_id()` or `is_agent_customer(...)`.
3. **Edge function auth audit** — each of the 6 edge functions: `verify_jwt`, JWT validation in code, service-role usage, secret leakage.
4. **Secret / repo hygiene** — confirm `.env` only holds publishable keys, `.gitignore` covers `.env*.local`, no service-role key in client bundle (`rg` over `src/`).
5. **RBAC matrix vs UI** — diff `src/lib/rbac.ts` against routes in `App.tsx` and sidebar items; list routes missing `<RequireCap>`.
6. **ERP rule probes** — SQL checks for: duplicate invoice numbers per tenant, sales lines missing batch/expiry, posted invoices with `void_reason` null but edited money fields, closed-period writes, negative on-hand, expired-batch sales.
7. **Backup posture** — `weekly-backup` function review + check whether `pg_cron` schedule exists, retention, encryption, restore path.
8. **Audit-log coverage** — list every `logAudit(...)` call site vs the required action list; produce the gap list.
9. **Console / network errors** on `/dashboard` and 5 high-traffic pages.

Output is a checklist with severity (P0/P1/P2) and a proposed fix per item. **Nothing in the DB or repo changes in Wave 0.**

## Wave 1 — Security & Tenant Isolation (P0)

Driven by Wave 0 findings. Typical fixes:

- Add missing `tenant_id = get_user_tenant_id()` to any policy that lacks it.
- Add `restrictive` `rbac_*` policies on tables that only have permissive ones.
- Remove `anon` grants on tables that should be auth-only.
- Add `verify_jwt`/`getClaims()` to edge functions that mutate data.
- Tighten storage bucket policies (especially `tenant-backups`).
- Patch any client-side admin checks (`isAdmin` from localStorage etc., if found).

Verification: re-run the cross-tenant probes; `supabase--linter` must come back clean for P0 items.

## Wave 2 — Backups & Recovery

- Confirm `pg_cron` daily + weekly + monthly schedules calling `weekly-backup` (currently weekly only). Add daily/monthly variants with retention 14d / 8w / 12m.
- Extend `tenant-backups` bucket: private, signed-URL only, owner-only download via `manage-tenant`-style edge function.
- New table `backup_runs` (id, tenant_id, kind, status, size_bytes, file_path, started_at, finished_at, error, created_by) + RLS owner-only.
- New page `/settings/backups` (owner only): backup-now button, history table, last/next backup, retention settings, restore-from-file dry-run (validates JSON shape, does **not** execute restore — restore stays a manual `service_role` operation documented in `docs/disaster-recovery.md`).
- `logAudit` entries: `backup_created`, `backup_failed`, `restore_started`, `restore_completed`.

## Wave 3 — Audit Log Completeness + Sensitive-action Confirmations

- Extend `AuditAction` enum + `logAudit` call sites to cover every action in your list (login, failed_login, user_invited, settings_changed, import_*, backup_*, report_exported, stock_adjusted with reason, etc.).
- `login` / `failed_login` captured via `onAuthStateChange` + a small edge function `record-auth-event` (so failed logins are recorded server-side).
- Wrap these client actions in a confirm-with-reason dialog (`<ConfirmReasonDialog>`): delete invoice, edit posted invoice, stock adjustment, restore backup, change user role, delete product/customer/supplier, rollback import.
- Reason stored in `audit_log.changes.reason`.

## Wave 4 — ERP Rule Hardening + UX polish

- DB triggers (only where missing — most already exist per memory):
  - duplicate invoice number guard (already covered by unique idx — verify).
  - sales order does NOT touch ledger/stock (verify no trigger does).
  - stock_adjustment requires `reason` (NOT NULL check + trigger).
  - closed-period writes blocked (already exists — verify on every txn table).
- UI: professional empty states, error boundary page, `/settings/system-health` extended with backup health, DB health (`supabase--db_health`), storage health.
- Onboarding wizard polish (Company → Users → Roles → Import) — only if Wave 0 shows real gaps; otherwise skipped.

## Wave 5 — Final Report + Launch Checklist

Single markdown delivered as `/mnt/documents/erp-audit-final.md` with: issues found per phase, files/tables/policies changed, tests performed, residual risks, **launch readiness score /100**, and a go-live checklist.

## Technical notes

- All DB changes go through `supabase--migration` (one migration per wave, reviewed by you).
- No hard deletes added anywhere — voids/reversals only.
- No client-only role checks: every UI gate is mirrored by a restrictive RLS policy or RPC guard.
- Restore is intentionally **not** a one-click button — it's a documented procedure to avoid a single compromised admin wiping a tenant.
- Out of scope for now: SOC2 paperwork, pen-test, third-party WAF, email-domain DMARC (separate engagement).

## What I need from you

1. **Approve Wave 0** so I can produce the real defect list. After you review the report we'll scope Waves 1–5 precisely (some items in your wishlist may already be done — memory says RLS, tenant isolation, void_document, period locks, negative-stock trigger, batch+expiry guard, posted-immutability trigger, RBAC matrix, weekly backups, and audit log are already in place; Wave 0 will verify that).
2. Confirm: **owner = "super admin"** in your terminology, or do you want a new `super_admin` role above `owner` (cross-tenant)? Today everything is single-tenant-scoped.
3. Confirm restore stays manual (recommended) vs. a one-click owner button (riskier).
