

# UI Overhaul — Premium Branded Experience

## Problem
The current UI uses basic glass-card styling and standard component layouts. While functional, it lacks the visual craft, depth, and brand identity that makes a product feel premium. The dashboard, sidebar, listing pages, and global styling all need refinement.

## Design Direction
Elevate from "functional tool" to "crafted product" through:
- **Depth & layering**: Refined shadows, subtle gradients, animated borders on key elements
- **Brand presence**: DocPharmas identity woven into every surface (accent meshes, branded empty states, logo echoes)
- **Micro-polish**: Better spacing rhythms, refined typography hierarchy, purposeful color usage
- **Motion with intent**: Smooth transitions that feel intentional, not decorative

## Changes

### 1. Global CSS — New Premium Utilities (`src/index.css`)
- Add animated gradient border utility (`.gradient-border`) for KPI cards
- Add mesh gradient background utility for dashboard hero section
- Add refined card hover with directional shadow shift
- Add subtle dot-pattern overlay for empty states
- Improve table row hover with left-edge accent reveal
- Add frosted toolbar effect for sticky headers

### 2. Dashboard (`src/pages/Index.tsx`)
- **Hero greeting**: Replace plain text with a branded section — mesh gradient background, company name prominent, date in a refined pill
- **KPI cards**: Add animated gradient border on hover, refine internal layout with better visual hierarchy
- **Quick actions grid**: Improve with subtle mesh bg per card, better icon presentation with ring effects
- **Charts**: Better container styling with subtle header underlines
- **AI Insights CTA**: Make it more visually striking with animated gradient border

### 3. Sidebar (`src/components/AppSidebar.tsx`)
- Add subtle gradient mesh to brand header area
- Improve section dividers with labeled badges
- Add smooth icon transition on active state
- Better footer user card with status indicator

### 4. App Header (`src/components/AppLayout.tsx`)
- Refined header with better title typography
- Subtle breadcrumb-style subtitle treatment
- Better date badge with gradient accent

### 5. Listing Pages Pattern (Customers as reference)
- Improve summary strip cards with icon rings and subtle gradients
- Better search bar with floating label effect
- Refine table card with top accent line
- Better empty state illustrations

## Files to Edit
| File | Change |
|------|--------|
| `src/index.css` | Add 8-10 new premium utility classes |
| `src/pages/Index.tsx` | Redesign dashboard hero, KPI cards, quick actions, CTA |
| `src/components/AppSidebar.tsx` | Polish brand header, section labels, footer |
| `src/components/AppLayout.tsx` | Refine header styling and date badge |
| `src/pages/Customers.tsx` | Upgrade summary strip and table card as reference pattern |

