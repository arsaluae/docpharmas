## Final Dark Mode Polish

Tighten the dark theme into a genuinely premium surface — Linear / Vercel / Attio caliber — by refining tokens, surface layering, accents, borders, and chrome details. No structural changes; pure visual polish.

### 1. Refined token palette (`src/index.css` `.dark`)

Shift from flat slate to a layered neutral with cool blue undertones and proper elevation steps.

- **Surfaces (4 distinct levels)**
  - `--background: 222 20% 5%`        — app canvas, deepest
  - `--sidebar-background: 222 22% 4%` — slightly deeper than canvas
  - `--card: 222 16% 8%`              — raised surface
  - `--surface-2 / --muted: 222 14% 11%` — inset wells, table headers
  - `--popover: 222 16% 10%`          — overlays
- **Ink**
  - `--foreground: 210 20% 98%`       — primary text, near-white
  - `--muted-foreground: 218 11% 65%` — secondary
  - `--subtle: 220 9% 46%`            — tertiary, captions
- **Borders — two strengths**
  - `--border: 220 13% 16%`           — hairline default
  - `--border-strong: 220 13% 22%`    — hover/active
  - `--input: 222 14% 12%`            — slightly darker than card
- **Brand — indigo with proper dark-mode luminance**
  - `--primary: 239 84% 67%`          — #6366F1 family, vivid on dark
  - `--ring: 239 84% 67%`             — focus glow
  - `--primary-soft`: 239 84% 67% (used with `/0.12` alpha for active states)
- **Status — calibrated for dark legibility**
  - success `158 70% 52%`, warning `38 92% 58%`, danger `351 83% 65%`, info `199 89% 64%`

### 2. Premium elevation system

Three-layer shadow tokens that read as real depth on dark canvas:

```css
--shadow-xs: 0 1px 2px rgba(0,0,0,0.4),
             inset 0 1px 0 rgba(255,255,255,0.04);
--shadow-sm: 0 2px 8px rgba(0,0,0,0.45),
             0 1px 2px rgba(0,0,0,0.3),
             inset 0 1px 0 rgba(255,255,255,0.05);
--shadow-md: 0 8px 24px rgba(0,0,0,0.5),
             0 2px 6px rgba(0,0,0,0.3),
             inset 0 1px 0 rgba(255,255,255,0.06);
--shadow-lg: 0 24px 64px rgba(0,0,0,0.6),
             0 8px 16px rgba(0,0,0,0.4),
             inset 0 1px 0 rgba(255,255,255,0.07);
```

The `inset` highlight is the key — it gives every card a 1px luminous top edge so they read as raised glass, not flat rectangles.

### 3. Sidebar polish (`.dark .mouj-dark-sidebar` overrides)

- Deeper than canvas (`--sidebar-background`) with hairline right border using `--border`
- Brand block: subtle linear gradient from `transparent` to `primary/4` left-to-right, hairline bottom border
- Nav rows: 40px tall, 8px radius, icon at 16px @ `muted-foreground`
- Hover: `bg-foreground/4`, icon → `foreground`
- Active: `bg-primary/12`, text → `foreground`, icon → `primary`, plus 2px `primary` left rail with 60% opacity glow
- Group labels: 11px uppercase, `--subtle`, 0.12em tracking
- Collapse divider: 1px `--border`

### 4. Top bar & chrome polish (`AppLayout.tsx` styling only)

- Header background: `bg-background/70` + `backdrop-blur-xl` + `saturate-150` (glass effect that reads in dark)
- Hairline bottom border with `--border` plus a 1px `inset 0 -1px 0 rgba(255,255,255,0.03)` for the luminous edge
- AI command launcher: `bg-card`, hairline border, `--shadow-xs`; hover lifts to `--shadow-sm` + `border-primary/30`
- Sparkle icon: gradient text from `primary` to `info` (use `bg-clip-text`)
- `⌘K` kbd: `bg-muted` with `--border` hairline, mono 11px, `muted-foreground`
- Bell button: hover ring `--primary / 0.2`; notification dot uses `--danger` with 4px outer ring of `--background` (so it pops cleanly off the card)
- Date chip: `bg-card`, hairline, mono, slight glow `0 0 0 1px rgba(99,102,241,0.0)` → `0.15` on hover

### 5. Theme toggle refinement

The current segmented pill stays — small polish:
- Container: `bg-muted/60`, hairline `--border`, soft inset shadow `inset 0 1px 2px rgba(0,0,0,0.3)`
- Active segment in dark: `bg-card` + `--shadow-xs` + `text-primary` (raised pill on inset track)
- Inactive icons: `text-muted-foreground` → hover `text-foreground`
- 200ms ease-out transition on background, icon scale 0.92 → 1 with `cubic-bezier(0.34, 1.56, 0.64, 1)` for a tactile snap

### 6. Component QA pass (token-driven, no JSX rewrites)

After tokens land, the following inherit automatically — but verify each reads correctly in dark and tweak only token alpha if needed:

- **KPI cards**: `--card` with `--shadow-xs`, hover `--shadow-sm`, hairline border → `border-strong` on hover. Sparkline strokes use `--primary` at full opacity.
- **Tables**: Header `bg-surface-2`, row hover `bg-foreground/3`, hairline `--border` dividers. Tabular numerals stay foreground.
- **Status pills**: success/warning/danger keep colored text + `/15` alpha bg + `/30` alpha border. Verify contrast ≥ 4.5:1 on dark.
- **Dialogs**: `bg-popover`, `--shadow-lg`, hairline border, 1px luminous top edge from inset highlight.
- **Inputs**: `bg-input`, hairline `--border`, focus → `border-primary` + `0 0 0 3px primary/15` ring.
- **Command palette overlay**: glass `bg-popover/95` + `backdrop-blur-xl`, `--shadow-lg`.
- **Scrollbars**: thin (`scrollbar-width: thin`), thumb `--border-strong`, track transparent.

### 7. Subtle delight (low-risk additions)

- Page background gets a single near-invisible radial gradient: `radial-gradient(1200px 600px at 50% -200px, hsl(var(--primary) / 0.06), transparent)` — adds atmosphere without visual noise.
- Theme switch animation: when toggling, root gets a 220ms cross-fade via `transition: background-color 220ms ease-out, color 220ms ease-out` on `html, body` only (not all elements — too expensive).

### Files touched

- `src/index.css` — `.dark` token block, `.dark .mouj-dark-sidebar` overrides, shadow tokens, html/body fade transition, optional ambient radial
- `src/components/AppLayout.tsx` — top bar glass treatment, AI launcher polish, theme toggle inset-track styling, bell ring

### Out of scope

- No changes to light mode tokens or chrome
- No structural JSX changes — only className refinements on chrome elements
- PDF templates untouched (they remain light document surfaces)

### Acceptance

- Four distinct surface levels are visibly stacked (canvas → sidebar → card → surface-2)
- Cards have a faint 1px luminous top edge that reads as raised glass
- Sidebar active row has indigo rail + soft fill + crisp icon tint
- Top bar is glassy (blur + saturate) and the AI launcher feels like the marquee element
- Theme toggle reads as a raised pill on an inset track
- Status pills, focus rings, hover states all pass contrast and feel intentional
- Light mode is byte-identical
