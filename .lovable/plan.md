

# Test Results & Fix Plan

## What Worked
1. **Print Job Creation** — PJ-0001 created successfully with atomic numbering
2. **Delivery Recording** — 4000 delivered, 1000 rejected with reason, stats updated correctly
3. **Settlement** — Cost split at 60/40, total adjusted from 35,000 to 30,800, toast showed correct amounts
4. **Printer Balance** — Updated to 30,800 after settlement via trigger
5. **Printer Ledger** — Shows opening balance (0), print job credit (30,800), running balance correct

## Bugs Found

### BUG 1: Payment insert silently fails — no error handling
**File**: `src/pages/Payments.tsx` lines 108-114
The insert at line 108 does `await supabase.from("payments").insert(...)` but **never checks the error result**. The success toast at line 114 fires regardless. The payment was never saved to the database (confirmed via direct DB query — payments table is empty), but the user sees "Payment PAY-0001 recorded".

**Fix**: Capture the insert result and check for errors before showing success toast.

### BUG 2: Duplicate triggers on payments table
Two triggers (`trg_payment_balance` and `on_payment_change`) both call `handle_payment_balance` on INSERT/DELETE. When a payment IS successfully inserted, the balance adjustment runs **twice** (double deduction). Need to drop one.

### BUG 3: Payment form label says "Supplier" when party type is "Printer"
When you select Party Type = "Printer", the party selector label still shows "Supplier *" instead of "Printer *".

### BUG 4: Document counter incremented but payment not saved
The `generate_document_number` RPC succeeded (counter went from 0 to 1) but the subsequent insert failed. Counter is now out of sync — PAY-0001 will never exist but PAY-0002 will be the next number.

## Fix Plan

### 1. Fix payment error handling (`src/pages/Payments.tsx`)
Add error checking on the insert result at line 108-114:
```typescript
const { error } = await supabase.from("payments").insert({...});
if (error) { toast.error("Failed to record payment: " + error.message); return; }
toast.success(`Payment ${paymentNumber} recorded`);
```

### 2. Drop duplicate trigger (DB migration)
```sql
DROP TRIGGER IF EXISTS on_payment_change ON public.payments;
```

### 3. Fix party label in payment form
Change the label from hardcoded "Supplier *" to dynamically show "Printer *" when `partyType === 'printer'`.

### 4. Reset document counter (DB migration)
Reset counter only if no payments exist:
```sql
UPDATE document_counters SET current_value = 0 WHERE document_type = 'payment';
```

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Payments.tsx` | Add error handling on insert, fix party label |
| DB migration | Drop duplicate trigger, reset counter |

