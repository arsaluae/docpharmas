# Fix: Contact Import → Sync Back to Customer Record

## What's wrong today

The wizard inserts rows into `customer_contacts` correctly (431 rows already exist), but **the customer record itself is never updated**. So when you open a customer, fields like `contact_person`, `phone`, `email`, `sms_mobile` still look empty — it feels like "nothing happened" even though contacts were saved.

Only one half-implementation exists: `sms_mobile` is updated when blank (or when the lone `Overwrite mobile` toggle is on). `contact_person`, `phone`, `email` are ignored entirely.

## Fix

Extend the import step so the **primary contact** for each customer is mirrored onto the `customers` table.

### 1. Sync block in `runImport` (`src/pages/ContactImportWizard.tsx`)

For each customer being imported into, pick the contact that will become primary (existing primary if any, else the first imported row) and update the customer row using these rules:

| Customer column | Source              | When to write                          |
| --------------- | ------------------- | -------------------------------------- |
| `contact_person`| `contact_name`      | blank on customer OR overwrite toggle  |
| `sms_mobile`    | `mobile`            | blank on customer OR overwrite toggle  |
| `phone`         | `phone` ?? `mobile` | blank on customer OR overwrite toggle  |
| `email`         | `email`             | blank on customer OR overwrite toggle  |

One `UPDATE` per customer (deduped via `Map<customerId, payload>`), batched after the contact inserts.

### 2. Sync options UI (Step 3 — Verify)

Replace the single `Overwrite mobile` checkbox with a small "Sync to customer record" panel:

- ☑ Contact Person
- ☑ Mobile (sms_mobile)
- ☐ Phone (landline)
- ☐ Email
- Mode: **Fill blanks only** (default) / **Overwrite existing**

Defaults match current behaviour (Contact Person + Mobile, fill-blanks).

### 3. Summary screen (Step 4)

Add a new line: **"Customer records updated: N"** so the user can see the sync actually happened.

### 4. Manual entry path

`CustomerContactsCard` (Add / Edit / Set-as-Primary) — when a contact is set primary OR is the first contact created, mirror the same four fields onto `customers` (fill-blanks-only, no toggle needed here — this is a deliberate user action).

## Out of scope

- Touching `customers.phones` (jsonb array) — leave as-is.
- Backfilling the 431 contacts already imported (can be a one-off SQL run if you want it; tell me and I'll add a follow-up).
- Supplier contacts.

## Acceptance

- Import a sheet → open a matched customer → `Contact Person` and `Mobile` are populated on the main customer card (not just inside the Contact Persons tab).
- Re-importing the same sheet does not overwrite already-filled fields unless "Overwrite existing" is on.
- Summary shows `Customer records updated: N` matching how many customers had at least one field changed.
