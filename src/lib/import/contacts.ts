// Helpers for the Customer Contact Import Wizard.
// Flexible column mapping, fallback name resolution, normalization, smart matching.

export type ContactField =
  | "customer_name"
  | "customer_code"
  | "contact_name"
  | "mobile"
  | "phone"
  | "designation"
  | "email"
  | "city"
  | "area"
  | "address"
  | "notes";

export type ColumnMapping = Partial<Record<ContactField, number | null>>;

export interface ContactRow {
  rowNumber: number;
  raw: Record<string, string>;
  customer_name: string;          // raw value from chosen Customer Name column
  customer_code: string;
  contact_name: string;
  mobile: string;
  phone: string;
  designation: string;
  email: string;
  city: string;
  area: string;
  address: string;
  notes: string;
  /** Name actually used for matching (falls back to contact_name when customer_name is blank). */
  matchName: string;
  /** Where matchName came from — for verify UI transparency. */
  matchNameSource: "customer" | "contact" | "empty";
}

export interface CustomerLite {
  id: string;
  name: string | null;
  company: string | null;
  customer_code: string | null;
  city: string | null;
  area: string | null;
  phone: string | null;
  sms_mobile: string | null;
}

export type MatchMethod = "Code" | "Exact" | "Normalized" | "Fuzzy" | "Manual" | "Created" | "None";
export type MatchStatus = "auto" | "review" | "unmatched" | "accepted" | "skipped" | "created";

export interface MatchResult {
  row: ContactRow;
  matchedCustomerId: string | null;
  matchedLabel: string;
  confidence: number;
  matchMethod: MatchMethod;
  status: MatchStatus;
  /** Human-readable reason a row is in review/unmatched state. Empty when fully matched. */
  reason?: string;
}

// ---------- Header auto-detection ----------

/** Candidate header strings (lowercased) that map to a "Customer Name" column. */
export const CUSTOMER_NAME_HEADERS = [
  "customer name", "customer", "business name", "account name", "party name",
  "name", "shop name", "medical store", "pharmacy name", "pharmacy", "firm name",
  "business", "ledger name", "client", "client name",
];

const FIELD_HEADER_ALIASES: Record<ContactField, string[]> = {
  customer_name: CUSTOMER_NAME_HEADERS,
  customer_code: ["customer code", "code", "account code", "a/c no", "ac no", "account no", "customer #", "cust code", "old erp id", "legacy id"],
  contact_name: ["contact person", "contact name", "contact", "person", "attention", "attn", "owner", "proprietor"],
  mobile: ["mobile", "cell", "mobile #", "cell #", "mobile number", "mobile no", "cell no", "whatsapp"],
  phone: ["phone", "telephone", "landline", "phone #", "phone number", "tel", "phone no"],
  designation: ["designation", "title", "role", "position"],
  email: ["email", "e-mail", "mail", "email address"],
  city: ["city", "town"],
  area: ["area", "zone", "territory"],
  address: ["address", "addr", "address 1", "address line 1", "street"],
  notes: ["notes", "remarks", "comments", "note"],
};

const normHeader = (s: unknown) =>
  String(s ?? "").trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");

/** Auto-detect a column index for each ContactField from the raw header row. */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map(normHeader);
  const out: ColumnMapping = {};
  (Object.keys(FIELD_HEADER_ALIASES) as ContactField[]).forEach((f) => {
    const aliases = FIELD_HEADER_ALIASES[f];
    const idx = normalized.findIndex((h) => aliases.includes(h));
    out[f] = idx >= 0 ? idx : null;
  });
  return out;
}

// ---------- Row parsing ----------

export function parseRows(
  aoa: unknown[][],
  mapping: ColumnMapping,
  headers: string[] = [],
): ContactRow[] {
  const get = (row: unknown[], field: ContactField): string => {
    const idx = mapping[field];
    if (idx == null || idx < 0) return "";
    const v = row[idx];
    return v == null ? "" : String(v).trim();
  };
  const rows: ContactRow[] = [];
  aoa.forEach((row, i) => {
    const customer_name = get(row, "customer_name");
    const contact_name = get(row, "contact_name");
    const mobile = get(row, "mobile");
    const phone = get(row, "phone");
    const email = get(row, "email");

    // Skip fully blank rows.
    if (!customer_name && !contact_name && !mobile && !phone && !email) return;

    const matchName = customer_name || contact_name || "";
    const matchNameSource: ContactRow["matchNameSource"] =
      customer_name ? "customer" : (contact_name ? "contact" : "empty");

    rows.push({
      rowNumber: i + 2, // +2 = +1 (1-based) +1 (header row)
      raw: Object.fromEntries(headers.map((h, idx) => [h || `col${idx}`, String(row[idx] ?? "").trim()])),
      customer_name,
      customer_code: get(row, "customer_code"),
      contact_name,
      mobile,
      phone,
      designation: get(row, "designation"),
      email,
      city: get(row, "city"),
      area: get(row, "area"),
      address: get(row, "address"),
      notes: get(row, "notes"),
      matchName,
      matchNameSource,
    });
  });
  return rows;
}

// ---------- Normalization ----------

// Suffixes / business words to strip before fuzzy comparison.
const SUFFIX_RE = new RegExp(
  "\\b(" +
    [
      "m/?s",                       // M/S, MS, M.S
      "pharmacy", "pharma", "pharmaceuticals?",
      "medical store", "medical stores", "medicos",
      "medicine house", "medicines",
      "distributors?", "distribution", "agency", "agencies",
      "traders?", "trading",
      "enterprises?", "enterprisei",
      "brothers?", "bros",
      "sons", "co", "company",
      "pvt", "ltd", "limited", "llp",
      "surgicals?", "stores?", "shop",
    ].join("|") +
    ")\\b",
  "gi",
);

export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/[\/\\]+/g, " ")           // slashes
    .replace(/[^\p{L}\p{N} ]+/gu, " ")  // punctuation
    .replace(SUFFIX_RE, " ")            // business suffixes
    .replace(/\s+/g, " ")               // collapse spaces
    .trim();
}

export function normalizeMobile(s: string | null | undefined): string {
  if (!s) return "";
  return String(s).replace(/\D+/g, "").slice(-10);
}

export function normalizeEmail(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

// ---------- Matching ----------

function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(a), B = bigrams(b);
  let inter = 0;
  for (const [bg, c] of A) {
    const cb = B.get(bg);
    if (cb) inter += Math.min(c, cb);
  }
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

/** Confidence thresholds: >=90 auto, 70–89 review, <70 unmatched. */
export function matchRow(row: ContactRow, customers: CustomerLite[]): MatchResult {
  // 1) Customer code exact
  if (row.customer_code) {
    const code = row.customer_code.trim().toLowerCase();
    const c = customers.find((c) => (c.customer_code ?? "").trim().toLowerCase() === code);
    if (c) {
      return {
        row, matchedCustomerId: c.id,
        matchedLabel: c.name || c.company || c.customer_code || "—",
        confidence: 100, matchMethod: "Code", status: "auto",
      };
    }
  }

  const target = row.matchName.trim().toLowerCase();
  if (target) {
    // 2) Exact (case-insensitive trim) on name or company
    const exact = customers.find(
      (c) => (c.name ?? "").trim().toLowerCase() === target ||
             (c.company ?? "").trim().toLowerCase() === target,
    );
    if (exact) {
      return {
        row, matchedCustomerId: exact.id,
        matchedLabel: exact.name || exact.company || "—",
        confidence: 98, matchMethod: "Exact", status: "auto",
      };
    }
  }

  // 3) Normalized exact / fuzzy
  const nTarget = normalizeName(row.matchName);
  if (nTarget) {
    let normalizedHit: CustomerLite | null = null;
    let best: { c: CustomerLite; score: number } | null = null;
    for (const c of customers) {
      const nName = normalizeName(c.name);
      const nCo = normalizeName(c.company);
      if (nName === nTarget || nCo === nTarget) {
        normalizedHit = c;
        break;
      }
      const score = Math.max(
        diceCoefficient(nTarget, nName),
        diceCoefficient(nTarget, nCo),
      );
      if (!best || score > best.score) best = { c, score };
    }
    if (normalizedHit) {
      return {
        row, matchedCustomerId: normalizedHit.id,
        matchedLabel: normalizedHit.name || normalizedHit.company || "—",
        confidence: 94, matchMethod: "Normalized", status: "auto",
      };
    }
    if (best && best.score >= 0.55) {
      const conf = Math.round(best.score * 100);
      const status: MatchStatus = conf >= 90 ? "auto" : conf >= 70 ? "review" : "unmatched";
      return {
        row, matchedCustomerId: best.c.id,
        matchedLabel: best.c.name || best.c.company || "—",
        confidence: conf, matchMethod: "Fuzzy", status,
      };
    }
  }

  return {
    row, matchedCustomerId: null, matchedLabel: "",
    confidence: 0, matchMethod: "None", status: "unmatched",
  };
}

// ---------- Duplicate detection ----------

export interface ExistingContactLite {
  id: string;
  customer_id: string;
  contact_name: string | null;
  mobile: string | null;
  email: string | null;
}

export type DuplicateAction = "update" | "skip" | "create";

export function findDuplicate(
  customerId: string,
  candidate: { contact_name: string; mobile: string; email: string },
  existing: ExistingContactLite[],
): ExistingContactLite | null {
  const m = normalizeMobile(candidate.mobile);
  const e = normalizeEmail(candidate.email);
  const n = normalizeName(candidate.contact_name);
  for (const c of existing) {
    if (c.customer_id !== customerId) continue;
    if (m && normalizeMobile(c.mobile) === m) return c;
    if (e && normalizeEmail(c.email) === e) return c;
    if (n && normalizeName(c.contact_name) === n) return c;
  }
  return null;
}

/** Searchable text blob for the customer-picker dropdown. */
export function customerSearchText(c: CustomerLite): string {
  return [c.name, c.company, c.customer_code, c.city, c.area, c.phone, c.sms_mobile]
    .filter(Boolean).join(" ").toLowerCase();
}
