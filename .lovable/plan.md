# Darker redesign — Sidebar + Auth

Replace the current ivory/glass treatment on the **sidebar** and **Auth page** with a flat, solid Midnight Indigo dark surface. Hard edges, thin 1px borders, no blur, no glow, no glass — a proper product-design feel rather than the generic "AI dashboard glow."

Scope is strictly the sidebar (`AppSidebar.tsx`) and the Auth screen (`Auth.tsx`). The rest of the app (dashboard, KPIs, tables) keeps its current light theme. The dark palette is applied via scoped local classes on those two surfaces only — no changes to `index.css` root tokens, so nothing else shifts.

## Visual direction

**Palette (local, scoped)**
- Surface base: `#0A0A1A` (near-black indigo)
- Panel: `#141432`
- Border / hairlines: `#1F1F3D`
- Muted text: `#8A8AB0`
- Primary text: `#EDEDF5`
- Accent: `#4F46E5` (indigo) — used sparingly for active state, focus ring, primary CTA

**Type**
- Headings: Sora (already loaded)
- Body / nav labels: Manrope (add to existing Google Fonts import in `index.css`)
- Nav labels: 13px, medium weight, slight letter-spacing (0.01em), no uppercase

**Surface treatment**
- Flat solid fills, 1px borders, zero backdrop-blur
- No `glass-card`, no `mesh-hero`, no `glow-primary`, no shadows behind logo
- Section dividers: 1px hairline `#1F1F3D`
- Active nav row: solid `#1E1E5A` fill, 2px left accent bar in `#4F46E5`, no background gradient
- Hover: subtle `#141432 → #181838` fill swap, instant

## Sidebar (`src/components/AppSidebar.tsx`)

```text
┌─────────────────────┐
│  [MOUJ logo]        │  ← top, left-aligned, 32px tall, no card around it
├─────────────────────┤  ← 1px hairline
│ ▣ Dashboard         │  ← active: indigo fill + 2px left bar
│                     │
│ SALES         ▾     │  ← group label uppercase 10px tracked, muted
│   Quotations        │
│   Invoices          │
│ PURCHASE      ▾     │
│   …                 │
├─────────────────────┤
│ ▤ Reports           │
└─────────────────────┘
│ AD  My Company      │  ← footer, flat row, no card
│     Admin           │
│              ⚙  ⎋   │
```

Changes:
- Strip every `glass-*`, `mesh-*`, gradient, and shadow utility from the file
- Wrap sidebar contents in a local class (e.g. `mouj-sidebar-dark`) defined in `index.css` `@layer components`, scoped so it only paints when applied
- Logo container: plain, no background card, 14px padding
- Group labels: uppercase, 10px, `#6A6A8A`, 1px hairline above each group
- NavLink: flat row, 36px tall, 12px horizontal padding, no rounded-2xl — use `rounded-sm` (matches `--radius: 4px`)
- Active state: solid `#1E1E5A` + `border-l-2 border-[#4F46E5]`, no glow
- Footer: flat row separated by hairline, avatar = 28px solid square (not pastel chip)
- Theme toggle + sign-out: icon-only ghost buttons, no hover bg blob

## Auth page (`src/pages/Auth.tsx`)

```text
        ┌──────────────────────┐
        │                      │
        │     [MOUJ logo]      │
        │                      │
        │   Welcome back       │  ← Sora 20px
        │   Sign in to MOUJ    │  ← Manrope 13px muted
        │                      │
        │   Email   [_______]  │  ← flat input, 1px border, 40px tall
        │   Pass    [_______]  │
        │                                 Forgot? │
        │   ┌──────────────────────────┐         │
        │   │      Sign In         →   │  ← solid indigo, no gradient
        │   └──────────────────────────┘
        └──────────────────────┘
```

Changes:
- Page background: solid `#0A0A1A`, remove both blurred color blobs
- Card: solid `#141432`, 1px border `#1F1F3D`, `rounded-md`, no `glass-card-glow`, no shadow stack
- Inputs: transparent fill, 1px border `#2A2A4A`, focus ring = 1px `#4F46E5` (no soft 3px halo)
- Submit button: solid `#4F46E5`, hover `#4338CA`, no `btn-gradient`
- Logo: 48px tall, plain, no surrounding box
- Drop the decorative blobs entirely

## Technical notes

- Add `Manrope` to the Google Fonts `@import` at the top of `src/index.css`
- Add one scoped block in `src/index.css` `@layer components` with the dark tokens and the few utilities (`.mouj-sidebar-dark`, `.mouj-auth-dark`) — keeps the dark palette local and reversible
- No changes to `tailwind.config.ts`, no changes to root `:root` / `.dark` token blocks
- No DB or backend changes
- Files touched:
  - `src/index.css` (append fonts + scoped component block)
  - `src/components/AppSidebar.tsx` (replace class usage, restructure rows)
  - `src/pages/Auth.tsx` (replace classes, drop decorative blobs)

After implementation I'll screenshot the sidebar + auth in the preview to confirm the flat, dark look lands as intended.
