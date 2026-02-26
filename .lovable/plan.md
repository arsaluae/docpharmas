

# Compliance & Finance Layer for PharmaZen

## Overview
Four features: Invoicing with FBR QR mockup, Audit Vault with DNA-strand batch timeline, Ambient Glow notification system, and hard-lock quarantine logic in Production.

## Database Changes (Migration)

**`invoices` table** — stores invoice records
- `id` uuid PK, `invoice_number` text UNIQUE, `batch_id` uuid nullable, `customer_name` text, `customer_ntn` text, `items` jsonb default '[]', `subtotal` numeric default 0, `tax` numeric default 0, `total` numeric default 0, `status` text default 'draft' (draft/finalized), `fbr_qr_data` text nullable, `finalized_at` timestamptz nullable, `finalized_by` uuid nullable, `created_at` timestamptz default now()
- RLS: authenticated CRUD

**`audit_events` table** — tracks batch genealogy events for the DNA strand timeline
- `id` uuid PK, `batch_id` uuid FK→batches, `event_type` text (e.g. 'raw_material_received', 'qc_released', 'production_started', 'step_completed', 'qc_passed', 'dispatched'), `event_label` text, `actor_name` text nullable, `entity_name` text nullable, `metadata` jsonb default '{}', `occurred_at` timestamptz default now(), `created_at` timestamptz default now()
- RLS: authenticated SELECT/INSERT

**`notifications` table** — stores priority alerts for the ambient glow system
- `id` uuid PK, `user_id` uuid nullable, `priority` text default 'info' (teal/amber/red/info), `title` text, `message` text, `read` boolean default false, `source_type` text nullable, `source_id` uuid nullable, `created_at` timestamptz default now()
- RLS: authenticated read (filtered by user_id or global where user_id is null)

No changes to existing tables needed — the quarantine hard-lock is enforced via a frontend query join (only show released materials in Production material selector).

## New Pages & Components

### 1. `/invoicing` — Invoicing Page
- List of invoices with status pills (Draft / Finalized)
- Create invoice form: customer name, NTN, line items (name, qty, rate), auto-calc subtotal/tax/total
- **"Direct-to-FBR" finalize button** on each draft invoice
- On click: updates status to 'finalized', generates a visual QR code mockup containing invoice data (rendered as an SVG QR-code pattern — not a real QR library, a visual mockup using a grid pattern with the invoice number encoded visually)
- Finalized invoice shows the QR code prominently with "FBR Verified" badge

### 2. `/audit` — Audit Vault (One-Click DRAP Audit)
- Batch selector dropdown at top
- **DNA Strand vertical timeline**: a centered vertical line with alternating left/right event nodes
- Each node is a card showing: event type icon, label, actor, timestamp, entity
- Events traced from raw material vendor receipt → QC release → production steps → final QC → dispatch
- Data sourced by joining `audit_events` for the selected batch
- Visual: vertical line with dots, connecting lines, alternating sides, color-coded by event type

### 3. Ambient Glow System (Global Component)
- `AmbientGlow.tsx` — a fixed overlay with 4 edge strips (top/bottom/left/right)
- Subscribes to `notifications` table via realtime
- When unread notification arrives, edges pulse in the priority color:
  - Teal (`#14B8A6`) for batch completion
  - Amber/Orchid (`#8B5CF6`) for warnings
  - Red/Rose (`#EC4899`) for audit alerts
  - Sapphire (`#4F6DF7`) for info
- Glow fades after 5 seconds or on dismiss
- Small notification badge in header shows count
- Wrapped in App.tsx around all authenticated routes

### 4. Quarantine Hard-Lock in Production
- Modify `ProductionFloor.tsx`: when a BMR step involves material selection (Weighing step), query `raw_materials` and only show items where `status = 'released'`
- Add a "Materials" indicator on the BMR step card showing which materials are available
- Locked materials shown as disabled/greyed with a lock icon and tooltip "Pending QC Release"

## Files to Create

1. `src/pages/Invoicing.tsx` — invoice list + create + FBR finalize
2. `src/pages/AuditVault.tsx` — DRAP audit DNA strand timeline
3. `src/components/invoicing/InvoiceCard.tsx` — individual invoice card
4. `src/components/invoicing/FBRQRCode.tsx` — visual QR code mockup SVG
5. `src/components/audit/DNATimeline.tsx` — vertical DNA strand timeline
6. `src/components/audit/TimelineNode.tsx` — individual timeline event node
7. `src/components/notifications/AmbientGlow.tsx` — edge-glow overlay
8. `src/hooks/useNotifications.tsx` — realtime notification subscription hook

## Files to Modify

1. `src/App.tsx` — add `/invoicing` and `/audit` routes, wrap with AmbientGlow
2. `src/components/AppSidebar.tsx` — add "Invoicing" (FileText icon) and "Audit" (ScrollText icon) nav items, replace placeholder Alerts/Settings
3. `src/pages/ProductionFloor.tsx` — add released-materials query, pass `disabled` prop to BMRStepCard when materials not released
4. `src/components/production/BMRStepCard.tsx` — show lock icon + "Awaiting QC" when disabled
5. `src/index.css` — add ambient-glow keyframes (edge pulse animation)
6. `tailwind.config.ts` — add ambient-glow animation + teal color variable

## Seed Data

- 3 sample invoices (2 draft, 1 finalized with QR data)
- ~15 audit events across existing batches (raw material receipt → QC → production → dispatch)
- 3 sample notifications (one teal, one red, one amber)

