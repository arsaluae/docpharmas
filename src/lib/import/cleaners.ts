// Shared data cleaners for legacy ERP imports.
// Pure functions — no DB calls, fully unit-testable.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface EmailResult {
  email: string | null;
  overflow: string | null; // license / address text dumped in the email column
}

/**
 * Validates the cell content as email; if invalid but the text looks
 * like a license number / address / freeform note, returns it as overflow
 * so the caller can route it to a `notes` field.
 */
export function cleanEmail(v: unknown): EmailResult {
  if (v === null || v === undefined) return { email: null, overflow: null };
  const raw = String(v).trim();
  if (!raw) return { email: null, overflow: null };
  const candidate = raw.split(/[;,\s]+/).find(p => EMAIL_RE.test(p));
  if (candidate) return { email: candidate.toLowerCase(), overflow: null };
  // Looks like license/address text — keep it as a note.
  return { email: null, overflow: raw };
}

/**
 * Pakistani mobile normalizer. Returns canonical 03XXXXXXXXX when possible,
 * otherwise digits-only string, otherwise null. Never throws.
 */
export function cleanMobile(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const digits = String(v).replace(/[^\d]/g, "");
  if (!digits) return null;
  // +92 / 0092 / 92 prefixes
  let d = digits;
  if (d.startsWith("0092")) d = d.slice(4);
  else if (d.startsWith("92") && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith("3")) d = "0" + d;
  return d;
}

/**
 * Robust date parser used by validators. Treats `0000-00-00`, `0`, and blanks
 * as null. Handles Excel serial numbers and most string formats.
 */
export function parseLegacyDate(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    return Number.isFinite(v.getTime()) ? v.toISOString().slice(0, 10) : null;
  }
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v <= 0) return null;
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (/^0+(-0+)*$/.test(s.replace(/[-/]/g, "-"))) return null; // 0000-00-00, 0, 00/00/0000
  if (s === "0000-00-00" || s === "00/00/0000") return null;
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function batchKey(sku: unknown, batch: unknown): string {
  return `${String(sku ?? "").trim().toLowerCase()}::${String(batch ?? "").trim().toLowerCase()}`;
}

/**
 * Compose a customer/supplier display name from a Title + First + Last + Business
 * combination, falling back to whichever field has content.
 */
export function composeName(parts: {
  business?: unknown;
  title?: unknown;
  first?: unknown;
  last?: unknown;
  name?: unknown;
}): string | null {
  const trim = (x: unknown) => String(x ?? "").trim();
  const business = trim(parts.business);
  const direct = trim(parts.name);
  if (direct) return direct;
  if (business) return business;
  const personal = [trim(parts.title), trim(parts.first), trim(parts.last)].filter(Boolean).join(" ").trim();
  return personal || null;
}

/**
 * Coerce common legacy product-type strings ("Tab", "Tablets", "Syp.") onto
 * our internal enum. Unknown values fall back to "other".
 */
const CATEGORY_ALIASES: Record<string, string> = {
  tab: "tablet", tabs: "tablet", tablet: "tablet", tablets: "tablet",
  cap: "capsule", caps: "capsule", capsule: "capsule", capsules: "capsule",
  syp: "syrup", syrup: "syrup", susp: "syrup", suspension: "syrup",
  inj: "injection", injection: "injection", amp: "injection", ampoule: "injection", vial: "injection",
  cream: "cream", lotion: "cream",
  oint: "ointment", ointment: "ointment", gel: "ointment",
  drops: "drops", drop: "drops",
  sachet: "sachet", sachets: "sachet", powder: "sachet",
};
export function coerceCategory(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase().replace(/[.]/g, "");
  if (!s) return "other";
  return CATEGORY_ALIASES[s] ?? (s in {tablet:1,capsule:1,syrup:1,injection:1,cream:1,ointment:1,drops:1,sachet:1,other:1} ? s : "other");
}

export function mergeNotes(...parts: (string | null | undefined)[]): string | null {
  const cleaned = parts.map(p => (p == null ? "" : String(p).trim())).filter(Boolean);
  return cleaned.length ? cleaned.join(" · ") : null;
}
