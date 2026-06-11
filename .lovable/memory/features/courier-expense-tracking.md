---
name: Courier expense tracking
description: Transport expenses tagged to freight_providers (NCCS, ADDA, …) with monthly per-courier report
type: feature
---
`freight_providers` is the master courier list (already used for delivery-note dispatch labels). Expenses with `category='transport'` carry `expenses.freight_provider_id` (FK, ON DELETE SET NULL, nullable). The Expenses dialog shows the Courier picker only when category=transport and supports inline "Add new courier" (writes to `freight_providers`, code = uppercased name).

Report: `/reports/courier-expenses` (`src/pages/reports/CourierExpenses.tsx`) — month×courier matrix with drill-down. Excludes voided rows via `applyPosted()` per the posted-only rule. Per-courier ledger is the same report filtered to one courier (drill-down dialog).

NCCS + ADDA are seeded automatically for every tenant; users add more from either Settings → Couriers or inline on the expense form.
