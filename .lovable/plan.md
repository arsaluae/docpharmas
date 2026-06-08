# Fix: White screen after saving Purchase Invoice

## Root cause

`src/components/GraceDeleteButton.tsx` has an **early `return null` (line 51) placed BEFORE `useEffect` (line 53)**:

```ts
const { can, loading: rolesLoading } = useRoles();
...
if (rolesLoading || !allowed) return null;   // ← early return

useEffect(() => { ... }, [approvedAt, graceHours]);  // ← hook AFTER conditional return
```

When `rolesLoading` flips from `true → false`, React renders a different number of hooks than the previous render. This throws:

> Rendered more hooks than during the previous render.

The error happens inside the invoice list (e.g. after saving a Purchase Invoice the list re-renders, roles finish loading, and the whole tree crashes to a blank screen — matching the white window the user reported and the runtime error already captured in the console).

## Fix

Move all hooks above any conditional return. Reorder `GraceDeleteButton`:

1. Keep `useState` calls at top.
2. Move the `useEffect` (countdown timer) up so it runs unconditionally.
3. Only after all hooks: compute `allowed = can(...)` and do the `if (rolesLoading || !allowed) return null` guard.

No logic change — just reordering. Timer is harmless even when the button won't render (it still cleans up via the effect return).

## Audit pass (same bug class)

Scan other components for the pattern "hook → early return → hook" introduced by the recent RBAC integration:

- `src/components/VoidDocumentButton.tsx` — verify `useRoles()` guard sits above all `useState/useEffect`. If not, apply the same reorder.
- `src/components/RequireCap.tsx` — confirm hooks are unconditional (route-level guard, likely already fine).
- Any other component that started calling `useRoles()` in the recent RBAC rollout.

Only files with the hook-order issue will be edited.

## Files to change

- `src/components/GraceDeleteButton.tsx` — reorder hooks above the early return.
- `src/components/VoidDocumentButton.tsx` — same reorder if needed (verify on read).

No DB, RLS, or business-logic changes.

## Verification

- Re-open the Purchase Invoices page after saving an invoice; list should render normally with no blank screen.
- Console should no longer show "Rendered more hooks than during the previous render".
