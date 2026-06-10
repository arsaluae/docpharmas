# Disaster Recovery Runbook

This document describes how to restore a tenant from a backup snapshot created by the `weekly-backup` edge function.

> ⚠️ **Restores are manual on purpose.** A one-click restore button is a single-point compromise risk (a leaked owner session could wipe a tenant). The procedure below is intentionally service-role only.

## 1. Backup format

Each backup is a single JSON file at `tenant-backups/<tenant_id>/<kind>/<timestamp>.json` where:

- `kind ∈ { daily, weekly, monthly, manual }`
- Retention: daily 14d, weekly 8w, monthly 12m (enforced by the edge function after each run).
- The JSON has the shape:

```json
{
  "tenant_id": "uuid",
  "generated_at": "2026-06-10T02:00:00Z",
  "kind": "weekly",
  "tables": {
    "customers": [ /* rows */ ],
    "suppliers": [ /* rows */ ],
    "products":  [ /* rows */ ],
    "...":       [ /* rows */ ]
  }
}
```

Rows are tenant-scoped; no other tenant's data is ever present in a tenant's backup file.

## 2. Triggers

- `pg_cron`:
  - **Daily** `0 2 * * *` (retention 14d)
  - **Weekly** `0 3 * * 0` (retention 56d)
  - **Monthly** `0 4 1 * *` (retention 365d)
- Each cron invocation calls `weekly-backup` with header `x-cron-secret: <vault.cron_backup_secret>`.
- Owners can also trigger a `manual` backup from **Settings → Backups → "Run backup now"** (auth is via a normal owner JWT, no `CRON_SECRET` needed).

## 3. Authentication

`weekly-backup` accepts EITHER:

1. `x-cron-secret` header matching `CRON_SECRET` (used by pg_cron), OR
2. A valid Supabase JWT belonging to a user whose `tenant_users.role = 'owner'`.

Any other caller is rejected with `401`.

## 4. Restore procedure (service-role only)

> Run by a Lovable Cloud operator with service-role access. **Never** expose service-role credentials to the application or to tenants.

### 4a. Pre-flight

1. Confirm the target tenant exists and is the correct `tenant_id`.
2. Notify the tenant owner — restoring overwrites current data.
3. Take a fresh `manual` backup of the **current** state before restoring (so the restore itself is reversible).

### 4b. Download the snapshot

Use the Supabase Storage admin UI or the CLI with service-role:

```bash
curl -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/storage/v1/object/tenant-backups/<tenant_id>/<kind>/<file>.json" \
  -o snapshot.json
```

### 4c. Validate

- File parses as JSON.
- `tenant_id` in the file matches the target tenant.
- Each table array is sane (spot-check counts vs. the previous "current state" backup).

### 4d. Apply (per table, inside a transaction)

For each table in the snapshot (in FK-safe order: master data → headers → lines → ledger):

```sql
BEGIN;

-- Lock period if applicable, then:
DELETE FROM public.<table> WHERE tenant_id = '<tenant_id>';

-- Insert from the JSON (use \copy or jsonb_populate_recordset).
INSERT INTO public.<table> SELECT * FROM jsonb_populate_recordset(NULL::public.<table>, $1::jsonb);

COMMIT;
```

> Triggers like `prevent_period_writes`, `enforce_posted_immutability`, and `prevent_negative_stock` will run during the inserts. If a row legitimately needs to bypass them (e.g. restoring posted invoices), temporarily `SET LOCAL session_replication_role = 'replica';` inside the transaction — never globally.

### 4e. Post-restore audit

After commit, write an audit event:

```sql
INSERT INTO public.audit_log
  (tenant_id, user_id, user_email, user_role, action, entity_type, entity_number, changes)
VALUES
  ('<tenant_id>', NULL, 'ops@lovable', 'service_role', 'backup_restored', 'backup_run',
   '<file>.json', jsonb_build_object('source_kind', '<kind>', 'restored_by', 'ops'));
```

## 5. Failure modes & recovery

| Symptom | Action |
|---|---|
| Edge function returns 401 with no body | `CRON_SECRET` missing or mismatched. Re-issue with `vault.create_secret`. |
| `backup_runs.status = 'failed'` with storage error | Check `tenant-backups` bucket exists and is private. |
| Empty `tables.{name}` for a tenant that has data | Service-role policy on that table is too restrictive — review RLS bypass for service_role. |
| HTTP 504 from pg_cron | Tenant data is large; raise function timeout and split into per-table batches. |

## 6. Testing the runbook

Quarterly, on a staging project:

1. Trigger a manual backup.
2. Modify a few records.
3. Run the restore procedure above against the modified tenant.
4. Confirm restored state matches the snapshot.
5. File the result in `docs/disaster-recovery-tests/YYYY-QN.md`.
