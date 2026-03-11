

# Distributor Fix, Credit Notes, Payment Integration, Expense Ledger & Salaries

## 1. Fix Distributor Add Function

The distributor save in `CustomerProfileDialog.tsx` looks correct code-wise. The likely issue is that the `customer_distributors` table requires a `tenant_id` but it's not being set by a trigger, or the insert silently fails. Will add error handling to surface the actual error and ensure the `set_tenant_id` trigger is in place.

## 2. Credit Notes (Supplier & Customer)

New `credit_notes` table to track credit notes issued by suppliers (e.g., damaged goods) or issued to customers.

**Database:**
```sql
CREATE TABLE credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number text NOT NULL,
  party_type text NOT NULL, -- 'customer' or 'supplier'
  party_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  reference text, -- e.g. invoice number
  notes text,
  status text NOT NULL DEFAULT 'active',
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- RLS policies (tenant-scoped) + `set_tenant_id` trigger
- Balance trigger: supplier credit note reduces supplier balance; customer credit note reduces customer balance
- New page `src/pages/CreditNotes.tsx` with tabs (Supplier / Customer / All)
- Add to sidebar under Finance section
- Add route in `App.tsx`
- Document counter entry for `credit_note`

## 3. Payment Buttons in Sales & Purchase Menus

The Sales (ProformaInvoices) page already has a "Receive Payment" action. The Purchase (PurchaseProforma) page also has a "Make Payment" action. These already exist. Will verify they work and ensure the UI labels say "Receive Payment" / "Make Payment" (not "Payment In/Out").

## 4. Expense Ledger (Custom Categories)

New `expense_ledgers` table for user-defined expense categories/heads for both business and personal.

**Database:**
```sql
CREATE TABLE expense_ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  expense_type text NOT NULL DEFAULT 'business', -- business or personal
  description text,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**UI Changes:**
- Add "Manage Ledgers" button on the Expenses page
- Dialog to add/edit/delete expense ledgers
- Replace hardcoded categories with dynamic ledger list (fall back to defaults if none created)
- Add a column `ledger_id` to `expenses` table (nullable, for linking)
- Clicking a ledger shows its expense entries (filtered view)

## 5. Staff Salaries

New `staff` and `salary_payments` tables.

**Database:**
```sql
CREATE TABLE staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  designation text,
  phone text,
  salary numeric NOT NULL DEFAULT 0,
  joining_date date,
  status text NOT NULL DEFAULT 'active',
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_number text NOT NULL,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  month text NOT NULL, -- '2026-03'
  payment_method text NOT NULL DEFAULT 'cash',
  bank_account_id uuid,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- RLS + triggers on both tables
- Bank balance trigger on salary_payments (deduct from bank on insert, restore on delete)
- New page `src/pages/Salaries.tsx` with staff management + salary payment recording
- Staff list with monthly salary, pay button, payment history
- Add to sidebar under Finance section
- Add route in `App.tsx`
- Document counter entries for `salary`

## Files to Create/Edit

| File | Change |
|------|--------|
| DB migration | `credit_notes`, `expense_ledgers`, `staff`, `salary_payments` tables + RLS + triggers + counters |
| `src/components/CustomerProfileDialog.tsx` | Fix distributor save error handling |
| `src/pages/CreditNotes.tsx` | New -- credit note management |
| `src/pages/Expenses.tsx` | Add ledger management, dynamic categories, ledger drill-down |
| `src/pages/Salaries.tsx` | New -- staff + salary management |
| `src/components/AppSidebar.tsx` | Add Credit Notes + Salaries to sidebar |
| `src/App.tsx` | Register new routes |

