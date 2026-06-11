## Dark Mode + Top-Bar Theme Toggle

Add an aesthetic, premium dark mode that mirrors the Stripe-style light theme, plus a light/dark switch in the top bar. Theme persists per user and respects system preference on first load.

### 1. Theme tokens (`src/index.css`)

Refine the existing `.dark` block so dark mode feels like a true premium counterpart to the light theme (not just inverted):

- Surfaces
  - `--background: 222 24% 7%` (deep slate-black, not pure black)
  - `--card: 222 22% 9%`
  - `--muted: 222 18% 12%`
  - `--sidebar: 222 24% 6%` (slightly deeper than bg for layering)
  - `--popover: 222 22% 10%`
- Ink
  - `--foreground: 210 30% 96%`
  - `--muted-foreground: 215 16% 65%`
- Lines & focus
  - `--border: 220 14% 18%` (hairline, low-contrast)
  - `--input: 220 14% 16%`
  - `--ring: 243 75% 65%` (indigo glow)
- Brand & status (slightly desaturated for dark)
  - `--primary: 243 75% 65%` / `--primary-foreground: 0 0% 100%`
  - success/warning/danger/info tuned ~10% lighter than light mode
- Elevation: redefine `--shadow-sm-soft` / `--shadow-md-soft` using `rgba(0,0,0,.35/.5)` plus a 1px inner highlight (`inset 0 1px 0 rgba(255,255,255,.04)`) so cards read as lifted glass.
- Sidebar override: update `.dark .mouj-dark-sidebar` so it uses the new sidebar token (deeper than bg), indigo active row with subtle left accent, and hairline `--border` dividers — matching the light variant's structure.

### 2. Theme provider

Add `src/components/theme-provider.tsx` — a tiny context that:
- Reads stored theme from `localStorage` key `docpharmas-theme` (`light` | `dark` | `system`).
- Falls back to `prefers-color-scheme` when `system`.
- Toggles the `.dark` class on `<html>`.
- Exposes `useTheme()` with `theme` and `setTheme`.

Wrap `<App />` in `src/App.tsx` with `<ThemeProvider defaultTheme="light">`. Default stays light (current look) so existing users see no change until they toggle.

### 3. Top-bar toggle

In `src/components/AppLayout.tsx`, add a segmented light/dark switch in the top bar, placed left of the notifications bell:

```text
[ ☀  ◐ ]   <- 2-segment pill, 28px tall, hairline border, indigo active pill
```

- Two icons: `Sun` and `Moon` from `lucide-react`.
- Active segment uses `bg-primary/10 text-primary` with a soft inner shadow.
- Hover state: `bg-muted`.
- Accessible: `role="group"`, each button has `aria-label` and `aria-pressed`.
- Animation: 150ms ease-out background transition, icon scales 0.95→1 on activate.

No separate settings page — the top-bar control is the single source of truth.

### 4. Component QA pass (visual only)

After tokens land, sanity-check these surfaces in dark mode and tweak token values if anything reads flat. No structural changes:
- Sidebar (active row, hover, collapsed state)
- Top bar + Command Palette overlay (glass should still read as lifted)
- Dashboard KPI cards, sparkline strokes, AI insight card
- Sales/Purchase hub tables (zebra off, hairline rows still visible)
- Status pills (success/warning/danger contrast on dark muted bg)
- Dialogs / PdfPreviewDialog chrome (PDF body itself stays white — it's a document)

### Out of scope

- No changes to PDF templates (invoices stay light — they're print documents).
- No auth/profile persistence (localStorage is enough; can move to `profiles.theme` later if requested).
- No new "system" UI affordance beyond the 2-segment toggle (system is the implicit default before first click).

### Files touched

- `src/index.css` — refine `.dark` tokens, shadows, sidebar override
- `src/components/theme-provider.tsx` — new
- `src/App.tsx` — wrap with ThemeProvider
- `src/components/AppLayout.tsx` — add top-bar toggle

### Acceptance

- Toggle in top bar flips entire app between light and dark instantly, with no flash on reload.
- Dark mode feels premium: layered surfaces, hairline borders visible, indigo accents glow subtly, tabular numbers stay crisp.
- Light mode is byte-identical to current.
- Choice persists across reloads; first-time visitors get light by default.
