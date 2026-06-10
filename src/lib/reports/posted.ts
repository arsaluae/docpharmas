/**
 * Reporting "posted-only" rule.
 *
 * Every financial / inventory report MUST exclude draft, voided, and cancelled
 * rows so it matches ledgers, stock movements and dashboard KPIs.
 *
 * Rule (per user spec, 2026-06-10):
 *   status NOT IN ('draft','voided','cancelled')
 *
 * This is applied to: sales_invoices, purchase_invoices, sales_returns,
 * purchase_returns, payments, credit_notes, debit_notes, expenses, salary_payments.
 * Sales / purchase orders and proformas live in separate tables and are excluded
 * from reports by construction.
 */
export const NOT_POSTED_STATUSES = ["draft", "voided", "cancelled"] as const;

/** Postgrest `in` list literal — `(draft,voided,cancelled)` */
export const NOT_POSTED_IN_LITERAL = `(${NOT_POSTED_STATUSES.join(",")})`;

/** Chain on any PostgrestFilterBuilder to drop draft/voided/cancelled rows. */
export function applyPosted<T extends { not: (...args: any[]) => T }>(query: T): T {
  return query.not("status", "in", NOT_POSTED_IN_LITERAL);
}

/** Filter an already-fetched array by the same rule. */
export function isPosted(row: { status?: string | null }): boolean {
  const s = (row?.status ?? "").toLowerCase();
  return !NOT_POSTED_STATUSES.includes(s as any);
}
