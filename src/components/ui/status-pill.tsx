import { cn } from "@/lib/utils";

type StatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent"
  | "muted";

interface StatusPillProps {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
  dot?: boolean;
}

const toneStyles: Record<StatusTone, string> = {
  neutral: "border-border bg-foreground/[0.04] text-muted-foreground",
  muted: "border-border/60 text-muted-foreground/80",
  success: "border-success/40 bg-success/[0.08] text-success",
  warning: "border-warning/40 bg-warning/[0.08] text-warning",
  danger: "border-danger/40 bg-danger/[0.08] text-danger",
  info: "border-info/40 bg-info/[0.08] text-info",
  accent: "border-primary/40 bg-primary/[0.08] text-primary",
};

const dotColors: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground/60",
  muted: "bg-muted-foreground/40",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  accent: "bg-primary",
};

/**
 * Unified status pill. Use across batch validity, document status,
 * payment status — everything that displays state.
 */
export function StatusPill({ children, tone = "neutral", className, dot = false }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] leading-tight",
        toneStyles[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[tone])} />}
      {children}
    </span>
  );
}

/** Convenience: expiry tone from a date — VALID / EXPIRING / EXPIRED. */
export function expiryTone(date: string | Date | null | undefined): StatusTone {
  if (!date) return "muted";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "muted";
  const days = Math.floor((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "danger";
  if (days < 60) return "warning";
  return "success";
}

export function expiryLabel(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const days = Math.floor((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Expired";
  if (days < 60) return "Expiring";
  return "Valid";
}
