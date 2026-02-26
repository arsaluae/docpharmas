

# PharmaZen — Premium Light Theme Redesign

## Design Philosophy: "Ivory Clinical"

A warm, elegant light palette that feels like a premium pharmaceutical brand — think Apple Health meets a high-end medical device interface. No harsh whites, no sterile blues. Instead: warm ivory backgrounds, soft cool grays, and refined sapphire accents.

```text
┌──────────────────────────────────────────────────┐
│  BACKGROUNDS                                     │
│  Base:       #FAFBFD  (Ivory White)              │
│  Surface:    #F1F3F8  (Soft Lavender Gray)       │
│  Card:       #FFFFFF  (Pure White)               │
│  Sidebar:    #F5F6FA  (Cool Mist)               │
│                                                  │
│  PRIMARY ACCENTS                                 │
│  Primary:    #4F6DF7  (Electric Sapphire)        │
│  Accent:     #A78BFA  (Soft Violet)              │
│                                                  │
│  SEMANTIC STATES                                 │
│  Warning:    #8B5CF6  (Orchid Violet)            │
│  Critical:   #EC4899  (Rose Pink)                │
│                                                  │
│  TEXT                                            │
│  Foreground:    #1A1D2B  (Deep Ink)              │
│  Muted:         #6B7280  (Warm Gray)             │
│  Subtle:        #9CA3AF  (Light Slate)           │
│                                                  │
│  BORDERS & SURFACES                              │
│  Border:     #E5E7EB  (Whisper Gray)             │
│  Input:      #E5E7EB                             │
│                                                  │
│  SOFT SHADOWS (replace glows)                    │
│  Cards: 0 1px 3px rgba(0,0,0,0.04),             │
│         0 4px 16px rgba(0,0,0,0.06)              │
│  Floating rows: 0 1px 8px rgba(0,0,0,0.04)      │
└──────────────────────────────────────────────────┘
```

## Files to Change

### 1. `src/index.css`
- Rewrite all CSS custom properties to the Ivory Clinical light palette
- Update glassmorphism classes: white cards with very soft shadows instead of dark glass + glows
- Floating rows become white with subtle shadows
- Status pills use softer, pastel-tinted backgrounds
- Scrollbar updated to light grays
- Remove `.dark` block

### 2. `tailwind.config.ts`
- Remove `darkMode` setting
- Font family stays (Sora + DM Sans are perfect)

### 3. `src/components/dashboard/BatchOrbit.tsx`
- Update hardcoded HSL colors in SVG strokes and statusColor() to work on light background
- Progress ring track becomes light gray instead of dark

### 4. `src/components/dashboard/AlertFeed.tsx`
- Severity colors stay (sapphire/orchid/rose) but border and background tints adjusted for light

### 5. `src/components/dashboard/KPICards.tsx`
- No structural changes, colors come from CSS variables

### 6. `src/components/AppSidebar.tsx`
- Sidebar uses cool mist background, active items have sapphire tint on white

### 7. `src/pages/Auth.tsx`
- Background gradient orbs become very subtle pastel washes on ivory
- Card becomes white with soft shadow

### 8. `src/pages/Index.tsx`
- Header becomes white/transparent with soft bottom border

