// Helpers for the Customer Contact Import Wizard.
// Header alias detection, name/mobile normalization, smart matching.

export interface ContactRow {
  rowNumber: number;
  raw: Record<string, string>;
  customer_name: string;
  customer_code: string;
  contact_name: string;
  mobile: string;
  phone: string;
  designation: string;
  email: string;
}

export interface CustomerLite {
  id: string;
  name: string | null;
  company: string | null;
  customer_code: string | null;
}

export type MatchStatus = "auto" | "review" | "unmatched" | "accepted" | "skipped" | "created";

export interface MatchResult {
  row: ContactRow;
  matchedCustomerId: string | null;
  matchedLabel: string;
  confidence: number;
  matchReason: string;
  status: MatchStatus;
}

const HEADER_ALIASES: Record<keyof Omit<ContactRow, "rowNumber" | "raw">, string[]> = {
  customer_name: ["customer name", "customer", "name", "business name", "pharmacy", "company"],
  customer_code: ["customer code", "code", "account code", "a/c no", "ac no", "account no", "customer #"],
  contact_name: ["contact person", "contact name", "contact", "person", "attention", "attn"],
  mobile: ["mobile", "cell", "mobile #", "cell #", "mobile number"],
  phone: ["phone", "telephone", "landline", "phone #", "phone number"],
  designation: ["designation", "title", "role", "position"],
  email: ["email", "e-mail", "mail"],
};

export function detectHeaderMap(headers: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const norm = headers.map(h => String(h ?? "").trim().toLowerCase());
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = norm.findIndex(h => aliases.includes(h));
    if (idx >= 0) out[field] = idx;
  }
  return out;
}

export function parseRows(aoa: unknown[][], headerMap: Record<string, number>): ContactRow[] {
  const get = (row: unknown[], key: string) => {
    const idx = headerMap[key];
    if (idx == null) return "";
    return String(row[idx] ?? "").trim();
  };
  return aoa.map((row, i): ContactRow => ({
    rowNumber: i + 2,
    raw: Object.fromEntries(Object.keys(headerMap).map(k => [k, get(row, k)])),
    customer_name: get(row, "customer_name"),
    customer_code: get(row, "customer_code"),
    contact_name: get(row, "contact_name"),
    mobile: get(row, "mobile"),
    phone: get(row, "phone"),
    designation: get(row, "designation"),
    email: get(row, "email"),
  })).filter(r => r.contact_name || r.mobile || r.email);
}

// Lower, strip punctuation, collapse spaces, drop common pharmacy suffixes.
const SUFFIX_RE = /\b(pharmacy|medicos|medical|store|stores|pvt|ltd|limited|llp|co|enterprises|traders|trading|surgicals?)\b/gi;
export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(SUFFIX_RE, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMobile(s: string | null | undefined): string {
  if (!s) return "";
  const digits = String(s).replace(/\D+/g, "");
  return digits.slice(-10);
}

export function normalizeEmail(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

// Dice coefficient on bigrams; cheap fuzzy score 0..1.
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

export function matchRow(row: ContactRow, customers: CustomerLite[]): MatchResult {
  // 1) customer_code exact
  if (row.customer_code) {
    const code = row.customer_code.trim().toLowerCase();
    const c = customers.find(c => (c.customer_code ?? "").trim().toLowerCase() === code);
    if (c) return {
      row, matchedCustomerId: c.id,
      matchedLabel: c.name || c.company || c.customer_code || "—",
      confidence: 100, matchReason: "Code match", status: "auto",
    };
  }
  // 2) exact name/company (case-insensitive trim)
  const target = row.customer_name.trim().toLowerCase();
  if (target) {
    const c = customers.find(c =>
      (c.name ?? "").trim().toLowerCase() === target ||
      (c.company ?? "").trim().toLowerCase() === target);
    if (c) return {
      row, matchedCustomerId: c.id,
      matchedLabel: c.name || c.company || "—",
      confidence: 95, matchReason: "Exact name", status: "auto",
    };
  }
  // 3) normalized fuzzy
  const nTarget = normalizeName(row.customer_name);
  if (nTarget) {
    let best: { c: CustomerLite; score: number } | null = null;
    for (const c of customers) {
      const score = Math.max(
        diceCoefficient(nTarget, normalizeName(c.name)),
        diceCoefficient(nTarget, normalizeName(c.company)),
      );
      if (!best || score > best.score) best = { c, score };
    }
    if (best && best.score >= 0.6) {
      const conf = Math.round(best.score * 100);
      return {
        row, matchedCustomerId: best.c.id,
        matchedLabel: best.c.name || best.c.company || "—",
        confidence: conf,
        matchReason: "Fuzzy name",
        status: conf >= 85 ? "auto" : "review",
      };
    }
  }
  return {
    row, matchedCustomerId: null, matchedLabel: "",
    confidence: 0, matchReason: "No match", status: "unmatched",
  };
}

export interface ExistingContactLite {
  id: string;
  customer_id: string;
  contact_name: string | null;
  mobile: string | null;
  email: string | null;
}

export type DuplicateAction = "update" | "skip" | "create";

export interface DuplicateDecision {
  rowNumber: number;
  existingId: string;
  action: DuplicateAction;
}

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
