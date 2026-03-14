

# Complete Backup System Enhancement

## What's Missing from Current Backup

The current `BACKUP_TABLES` list has 15 tables but the database has 30+ tables. Missing:

- `sales_agents`, `agent_customers`, `agent_commissions`
- `credit_notes`, `salary_payments`, `warranty_invoices` (if exists)
- `stock_movements`, `sales_returns`, `purchase_returns`
- `document_templates`, `document_counters`, `company_settings`
- `customer_products`, `customer_licenses`, `customer_distributors`
- `chart_of_accounts`, `journal_entries`, `journal_lines`
- `expense_ledgers`, `goods_received_notes`, `grn_items`
- `drap_registrations`, `additional_costs`

## Plan

### 1. Add all missing tables to manual Excel backup
Update `BACKUP_TABLES` in `Settings.tsx` to include every data table (~30 total). Exclude system tables (`pending_signups`, `payment_submissions`, `tenant_users`, `user_roles`).

### 2. Create automated weekly backup edge function
- New edge function `supabase/functions/weekly-backup/index.ts`
- Uses service role key to query all tenant data
- Exports each tenant's data as compressed JSON
- Stores in a private `tenant-backups` storage bucket
- Keeps rolling 8-week history (deletes older backups)
- Set `verify_jwt = false` in config.toml (called by cron)

### 3. Create storage bucket + cron job
- Create `tenant-backups` private bucket via migration
- Schedule `pg_cron` job to run weekly (Sunday midnight)

### 4. Add "Automated Backups" section to Settings backup tab
- Show last automated backup timestamp (queried from storage)
- Show backup history list with download buttons
- Status indicator (active/last run)

## Files

| File | Action |
|------|--------|
| `src/pages/Settings.tsx` | Add missing tables to `BACKUP_TABLES`, add automated backup history UI |
| `supabase/functions/weekly-backup/index.ts` | Create — automated backup logic |
| `supabase/config.toml` | Add `[functions.weekly-backup]` with `verify_jwt = false` |
| Database (migration) | Create `tenant-backups` bucket, enable `pg_cron`/`pg_net`, schedule weekly job |

