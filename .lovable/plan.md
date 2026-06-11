## WhatsApp Templates — Settings-driven message system

Replace hardcoded WhatsApp message builders in `src/lib/whatsapp-share.ts` with tenant-scoped, admin-editable templates managed from **Settings → Communication → WhatsApp Templates**.

### 1. Database (migration)

New table `public.whatsapp_templates`:
- `id`, `tenant_id`, `document_type` (text, unique per tenant), `template_name`, `message_body` (text), `is_active` (bool), `is_default` (bool), `created_by`, `updated_by`, `created_at`, `updated_at`
- Unique: `(tenant_id, document_type)`
- `set_tenant_id` BEFORE INSERT trigger + `update_updated_at_column` trigger
- GRANTs: `SELECT, INSERT, UPDATE, DELETE` → authenticated; ALL → service_role
- RLS:
  - SELECT: `tenant_id = get_user_tenant_id()` (all tenant users can read for sending)
  - INSERT/UPDATE/DELETE: same tenant AND `current_user_can('settings','write')` (owner-only in practice)

Document types seeded: `sales_order`, `sales_invoice`, `delivery_note`, `customer_ledger`, `payment_receipt`, `sales_return`, `outstanding_reminder`, `expiry_followup`.

### 2. Shared template engine (`src/lib/whatsapp-templates.ts` — new)

- `DEFAULT_TEMPLATES: Record<DocType, { name, body }>` — exact defaults from the spec.
- `VARIABLES: Record<DocType, string[]>` — variable catalog per doc type (company/customer/document/agent/ledger/payment/link buckets).
- `renderTemplate(body, vars)` — `{{key}}` replacement; missing → empty string; flags unknown placeholders for the editor's validator.
- `getTemplate(documentType)` — fetches active row for current tenant; falls back to `DEFAULT_TEMPLATES[type]` if missing/inactive.
- `sendWhatsApp({ documentType, phone, vars })`:
  - Resolves template → renders → `encodeURIComponent`
  - Normalizes phone (digits only, prefix `92` if local); if blank, throws toast `"Customer WhatsApp/mobile number is missing."`
  - Opens `https://api.whatsapp.com/send?phone=...&text=...`

### 3. Settings UI (`src/pages/Settings.tsx` + new `src/components/settings/WhatsAppTemplatesCard.tsx`)

New section under Settings called **Communication → WhatsApp Templates**:
- Left: vertical tabs (one per document type) with active/inactive dot.
- Right pane: Template Name input · Active toggle · Message body `<Textarea>` (monospace, 12 rows) · "Insert variable" chip cloud (click to insert at cursor) · Live preview rendered with sample data · `Reset to Default` · `Save` · Last updated by/at line.
- Validator flags unknown `{{...}}` tokens inline.
- Gated by `useRoles().can('settings','write')`; sales agents see read-only view.

### 4. Wire existing WhatsApp buttons

Replace the hardcoded `build*Message` calls and direct `openWhatsApp` usage in:
- `src/pages/ProformaInvoices.tsx` (Sales Order, Sales Invoice)
- `src/pages/DeliveryNotes.tsx`
- `src/pages/SalesReturns.tsx`
- `src/pages/Payments.tsx` / `src/pages/CollectPayment.tsx` (Payment Receipt)
- `src/pages/CustomerLedger.tsx` (Customer Ledger + Outstanding Reminder action)

Each caller builds the `vars` object from existing fetched data (customer, company_settings, document totals, agent, optional uploaded `shared-documents` link) and calls `sendWhatsApp({ documentType, phone, vars })`.

Keep `src/lib/whatsapp-share.ts` exports as thin wrappers that call `sendWhatsApp` so any caller not yet refactored keeps working; deprecate `build*Message` helpers (no longer assemble strings — they just delegate). The floating `WhatsAppButton` (sales contact) stays untouched.

### 5. Out of scope
- No change to PDF templates, document layouts, or `pdf-generator.ts`.
- No new edge function — rendering happens client-side from RLS-protected rows.
- No SMS/email templating.

### Acceptance
- New table + RLS live; only owners/settings-writers can edit.
- Settings page lists all 8 doc types with editor, variable insertion, live preview, reset, active toggle, last updated info.
- All WhatsApp buttons across the app use the rendered template, encode the URL correctly, normalize the customer phone, and show the "missing number" error when blank.
- Falling back to defaults works when no row exists.
