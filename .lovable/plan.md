

# Plan: Light Landing Page + Enhanced Subscription Management

## 1. Landing Page — Light, Soothing Redesign

Complete color overhaul from dark navy/coral to a calming, warm palette:

**New Palette:**
- Background: Soft ivory/white (`#FAFBFD`, `#F8FAFC`)
- Primary accent: Soft teal/ocean (`#0EA5E9`, `#06B6D4`) — calming, professional
- Secondary: Warm lavender (`#8B5CF6`) — gentle, positive
- Success/trust: Soft sage green (`#10B981`) — growth, health
- Text: Warm charcoal (`#1E293B`, `#475569`)
- Cards: Pure white with soft shadows
- NO red anywhere — replace all `#FF6B6B` with teal or lavender accents
- NO dark backgrounds — all sections light

**Sections updated:**
- Navbar: White with subtle bottom border
- Hero: Light gradient (ivory → soft blue tint), no dark shapes
- Pain points: Reframed as "Challenges We Solve" — positive framing, lavender/teal accents instead of red
- Features: White cards on light gray background
- Stats: Light section with colored number accents
- Testimonials: White cards with soft shadows
- Pricing: Light cards, teal "Best Value" badge instead of red
- CTA: Soft gradient, no aggressive pulsing
- Footer: Light gray

**CSS changes:** Update `index.css` landing utilities — replace dark gradients with light ones, remove coral pulse animation, add soft glow variants

## 2. Subscription Page — Admin Features for Tenant Owners

Add tenant-owner management capabilities to `/subscription`:

**New sections (visible to tenant owner role):**
- **Sub-User Management**: List all tenant users, create new sub-users (calls existing `manage-tenant` edge function), toggle active/inactive
- **Access Request Approval**: If a user requests access to the tenant, the owner can approve/reject (new `access_requests` table)
- **Subscription Deadline**: Clear display of expiry date, days remaining, renewal status

**Database changes:**
- None needed for sub-user listing (already have `tenant_users` table)
- The existing `manage-tenant` edge function already supports `create_user` action

**Files changed:**

| File | Change |
|------|--------|
| `src/pages/Landing.tsx` | Full rewrite — light palette, positive framing, no red |
| `src/index.css` | Update landing utility classes for light theme |
| `src/pages/Subscription.tsx` | Add user management tabs: sub-users list, create user dialog, subscription deadline display |

