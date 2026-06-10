# DocPharmas ERP

Multi-tenant ERP for Pakistani pharmaceutical distribution. Sales, purchase, inventory with batch/expiry tracking, double-entry accounting, FBR-compliant GST/WHT, and AI-driven business insights.

**Production**: https://docpharmas.com
**Stack**: Vite 5 · React 18 · TypeScript 5 · Tailwind v3 · shadcn-ui · Lovable Cloud (Supabase)

---

## Local development

```sh
npm i
cp .env.example .env   # then fill in values
npm run dev
```

Required Node: 18+. The app runs entirely client-side and talks to Lovable Cloud over HTTPS.

## Environment

See [`.env.example`](./.env.example) for the full list. All `VITE_*` variables are public (shipped to the browser) — never put secrets here. Edge function secrets live in the Lovable Cloud dashboard.

## Architecture

- **Multi-tenancy**: every row carries `tenant_id`, scoped via `get_user_tenant_id()` RLS helper and `set_tenant_id()` DB trigger.
- **RBAC**: `admin` (full) and `sales_agent` (Sales hub + assigned customers only). Roles live in `user_roles`, never on profiles. Enforced by `has_role()` security-definer + restrictive RLS policies (`agent_scope_*`).
- **Hub workflow**: Sales/Purchase Invoices are generated sequentially from inside their hub — never created directly.
- **Accounting**: double-entry. Every posted document writes balanced `journal_lines`.
- **Inventory**: 11 DB triggers automate 10 stock-movement types. Negative stock is blocked at the DB unless `company_settings.allow_negative_stock = true`.
- **Pharma safety**: sales lines require batch + expiry. Sales of expired batches blocked unless `company_settings.allow_expired_sale = true`.
- **Audit**: immutable `audit_log` + `logAudit()` helper + `ActivityTimeline` component.

## Hardened rules (June 2026 sweep)

- Tenant-scoped unique invoice numbers (`sales_invoices`, `purchase_invoices`).
- Posted-document immutability — once `paid/partial/approved/dispatched`, only `void_document` RPC may change financial fields.
- Idempotency keys on `sales_invoices` and `payments` prevent double-submit.
- Closed-period guard blocks writes when `accounting_periods.status = 'closed'`.

See [`TEST_CHECKLIST.md`](./TEST_CHECKLIST.md) for the manual QA matrix and [`.lovable/audit/findings.md`](./.lovable/audit/findings.md) for the latest audit.

## Deploy

Lovable handles build + hosting. Push to `main` or hit **Publish** in the Lovable UI.

## License

Proprietary. © DocPharmas.
