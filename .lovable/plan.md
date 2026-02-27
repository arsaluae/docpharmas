

# Fix: Import Skipping Rows Due to Name Column Overwrite

## Root Cause
Both "Business Name" and "First Name" are aliased to `name`. When the import loop processes headers sequentially, "First Name" (which is often empty) overwrites `obj.name` that was already set by "Business Name". Result: 322 rows with a Business Name but no First Name get skipped.

## Fix in `src/pages/DataImport.tsx`

### Change 1: Import logic — don't overwrite with empty values
In `handleImport` (around line 207-216), when assigning `obj[mapped]`, skip assignment if the value is empty AND the key already has a non-empty value:

```
// Current (broken):
if (mapped && cols.includes(mapped)) {
  obj[mapped] = row[i] || "";
}

// Fixed:
if (mapped && cols.includes(mapped)) {
  const val = row[i] || "";
  // Don't overwrite existing non-empty value with empty
  if (val || !obj[mapped]) {
    obj[mapped] = val;
  }
}
```

### Change 2: Also handle "Mobile" column mapping
The screenshot shows "Mobile → phone" is already mapped, but "Phone" also maps to `phone`. Same overwrite issue — apply the same non-empty guard.

### Change 3: Concatenate name parts intelligently
After the header loop, if `obj.name` exists and `lastName` exists, concatenate. But also: if `obj.name` is empty and `lastName` is not, use `lastName` alone as the name.

```
if (lastName) {
  obj.name = obj.name 
    ? `${obj.name} ${lastName}`.trim() 
    : lastName.trim();
}
```

This is a single-file fix in `src/pages/DataImport.tsx`, ~3 lines changed.

