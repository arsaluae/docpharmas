# UI/UX Uplift — Dark-First, Quieter Sidebar

A focused refresh that makes the app feel like a crafted product (less "AI default"), tuned primarily for dark mode, with a calmer left rail.

## 1. Dark mode redesign (primary)

Replace the current generic navy/teal dark theme with a richer, more editorial palette:

- **Background**: near-black with a warm graphite tint (not the current cool navy `222 47% 8%`) — `225 15% 6%` base, `225 14% 9%` for surfaces, `225 12% 12%` for elevated cards. Gives depth without the "Bootstrap dark" look.
- **Single signature accent**: drop the triple teal+violet+sage gradient everywhere. Pick **one** accent — a refined cyan-mint (`172 75% 55%`) — used sparingly for active states, primary CTAs, and focus rings only. Violet/sage stay as data-viz only (charts, status pills).
- **Typography contrast**: foreground at `40 15% 92%` (slight warm tint) instead of pure cool gray — easier on eyes for long sessions.
- **Borders**: hairline `225 10% 18%` with 60% opacity by default; no heavy dividers.
- **Shadows**: replace black box-shadows with layered inner highlights + soft ambient glow tinted by accent at <5% opacity. Real depth, not flat darkness.
- **Remove**: the rainbow `pharma-accent-line`, the animated `gradient-border` rotation, the shimmer overlays. They read as "AI template". Keep one subtle top-edge accent on KPI/table cards using the single accent at low opacity.

Light mode gets the same restraint applied — single accent, warmer neutrals — but stays secondary in polish work.

## 2. Sidebar — calmer & flatter

Current sidebar has 6 collapsible sections + Dashboard + Admin + footer block with user card, theme toggle, shortcuts dialog, logout. Too busy.

**New structure (flat where possible, grouped only when needed):**

```
Dashboard
─────────
Sales            (collapsible, default open if active)
Purchase         (collapsible)
Inventory        (collapsible)
Finance          (collapsible)
─────────
Reports          (single link → /reports hub, no children in sidebar)
─────────
Settings  ⚙      (icon-only at bottom, opens menu: Company, Data Import, Subscription, Shortcuts, Theme, Admin Panel if admin)
Logout
```

Specific changes:
- **Reports section → single link.** "AI Insights" moves inside the Reports page as a tab. Removes one whole collapsible.
- **Settings section → bottom icon with popover menu.** Company Settings, Data Import, Subscription, Keyboard Shortcuts, Theme toggle, and Admin Panel all live inside that one menu. Removes the Settings collapsible AND the Admin Panel top-level item AND the inline theme/shortcuts buttons in the footer.
- **Footer block simplified**: just the tenant chip + Settings icon + Logout icon in a single row. No big avatar card, no separate theme/shortcut buttons taking vertical space.
- **Visual polish**: remove the `pharma-sidebar-active` gradient, the pulsing dot, the left-edge accent bar, the `border-l-2 border-primary/10` rail under expanded groups. Replace with: bold active-row background using accent at 10%, accent-colored text, no animation. One signal, not four.
- **Section labels**: drop the uppercase tracking-wide chip-with-icon row; use a simple muted label + chevron. Section icons removed from headers (icons stay on items).
- **Brand header**: keep logo + name, drop the green pulse dot and tenant subtitle (tenant info already in footer chip).

Net effect: fewer pixels of chrome, more breathing room, one clear active state.

## 3. Component polish (dark-mode pass)

- **KPI cards (`.glass-kpi`)**: remove rainbow top border on hover. Replace with subtle accent glow on hover (`box-shadow: 0 0 0 1px accent/20, 0 8px 32px accent/8`). Inner highlight only on light mode.
- **Tables (`.premium-table-card`)**: remove the always-on rainbow top stripe. Use a single 1px accent line at low opacity. Row hover: background tint only, no left-edge bar.
- **Buttons**: `.btn-gradient` becomes flat accent with subtle inner highlight; hover lifts shadow, no transform on press for primary actions (keep `press-scale` on icon buttons).
- **Dialogs**: drop `dialog-accent` rainbow strip; use accent-tinted header background instead.
- **Search pill**: keep, but tighten focus ring to single accent at 25% (currently mixes ring + border + shadow).

## 4. Motion restraint

Keep: `stagger-fade-up` on first paint, `press-scale` on buttons, sidebar collapsible animation.
Remove: `gradient-rotate` (4s loop on every hovered card), `pulse-glow`, shimmer-line, animated pulse dot on sidebar active items. Constant motion = AI-template tell.

---

## Technical scope

| File | Change |
|---|---|
| `src/index.css` | Rewrite `.dark` tokens (bg/fg/border/accent), simplify `.glass-kpi` / `.summary-card` / `.premium-table-card` / `.pharma-sidebar-active` / `.dialog-accent` / `.btn-gradient`, remove `gradient-rotate` / `pulse-glow` / `shimmer-line` animations |
| `tailwind.config.ts` | No structural change (tokens stay HSL-var based) |
| `src/components/AppSidebar.tsx` | Restructure sections (Reports → single, Settings → bottom popover), simplify active states, simplify footer, remove brand pulse dot |
| `src/components/ThemeToggle.tsx` | Adapt for use inside Settings popover (compact variant) |
| `src/pages/Reports.tsx` | Add "AI Insights" as a tab so it's still reachable after sidebar entry is removed |
| Light-mode tokens | Light pass kept minimal — same accent, warmer neutrals, no rainbow strips |

No DB changes. No route removals (AI Insights route stays at `/insights` and is also embedded in Reports).

## Out of scope

- Per-page redesigns beyond the shared component tokens (Dashboard hero, individual forms, etc.) — those follow naturally from the token changes but aren't rewritten one-by-one.
- New illustrations / iconography swap.