// Row-level validation + value coercion for each entity.
// Returns a NormalizedRow array. Cross-row checks (duplicate SKU etc.)
// happen after individual coercion in `validateAll`.

import { ENTITIES, EntityType, NormalizedRow, ValidationError, PRODUCT_CATEGORIES, ACCOUNT_TYPES } from "./types";

function coerceNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[,\s]/g, "").replace(/^Rs\.?/i, "").replace(/^PKR/i, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function coerceDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  // YYYY-MM-DD or M/D/YYYY etc
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export interface ValidateOptions {
  allowPastExpiry?: boolean;
}

export function validateAll(
  entity: EntityType,
  rows: Record<string, unknown>[],
  opts: ValidateOptions = {},
): NormalizedRow[] {
  const spec = ENTITIES[entity];
  const result: NormalizedRow[] = [];
  const seenKey = new Map<string, number>(); // dedup tracker per entity

  rows.forEach((raw, idx) => {
    const errors: ValidationError[] = [];
    const normalized: Record<string, unknown> = {};

    for (const f of spec.fields) {
      const v = raw[f.key];
      const isEmpty = v === null || v === undefined || v === "";
      if (f.required && isEmpty) {
        errors.push({ field: f.key, message: "required" });
        continue;
      }
      if (isEmpty) continue;

      switch (f.type) {
        case "number": {
          const n = coerceNumber(v);
          if (n === null) errors.push({ field: f.key, message: "not a valid number" });
          else if (n < 0 && !["balance", "amount"].includes(f.key)) {
            errors.push({ field: f.key, message: "must be ≥ 0" });
          } else normalized[f.key] = n;
          break;
        }
        case "integer": {
          const n = coerceNumber(v);
          if (n === null || !Number.isInteger(n)) errors.push({ field: f.key, message: "must be an integer" });
          else normalized[f.key] = n;
          break;
        }
        case "date": {
          const d = coerceDate(v);
          if (!d) errors.push({ field: f.key, message: "invalid date (use YYYY-MM-DD)" });
          else normalized[f.key] = d;
          break;
        }
        case "enum": {
          const s = String(v).trim().toLowerCase();
          if (!f.enumValues?.includes(s)) {
            errors.push({ field: f.key, message: `must be one of ${f.enumValues?.join(", ")}` });
          } else normalized[f.key] = s;
          break;
        }
        case "boolean": {
          const s = String(v).trim().toLowerCase();
          normalized[f.key] = ["1","true","yes","y"].includes(s);
          break;
        }
        default: {
          normalized[f.key] = String(v).trim();
        }
      }
    }

    // Entity-specific cross-field checks.
    switch (entity) {
      case "products": {
        if (normalized.category && !PRODUCT_CATEGORIES.includes(String(normalized.category))) {
          errors.push({ field: "category", message: "unknown category" });
        }
        if (!normalized.unit) normalized.unit = "pcs";
        const sku = String(normalized.sku ?? "").trim().toLowerCase();
        if (sku) {
          if (seenKey.has(sku)) errors.push({ field: "sku", message: `duplicate SKU in file (row ${seenKey.get(sku)})` });
          else seenKey.set(sku, idx + 2);
        }
        break;
      }
      case "customers": {
        const code = String(normalized.customer_code ?? "").trim().toLowerCase();
        if (code) {
          if (seenKey.has(code)) errors.push({ field: "customer_code", message: `duplicate customer code in file (row ${seenKey.get(code)})` });
          else seenKey.set(code, idx + 2);
        }
        break;
      }
      case "suppliers": {
        const code = String(normalized.supplier_code ?? "").trim().toLowerCase();
        if (code) {
          if (seenKey.has(code)) errors.push({ field: "supplier_code", message: `duplicate supplier code in file (row ${seenKey.get(code)})` });
          else seenKey.set(code, idx + 2);
        }
        break;
      }
      case "chart_of_accounts": {
        if (normalized.account_type && !ACCOUNT_TYPES.includes(String(normalized.account_type))) {
          errors.push({ field: "account_type", message: "invalid account type" });
        }
        const code = String(normalized.code ?? "").trim();
        if (code) {
          if (seenKey.has(code)) errors.push({ field: "code", message: `duplicate code in file (row ${seenKey.get(code)})` });
          else seenKey.set(code, idx + 2);
        }
        break;
      }
      case "batches": {
        if (normalized.expiry_date && !opts.allowPastExpiry) {
          const today = new Date().toISOString().slice(0, 10);
          if (String(normalized.expiry_date) < today) {
            errors.push({ field: "expiry_date", message: "expiry is in the past (enable override to allow)" });
          }
        }
        break;
      }
      case "customer_opening":
      case "supplier_opening": {
        const code = entity === "customer_opening" ? "customer_code" : "supplier_code";
        const nameKey = entity === "customer_opening" ? "customer_name" : "supplier_name";
        if (!normalized[code] && !normalized[nameKey]) {
          errors.push({ field: nameKey, message: "either name or code is required" });
        }
        const amt = Number(normalized.amount ?? 0);
        if (!(amt > 0)) errors.push({ field: "amount", message: "amount must be > 0" });
        break;
      }
      case "sales_invoices": {
        // qty * rate * (1 - disc%) * (1 + gst%) ≈ line amount (computed)
        const qty = Number(normalized.quantity ?? 0);
        const rate = Number(normalized.rate ?? 0);
        if (qty <= 0) errors.push({ field: "quantity", message: "must be > 0" });
        if (rate < 0) errors.push({ field: "rate", message: "must be ≥ 0" });
        break;
      }
      case "purchase_invoices": {
        const sub = Number(normalized.subtotal ?? 0);
        const gst = Number(normalized.gst ?? 0);
        const wht = Number(normalized.wht_amount ?? 0);
        const tot = Number(normalized.total ?? 0);
        const expected = sub + gst - wht;
        if (Math.abs(expected - tot) > 0.5) {
          errors.push({ field: "total", message: `total ≠ subtotal+GST-WHT (expected ${expected.toFixed(2)})` });
        }
        break;
      }
    }

    result.push({ rowNumber: idx + 2, raw, normalized, errors });
  });

  return result;
}
