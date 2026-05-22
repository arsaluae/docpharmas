# Plan — Flatten, Signup, GP Fix, Data Integrity

## 1. Strip remaining glass/blur/glow

**`src/index.css`**
- Remove the `.glass-card-glow`, `.glow-primary`, and `pharma-gradient-header` classes (or collapse `.glass-card-glow` to alias `.glass-card`).
- Replace `.frosted-header` (uses `backdrop-filter: blur(18px)`) with a flat `background: hsl(var(--background)); border-bottom: 1px solid hsl(var(--border));` so the top bar matches the flat Midnight Indigo language.
- Remove `box-shadow: 0 0 0 3px hsl(var(--primary) / 0.15)` halo on `.search-pill:focus-within` → 1px border only.
- Confirm `.mouj-dark-sidebar` and `.mouj-dark-auth` blocks contain zero `backdrop-filter`, `blur`, or soft glow shadows (already clean — verify line-by-line).

**`src/pages/Index.tsx`**
- Remove the lingering `glowColor` shadow strings on KPI cards.
- Replace tooltip `backdropFilter: "blur(8px)"` strings in Recharts `contentStyle` with solid `background: hsl(var(--card))` + 1px border (3 occurrences).

## 2. Remove AI icons / AI Insights surfaces from the dashboard

**`src/pages/Index.tsx`**
- Delete the entire "AI Insights CTA" block at the bottom (`Brain` icon card linking to `/insights`).
- Remove the `Sparkles` icon from the hero greeting line (keep date text only).
- Drop the unused `Brain`, `Sparkles` imports from lucide.

(Leave the `/insights` route + AIInsights page intact — only the dashboard surface is cleaned, since user said "I don't want AI icons in this".)

## 3. Fix Gross Margin calculation

Current bug: `setGrossMargin(monthSales − totalCost)` mixes invoice-header `subtotal` (which may include discounts/rounding) with item-level COGS. Fix to derive **both** sides from `sales_invoice_items`:

```
GP = Σ(item.amount)  −  Σ(item.quantity × product.cost_price)
GP% = GP / Σ(item.amount)
```

- Update the items loop in `loadDashboard` to also sum `Number(item.amount)` into `totalRevenue`, then `setGrossMargin(totalRevenue − totalCost)`.
- Mirror the same formula inside `GrossMarginDialog` (already correct — verify and add a tiny "Sum of item revenue – (qty × cost_price)" footnote so the number reconciles with the KPI).
- KPI subtitle: change "Sale − Cost Price" to "Revenue − COGS (item level)".

## 4. Working Signup flow

**`src/pages/Auth.tsx`** — add a third mode `"signup"` alongside `login`/`forgot`:

Fields: Company Name, Email, Phone (optional), Password (min 6).

Flow:
1. `supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/auth", data: { company_name } } })`.
2. On success, call edge function:
   `supabase.functions.invoke("manage-tenant", { body: { action: "create_pending_signup", user_id: data.user.id, email, company_name, phone } })`.
3. Show a flat success card: "Account created — pending approval. You'll receive an email once activated." then switch back to `login` mode.
4. Add "Create account" / "Already have an account?" links under the form.

No DB changes — `pending_signups` table + edge function already exist. Do **not** enable auto-confirm email; users go through the normal confirmation + admin approval path.

## 5. Data-integrity audit (no data loss)

Targeted review + fixes on the write paths most likely to drop data:

a. **Sales invoice + items** (`ProformaInvoices.tsx`): wrap the parent insert + items insert so that if items insert fails we delete the orphan header. Add `await` checks on every step and toast.error + early-return on any error (currently a couple of paths swallow errors silently).
b. **Purchase invoice + items** (`PurchaseProforma.tsx`): same pattern.
c. **Payment + invoice_id allocation** (`Payments.tsx`): confirm `invoice_id` is persisted when an invoice is selected (so `recalc_*_invoice_status` triggers work). Surface any insert error to the user.
d. **Stock movements**: confirm every `purchase_in` / `sale_out` insert provides `product_id`, `quantity`, `movement_type`, `date`, and a reference (`reference_type`, `reference_id`) so reversals are possible. Add a missing-field guard.
e. **Document numbers**: ensure every create flow calls `generate_document_number(...)` before insert (no client-generated numbers) so counters stay monotonic.
f. **Optimistic UI**: any place that calls `setState(prev → remove row)` before the await resolves should move the state update into the `.then` to prevent perceived data loss on failure.

Each of the six files gets the same minimal hardening; no schema changes required.

## Files touched

- `src/index.css` — remove glow/blur utilities, flatten frosted-header + search-pill focus.
- `src/pages/Index.tsx` — remove AI/Sparkles, fix GP math, drop blur tooltip styles.
- `src/components/dashboard/KpiDialogs.tsx` — minor GP footnote.
- `src/pages/Auth.tsx` — add signup mode + handlers.
- `src/pages/ProformaInvoices.tsx`, `src/pages/PurchaseProforma.tsx`, `src/pages/Payments.tsx` — atomic write guards + error surfacing.

No database migrations. No new dependencies.
