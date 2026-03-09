

# Fix: Submitted Orders Show in Both Tabs + Undo "Mark Delivered"

## Issues

1. **Submitted orders should appear in both Invoice AND Delivery Notes tabs** — Currently the DN tab only loads when clicked; after submit, user has to manually click the DN tab to see it. The post-submit flow already creates both documents but the DN tab count doesn't update until clicked.

2. **"Mark Delivered" has no undo** — Once clicked, there's no way to revert back to "Issued". The only option is the Void button which deletes everything (invoice, stock, DN).

3. **Void button on DN tab does full rollback** — This is correct for voiding, but user wants a SEPARATE undo for just the "delivered" status toggle.

## Changes — `src/pages/ProformaInvoices.tsx`

### 1. Auto-refresh DN tab after submit
- In `handleSubmit`, after success, also call `loadDeliveryNotes()` so the DN tab count updates immediately in the status buttons.

### 2. Add "Undo Delivered" toggle
- When `dn.status === "delivered"`, show an undo button (RotateCcw icon in amber, NOT destructive) that sets status back to `"issued"` — just a simple status update, no invoice/stock rollback.
- Keep the existing Void button (destructive) separate for full rollback.

### 3. UI for delivered status toggle
```
Issued state:   [Truck icon] Mark Delivered
Delivered state: [RotateCcw icon] Undo Delivered  (amber, not red)
```
The Void button (red RotateCcw) remains separate and always visible.

### 4. Ensure DN count in status buttons updates
- Call `loadDeliveryNotes()` on initial load and after submit, so the count badge is always current.

## Summary of button changes in DN Actions column:
- **Eye** — View DN PDF (always)
- **Truck** (emerald) — Mark Delivered (only when issued)
- **RotateCcw** (amber) — Undo Delivered (only when delivered) — just toggles status
- **RotateCcw** (red/destructive) — Void (always) — full cascade delete

