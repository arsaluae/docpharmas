import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Pharma date format — always DD MMM YYYY (e.g. 14 Mar 2025).
 * Never MM/DD/YYYY, never ambiguous.
 */
export function formatDateDDMMMYYYY(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Short variant — DD MMM (e.g. 14 Mar). Use in dense tables. */
export function formatDateDDMMM(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
}

/** Format a number with the PKR convention, no currency symbol. Always 2 decimals. */
export function formatAmount(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0.00";
  return new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Compact number formatter (e.g. 12.4K, 3.1M). */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
