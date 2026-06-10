# Production QA Checklist

Run before every release. Tick each box in a fresh browser session as an `admin`, then repeat the **Sales agent scope** section as a `sales_agent`.

## Auth & tenancy
- [ ] Sign up → pending → admin approval → sign in works
- [ ] Switching tenants is impossible (URL tampering returns empty data, not other tenant's rows)
- [ ] Sales agent cannot see customers they are not assigned to (`agent_customers`)
- [ ] Sales agent sidebar hides Purchase, Finance, Reports, Settings → Team

## Sales hub
- [ ] Proforma → Sales Order → Sales Invoice generation is sequential (cannot skip)
- [ ] Sales invoice line **rejects save** when batch or expiry is missing
- [ ] Sales of an expired batch is blocked unless `allow_expired_sale = true`
- [ ] Once a sales invoice is `paid` / `partial` / `dispatched`, financial fields cannot be edited — only `void_document` succeeds
- [ ] Duplicate invoice number within a tenant raises a clear error
- [ ] Submitting the same invoice twice (same `idempotency_key`) does not create two rows

## Purchase hub
- [ ] PO → GRN → Purchase Invoice generates sequentially
- [ ] GRN variances adjust stock (`stock_movements` row appears)
- [ ] Landed cost distribution updates product `last_purchase_rate`

## Inventory
- [ ] Out-movement that would drive stock < 0 is blocked unless `allow_negative_stock = true`
- [ ] Batch expiry alerts populate at 30/60/90 days
- [ ] Reorder alerts respect 90-day consumption (<7d critical, <14d warning)

## Accounting & reports
- [ ] P&L, Balance Sheet, Cash Flow tie out (Assets = Liab + Equity)
- [ ] Aging (customer / supplier) matches Ledger outstanding
- [ ] Closed-period insert is rejected with a clear error

## Finance
- [ ] Customer payment auto-allocates oldest-first
- [ ] Bank transfer updates both `bank_accounts.balance` rows atomically
- [ ] Salary payment debits the chosen bank account

## Documents
- [ ] PDF preview renders within `PdfPreviewDialog` at expected size
- [ ] WhatsApp share opens with prefilled message via `share-document`
- [ ] Void cascades: voiding a sales invoice reverses delivery note, payment allocations, stock

## Performance
- [ ] List pages paginate server-side at 50/page
- [ ] Reports load < 3s on tenants with 10k+ rows

## Security
- [ ] Run `supabase--linter` — zero ERROR-level findings
- [ ] Run `security--run_security_scan` — no new HIGH findings
- [ ] No `service_role` key in client bundle (`grep -r 'service_role' dist/`)
