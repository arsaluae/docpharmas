

# UX Enhancement Plan: Global Search, Shortcuts, Breadcrumbs & Fewer Clicks

Based on your priorities, here is a phased plan to make DocPharmas significantly faster and easier to use.

---

## Phase 1: Global Search (Ctrl+K Command Palette)

A spotlight-style search dialog that lets you jump to any page, customer, supplier, product, or invoice instantly.

- Create `src/components/CommandPalette.tsx` using the existing `cmdk` package (already installed)
- Register `Ctrl+K` / `Cmd+K` listener globally in `AppLayout.tsx`
- Sections inside the palette:
  - **Navigation** — All sidebar pages (Dashboard, Customers, Products, etc.)
  - **Quick Actions** — New Sales Invoice, New Purchase Order, Add Customer, Add Product
  - **Recent Items** — Last 5 visited pages (stored in localStorage)
- Fuzzy matching on all items for fast filtering
- Styled with the existing glassmorphism/frosted aesthetic

## Phase 2: Keyboard Shortcuts

- `Ctrl+K` — Command palette (from Phase 1)
- `Ctrl+N` — New record (context-aware: new invoice on invoices page, new customer on customers page)
- `Escape` — Close any open dialog
- Add a small "Shortcuts" hint in the sidebar footer (`?` icon) that shows a cheat sheet dialog

## Phase 3: Breadcrumbs & Recent Items

To address "hard to find things":

- Add a breadcrumb bar below the header in `AppLayout.tsx` (e.g., `Sales > Sales Invoices > #INV-0042`)
- Add a "Recent Pages" section at the top of the Command Palette showing the last 5-8 visited routes
- Add a "Favorites" star icon on each sidebar item, persisted to localStorage, pinned at top of sidebar

## Phase 4: Reduce Clicks

- **Inline status changes** — Click a status badge directly to cycle through statuses (Draft → Invoice → Paid) via a small dropdown, instead of opening the full edit dialog
- **Row-level quick actions** — Hover to reveal Print / WhatsApp / Payment icons directly on table rows (already partially implemented, will expand)
- **Auto-focus** — When any dialog opens, auto-focus the first meaningful input field

## Phase 5: Dark Mode (future)

- Leverage the existing `next-themes` package to add a theme toggle
- Define dark mode CSS variables in `index.css` under a `.dark` class
- Add a sun/moon toggle to the sidebar footer

---

## Files to Create/Edit

| File | Action |
|------|--------|
| `src/components/CommandPalette.tsx` | **Create** — Full command palette with navigation, actions, recent items |
| `src/components/AppLayout.tsx` | **Edit** — Add Ctrl+K listener, render CommandPalette, add breadcrumbs |
| `src/components/AppSidebar.tsx` | **Edit** — Add shortcuts hint icon in footer |
| `src/components/KeyboardShortcuts.tsx` | **Create** — Global shortcut handler + cheat sheet dialog |
| `src/index.css` | **Edit** — Dark mode CSS variables (Phase 5) |

## Implementation Order

Phases 1-4 will be implemented now. Phase 5 (Dark Mode) can follow as a separate step since it requires careful color calibration across all components.

