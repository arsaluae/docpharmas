

# PharmaZen — Production Floor, Quality Control & Inventory Modules

## Database Schema (Migration)

### New Tables

**`bmr_steps`** — Batch Manufacturing Record steps
- `id` uuid PK, `batch_id` uuid FK→batches, `step_name` text (Weighing/Mixing/Granulation/etc), `step_order` int, `status` text default 'pending', `completed_by` uuid nullable, `completed_at` timestamptz nullable, `yield_expected` numeric, `yield_actual` numeric nullable, `notes` text nullable, `created_at` timestamptz default now()

**`raw_materials`** — Quarantine Vault items
- `id` uuid PK, `name` text, `supplier` text, `lot_number` text, `quantity` numeric, `unit` text, `status` text default 'locked' (locked/released/rejected), `released_by` uuid nullable, `released_at` timestamptz nullable, `received_at` timestamptz default now(), `expiry_date` date, `created_at` timestamptz default now()

**`inventory_items`** — FEFO dashboard
- `id` uuid PK, `name` text, `sku` text, `category` text, `quantity` numeric, `unit` text, `expiry_date` date, `location` text, `cost_per_unit` numeric default 0, `created_at` timestamptz default now(), `updated_at` timestamptz default now()

**`import_folders`** — Landed Costing tracking
- `id` uuid PK, `shipment_name` text, `supplier` text, `status` text default 'in_transit', `lc_number` text, `duties` numeric default 0, `freight` numeric default 0, `insurance` numeric default 0, `total_landed_cost` numeric default 0, `arrival_date` date nullable, `created_at` timestamptz default now()

**`user_roles`** — Admin role for QC release (per security guidelines)
- `id` uuid PK, `user_id` uuid FK→auth.users ON DELETE CASCADE, `role` app_role enum ('admin','moderator','user'), UNIQUE(user_id, role)

**`has_role` function** — Security definer function for RLS

### RLS
- All new tables: authenticated can read. `raw_materials` UPDATE restricted to admin role via `has_role()` for release action. All others: authenticated CRUD.

### Seed Data
- BMR steps for existing batches (Weighing, Mixing, Granulation, Compression, Coating, Quality Check)
- ~8 raw materials in quarantine (locked status, various expiry dates)
- ~12 inventory items with varied expiry dates (some within 90 days for heat map)
- 3 import folders with landed costing data

---

## New Pages & Routes

### 1. `/production` — Production Floor
**Layout**: Two-panel — main area (BMR steps) + right sidebar (Yield Variance)

**BMR Step Cards** (main area):
- Large haptic-style cards (rounded-2xl, soft shadow, min-h-[140px])
- Each card shows: step name (large Sora heading), batch context, status indicator
- **Massive toggle switch** (custom oversized Switch ~h-10 w-20) — workers toggle step complete/incomplete
- Toggle triggers DB update (bmr_steps status → 'completed', records user + timestamp)
- Cards use subtle sapphire border-left accent when active, muted when completed
- Batch selector dropdown at top to pick which batch's BMR to view

**Yield Variance Sidebar** (right panel):
- Per-step yield tracking: expected vs actual with variance %
- Inline editable yield_actual fields
- Visual bar comparing expected/actual per step
- Overall batch yield summary at top

### 2. `/quality` — Quality Control (Quarantine Vault)
**Layout**: Grid of material cards

**Quarantine Vault**:
- Each raw material = a card with "Locked" status and amber/orchid glow border
- Shows: material name, supplier, lot #, quantity, received date, expiry
- **Release Button**: Only visible if current user has admin role (checked via `has_role` DB function call on page load)
- On release click: update `raw_materials` status→'released', record user + timestamp
- **Pulse Ripple Animation**: On successful release, a full-screen radial pulse ripple (sapphire → transparent) emanates from the button using framer-motion
- Rejected items shown with rose/magenta accent

### 3. `/inventory` — Inventory Module
**Layout**: Two sections — FEFO Heat Map + Import Folders

**FEFO Dashboard**:
- Table/grid of inventory items sorted by expiry_date ASC (first-expired first)
- **Heat Map coloring**: Items expiring <30 days = destructive/rose pulse animation, 30-90 days = warning/orchid tint, >90 days = normal
- Items within 90 days have a subtle pulsing border animation
- Shows: name, SKU, category, quantity, location, expiry date, days remaining

**Import Folders Section**:
- Cards per shipment showing landed costing breakdown
- Fields: L/C Number, Duties, Freight, Insurance, Total Landed Cost
- Status pills: In Transit / Customs / Delivered
- Expandable detail view per folder

---

## Files to Create/Modify

### New Files
1. `src/pages/ProductionFloor.tsx` — BMR interface with toggle switches + yield sidebar
2. `src/pages/QualityControl.tsx` — Quarantine Vault with admin release + ripple animation
3. `src/pages/Inventory.tsx` — FEFO heat map + Import Folders
4. `src/components/production/BMRStepCard.tsx` — Haptic toggle card component
5. `src/components/production/YieldVarianceSidebar.tsx` — Yield tracking panel
6. `src/components/quality/QuarantineCard.tsx` — Locked material card with glow
7. `src/components/quality/PulseRipple.tsx` — Full-screen ripple animation component
8. `src/components/inventory/FEFOHeatMap.tsx` — Heat map table
9. `src/components/inventory/ImportFolderCard.tsx` — Landed costing card
10. `src/hooks/useUserRole.tsx` — Hook to check admin role via has_role function

### Modified Files
1. `src/App.tsx` — Add routes for `/production`, `/quality`, `/inventory`
2. `src/components/AppSidebar.tsx` — Update nav items with real URLs: Batches→`/production`, Quality→`/quality`, Inventory→`/inventory`
3. `src/index.css` — Add pulse-ring animation keyframes for the release ripple effect
4. `tailwind.config.ts` — Add ripple animation keyframe

### Technical Details

**Oversized Toggle Switch**: Custom variant of the existing Switch component scaled up (~h-10 w-20 with h-9 w-9 thumb) for glove-friendly interaction.

**Admin Role Check**: `useUserRole` hook calls `supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })` on mount. Release button conditionally rendered.

**Pulse Ripple**: Framer-motion `<motion.div>` with `scale: [0, 30]`, `opacity: [0.4, 0]` over 1.2s, positioned absolute from click origin, `pointer-events-none`.

**FEFO Heat Map**: Uses `date-fns` `differenceInDays` to compute days-to-expiry, applies conditional className for pulsing/color tinting.

**All pages** follow the same authenticated layout pattern as Index: SidebarProvider wrapper, AppSidebar, header with SidebarTrigger.

