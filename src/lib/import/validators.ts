// Row-level validation + value coercion for each entity.
// Returns a NormalizedRow array. Cross-row checks (duplicate SKU,
// merging batches etc.) happen after individual coercion.

import { ENTITIES, EntityType, NormalizedRow, ValidationError, PRODUCT_CATEGORIES, ACCOUNT_TYPES } from "./types";
import { cleanEmail, cleanMobile, parseLegacyDate, batchKey, composeName, coerceCategory, mergeNotes } from "./cleaners";

function coerceNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[,\s]/g, "").replace(/^Rs\.?/i, "").replace(/^PKR/i, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface ValidateOptions {
  allowPastExpiry?: boolean;
}

/** Pre-coerce raw row: handle composed names, mobile cleanup, email overflow, dates. */
function preCoerce(entity: EntityType, raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  // Compose name from title/first/last/business for parties
  if (entity === "customers" || entity === "suppliers") {
    const composed = composeName({
      business: raw["name"],
      title: raw["title"],
      first: raw["first_name"],
      last: raw["last_name"],
    });
    if (composed) out["name"] = composed;

    // Mobile cleanup
    if (raw["phone"] != null) {
      const m = cleanMobile(raw["phone"]);
      if (m) out["phone"] = m;
    }

    // Email validation + overflow to notes
    if (raw["email"] != null) {
      const { email, overflow } = cleanEmail(raw["email"]);
      out["email"] = email ?? null;
      if (overflow) {
        out["notes"] = mergeNotes(raw["notes"] as string, `email-field: ${overflow}`);
      }
    }

    // Country/county/website also park in notes (we don't have dedicated columns)
    const overflowBits: string[] = [];
    if (raw["country"]) overflowBits.push(`country: ${raw["country"]}`);
    if (raw["county"]) overflowBits.push(`county: ${raw["county"]}`);
    if (raw["website"]) overflowBits.push(`web: ${raw["website"]}`);
    if (overflowBits.length) {
      out["notes"] = mergeNotes(out["notes"] as string, overflowBits.join(" · "));
    }
  }

  // Products: coerce category, push legacy account fields + weight/sale_info into notes
  if (entity === "products") {
    if (raw["category"] != null && raw["category"] !== "") {
      out["category"] = coerceCategory(raw["category"]);
    }
    const overflowBits: string[] = [];
    for (const k of ["expense_account","income_account","stock_account","sale_information","weight"]) {
      if (raw[k]) overflowBits.push(`${k}: ${raw[k]}`);
    }
    if (overflowBits.length) {
      out["notes"] = mergeNotes(raw["notes"] as string, overflowBits.join(" · "));
    }
  }

  // Batches: tidy expiry, drop sentinel zero values
  if (entity === "batches") {
    out["expiry_date"] = parseLegacyDate(raw["expiry_date"]);
    if (raw["to_location"]) {
      out["notes"] = mergeNotes(raw["notes"] as string, `location: ${raw["to_location"]}`);
    }
  }

  return out;
}

export function validateAll(
  entity: EntityType,
  rows: Record<string, unknown>[],
  opts: ValidateOptions = {},
): NormalizedRow[] {
  const spec = ENTITIES[entity];
  const result: NormalizedRow[] = [];
  const seenKey = new Map<string, number>();
  const batchAgg = new Map<string, number>(); // for batches: track first occurrence index

  rows.forEach((rawIn, idx) => {
    const raw = preCoerce(entity, rawIn);
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const normalized: Record<string, unknown> = {};

    // Pre-filter: legacy batch sheets often contain section-header rows
    // (e.g. "Cap's", "Cosmetics", "Total") with only the Product column populated.
    // Drop them silently so they don't pollute the failed-rows bucket.
    if (entity === "batches") {
      const hasSku = raw.sku != null && String(raw.sku).trim() !== "";
      const hasBatch = raw.batch_number != null && String(raw.batch_number).trim() !== "";
      const hasQty = raw.quantity != null && String(raw.quantity).trim() !== "";
      const hasExpiry = raw.expiry_date != null && String(raw.expiry_date).trim() !== "";
      if (!hasSku && !hasBatch && !hasQty && !hasExpiry) {
        result.push({
          rowNumber: idx + 2, raw, normalized,
          errors: [], warnings: ["section header — ignored"], merged: true,
        });
        return;
      }
    }

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
          else if (n < 0 && !["balance", "amount"].includes(f.key) && !(entity === "batches" && f.key === "quantity")) {
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
          const d = parseLegacyDate(v);
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
        // category is informational text but our DB has a CHECK constraint — force valid enum
        if (!normalized.category || !PRODUCT_CATEGORIES.includes(String(normalized.category))) {
          normalized.category = "other";
        }
        if (!normalized.unit) normalized.unit = "pcs";
        // Prices are non-blocking: default to 0 and warn so the row still posts.
        if (normalized.cost_price == null || normalized.cost_price === "") {
          normalized.cost_price = 0;
          warnings.push("cost price missing — defaulted to 0");
        }
        if (normalized.selling_price == null || normalized.selling_price === "") {
          normalized.selling_price = 0;
          warnings.push("sale price missing — defaulted to 0");
        }
        const sku = String(normalized.sku ?? "").trim().toLowerCase();
        if (sku) {
          if (seenKey.has(sku)) errors.push({ field: "sku", message: `duplicate SKU in file (row ${seenKey.get(sku)})` });
          else seenKey.set(sku, idx + 2);
        }
        if (!normalized.supplier_name) {
          warnings.push("no supplier name — product will be unlinked");
        }
        break;
      }
      case "customers": {
        const code = String(normalized.customer_code ?? "").trim().toLowerCase();
        if (code) {
          if (seenKey.has(code)) errors.push({ field: "customer_code", message: `duplicate customer code in file (row ${seenKey.get(code)})` });
          else seenKey.set(code, idx + 2);
        }
        if (!normalized.city) warnings.push("city missing");
        if (!normalized.address) warnings.push("address missing");
        if (!normalized.phone && !normalized.email) warnings.push("missing phone & email");
        // Invalid phone: cleaner returned null but the raw cell had text → park it in notes
        if (!normalized.phone && raw["phone"] != null && String(raw["phone"]).trim() !== "") {
          normalized.notes = mergeNotes(normalized.notes as string, `mobile-field: ${String(raw["phone"]).trim()}`);
          warnings.push("phone unparseable — kept raw in notes");
        }
        break;
      }
      case "suppliers": {
        const code = String(normalized.supplier_code ?? "").trim().toLowerCase();
        if (code) {
          if (seenKey.has(code)) errors.push({ field: "supplier_code", message: `duplicate supplier code in file (row ${seenKey.get(code)})` });
          else seenKey.set(code, idx + 2);
        }
        if (!normalized.city) warnings.push("city missing");
        if (!normalized.address) warnings.push("address missing");
        if (!normalized.phone && !normalized.email) warnings.push("missing phone & email");
        if (!normalized.phone && raw["phone"] != null && String(raw["phone"]).trim() !== "") {
          normalized.notes = mergeNotes(normalized.notes as string, `mobile-field: ${String(raw["phone"]).trim()}`);
          warnings.push("phone unparseable — kept raw in notes");
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
        // pharma-grade row rules
        const qty = Number(normalized.quantity ?? 0);
        if (!(qty > 0)) errors.push({ field: "quantity", message: "non-positive quantity (legacy adjustment) — skipped", severity: "skipped" });
        if (!normalized.sku) errors.push({ field: "sku", message: "missing product code" });
        if (!normalized.batch_number) errors.push({ field: "batch_number", message: "missing batch number" });
        if (!normalized.expiry_date) errors.push({ field: "expiry_date", message: "missing or sentinel expiry (0000-00-00) — skipped", severity: "skipped" });
        if (normalized.expiry_date && !opts.allowPastExpiry) {
          const today = new Date().toISOString().slice(0, 10);
          if (String(normalized.expiry_date) < today) {
            errors.push({ field: "expiry_date", message: "expiry is in the past (enable override to allow)", severity: "skipped" });
          }
        }
        // duplicate (sku + batch) merging — only when row is otherwise valid
        if (errors.length === 0) {
          const k = batchKey(normalized.sku, normalized.batch_number);
          if (batchAgg.has(k)) {
            const firstIdx = batchAgg.get(k)!;
            const first = result[firstIdx];
            first.normalized.quantity = Number(first.normalized.quantity ?? 0) + qty;
            warnings.push(`merged into row ${first.rowNumber}`);
            result.push({ rowNumber: idx + 2, raw, normalized, errors, warnings, merged: true });
            return; // exit forEach iteration
          } else {
            batchAgg.set(k, result.length);
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

    result.push({ rowNumber: idx + 2, raw, normalized, errors, warnings });
  });

  return result;
}
