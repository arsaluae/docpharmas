# Wipe Confirmation Modal — Plan

## 1. Fix outstanding build errors first
- `src/pages/Settings.tsx:460` — remove the stray `// @ts-expect-error` line (RPC types were regenerated, directive is now unused).
- `src/pages/Settings.tsx:484` — replace the leftover `{tenant?.name}` reference with `{tenantName}` (the `useTenant()` hook exposes `tenantName`, not `tenant`).

## 2. New RPC: `preview_wipe_counts()`
Add a read-only `SECURITY DEFINER` SQL function that, scoped to the current user's tenant, returns a `jsonb` map of `{ table_name: row_count }` for every table the wipe will touch (same list as `wipe_my_tenant`). Owner-only. Used by the modal to render the live preview so the numbers always match what the wipe will actually delete.

## 3. Replace inline Danger Zone UI with a real modal
Refactor `DangerZoneCard` in `src/pages/Settings.tsx`:

- Trigger button "I understand — start wipe" opens a shadcn `<AlertDialog>` (so it can't be dismissed by clicking outside).
- On open, call `preview_wipe_counts` and render a scrollable table:
  - Two columns: **Table** (human label) · **Rows to delete** (tabular-nums, right-aligned).
  - Footer row: **Total rows** (sum).
  - Empty tables hidden by default; toggle "Show empty tables".
- Below the table, an explicit "Kept intact" list (login, workspace, team members, role assignments, backups).
- Confirmation input: must type exactly `WIPE <workspace name>`. Live mismatch hint in destructive color.
- Primary action `Wipe everything now` is disabled until the text matches AND preview has loaded.
- On click: call `wipe_my_tenant(confirm_text)`, show toast, console.table the deleted counts, then `window.location.reload()` after 1.5s.
- Cancel button + AlertDialog close resets the typed text.

## 4. Execute the wipe
After the modal lands and the user types `WIPE <workspace name>` and clicks the destructive button, the existing `wipe_my_tenant` RPC runs. I will not pre-execute it from my side — the action stays user-initiated for safety and auditability.

## Technical details
- Files touched: `src/pages/Settings.tsx` (modal + fixes), one new migration for the preview RPC.
- New component is colocated in `Settings.tsx` to keep scope tight; no shared exports.
- Imports added: `AlertDialog*` from `@/components/ui/alert-dialog`, `Table*` from `@/components/ui/table`.
- The preview RPC uses `SELECT count(*)` per table with `tenant_id = get_user_tenant_id()`; total query cost is small (single round-trip).
- Same owner-only guard as `wipe_my_tenant` (`current_tenant_role() = 'owner'`).
