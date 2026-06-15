import { Lock, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  lockedAt?: string | null;
  submittedAt?: string | null;
  windowDays: number;
  className?: string;
}

export function LockBanner({ lockedAt, submittedAt, windowDays, className }: Props) {
  if (lockedAt) {
    return (
      <div className={cn("flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs", className)}>
        <Lock className="h-3.5 w-3.5 text-destructive mt-0.5" />
        <div>
          <p className="font-medium text-destructive">Locked on {new Date(lockedAt).toLocaleDateString()}</p>
          <p className="text-muted-foreground mt-0.5">Edit window expired. Use Purchase Return or Adjustment for corrections.</p>
        </div>
      </div>
    );
  }
  if (!submittedAt) return null;
  const elapsed = Math.floor((Date.now() - new Date(submittedAt).getTime()) / 86400000);
  const remaining = Math.max(windowDays - elapsed, 0);
  const warn = remaining <= 3;
  return (
    <div className={cn(
      "flex items-start gap-2 rounded border px-3 py-2 text-xs",
      warn ? "border-warning/40 bg-warning/10" : "border-border bg-muted/30",
      className
    )}>
      {warn ? <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5" /> : <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />}
      <div>
        <p className="font-medium">{remaining > 0 ? `${remaining} day${remaining === 1 ? "" : "s"} left to edit` : "Edit window expired"}</p>
        <p className="text-muted-foreground mt-0.5">Submitted {new Date(submittedAt).toLocaleDateString()} · window {windowDays}d</p>
      </div>
    </div>
  );
}
