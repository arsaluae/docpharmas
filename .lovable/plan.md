

# PharmaZen — Premium UI/UX Redesign

## Problem with Current Design
The current palette uses Clinical Teal (#00F5D4 — reads green), Warning Amber (#FFEE32 — yellow), and Audit Crimson (#FF5A5F — red). All three are explicitly ruled out. The fonts (Inter + Space Grotesk) are generic and don't feel premium or pharma-specific.

---

## New Color System: "Sapphire Clinical"

A pharma-grade palette built on deep navy, electric blue, and violet — evoking precision, trust, and clinical authority.

```text
┌─────────────────────────────────────────────┐
│  BACKGROUNDS                                │
│  Base:     #070B14  (Deep Obsidian Navy)     │
│  Surface:  #0F1629  (Elevated Panel)        │
│  Card:     #141B2E  (Glass Surface)         │
│                                             │
│  PRIMARY ACCENTS                            │
│  Primary:  #4F6DF7  (Electric Sapphire)     │
│  Accent:   #A78BFA  (Soft Violet)           │
│                                             │
│  SEMANTIC STATES                            │
│  Active:   #6C8CFF  (Bright Sapphire)       │
│  Caution:  #C084FC  (Orchid)                │
│  Critical: #F472B6  (Hot Magenta)           │
│                                             │
│  TEXT                                       │
│  Foreground:  #E2E8F0  (Cool Silver)        │
│  Muted:       #64748B  (Slate)              │
│  Subtle:      #475569  (Deep Slate)         │
│                                             │
│  GLOW                                       │
│  Primary glow: #4F6DF7 / 0.3               │
│  Caution glow: #C084FC / 0.3               │
│  Critical glow: #F472B6 / 0.3              │
└─────────────────────────────────────────────┘
```

## New Typography

Replace Inter + Space Grotesk with a premium pairing from Google Fonts:

- **Headings**: **Sora** — geometric, modern, feels like precision engineering. Perfect for pharmaceutical branding.
- **Body/Data**: **DM Sans** — clean, excellent readability at small sizes, pairs beautifully with Sora.

## Files to Change

### 1. `src/index.css`
- Replace Google Fonts import (Sora + DM Sans instead of Inter + Space Grotesk)
- Rewrite all CSS custom properties with the new Sapphire Clinical palette
- Update glassmorphism utility classes to use new glow colors
- Update status pill classes (`.status-active`, `.status-quarantine`, `.status-critical`) with new accent colors

### 2. `tailwind.config.ts`
- Update `fontFamily` to use Sora (headings) and DM Sans (body)
- All color tokens already reference CSS variables — no changes needed beyond font

### 3. `src/components/dashboard/KPICards.tsx`
- Replace `text-primary`, `text-warning`, `text-destructive` references to use the new semantic classes
- Remove any explicit green/yellow/red color references

### 4. `src/components/dashboard/BatchOrbit.tsx`
- Replace hardcoded HSL colors in `statusColor()` function with new palette values
- Update SVG stroke colors from teal to Electric Sapphire
- Update glow/shadow references

### 5. `src/components/dashboard/AlertFeed.tsx`
- Update `severityConfig()` to use new semantic colors (Orchid for caution, Hot Magenta for critical, Sapphire for info)

### 6. `src/components/dashboard/BatchTable.tsx`
- Update `statusLabel()` to map statuses to new color classes

### 7. `src/components/AppSidebar.tsx`
- Update active state indicator colors from primary/teal to Sapphire
- Logo glow effect updated

### 8. `src/pages/Auth.tsx`
- Update background blur orbs from teal/destructive to Sapphire/Violet
- Button styling to new primary

### 9. `src/pages/Index.tsx`
- Minor: pulse indicator on bell icon uses new critical color (already via CSS var)

