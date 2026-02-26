

# PharmaZen — Pharmaceutical ERP Dashboard

## Design System
- **Theme**: "Midnight Laboratory" — dark base (#0D1117), elevated surfaces (#161B22)
- **Glassmorphism**: Semi-transparent cards with backdrop-blur, subtle glowing teal borders
- **Accents**: Clinical Teal (#00F5D4) for active/success, Warning Amber (#FFEE32) for quarantine, Audit Crimson (#FF5A5F) for alerts
- **Typography**: Space Grotesk for headings, Inter for body/data
- **Tables**: Floating rows with soft shadows on dark backgrounds — no white tables

## Layout
- **Sidebar**: Collapsible dark sidebar with glowing active-state indicators, icon-based navigation
- **Main area**: Full-width dashboard with top header bar showing user info and notifications

## Dashboard Features

### Batch Orbit Widget (centerpiece)
- Animated circular 3D-style progress ring showing active production batches
- Glowing teal ring with batch name, progress %, and status
- Orbiting dots representing individual batches

### KPI Cards (top row)
- Active Batches, Quarantine Items, Compliance Score, Pending QC — glassmorphic cards with glowing accents

### Recent Batch Activity (floating table)
- Dark floating rows with soft shadows, status pills (teal/amber/crimson), batch details

### Alert Feed (sidebar panel)
- Live-style feed of critical alerts and quarantine notices with color-coded severity

## Backend (Supabase)
- **Tables**: `batches` (id, name, product, status, progress, stage, created_at, updated_at), `alerts` (id, type, severity, message, batch_id, created_at, resolved)
- **Auth**: Basic authentication setup for the ERP
- **RLS**: Row-level security on all tables
- **Seed data**: Realistic pharmaceutical batch and alert demo data

## Pages
- `/` — Dashboard (main view described above)
- `/auth` — Login page styled to match the theme

