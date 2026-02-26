import { cn } from "@/lib/utils";
import { Check, Clock } from "lucide-react";

interface BMRStepCardProps {
  stepName: string;
  stepOrder: number;
  status: string;
  completedAt: string | null;
  yieldExpected: number;
  yieldActual: number | null;
  onToggle: () => void;
  disabled?: boolean;
}

export function BMRStepCard({
  stepName,
  stepOrder,
  status,
  completedAt,
  yieldExpected,
  yieldActual,
  onToggle,
  disabled,
}: BMRStepCardProps) {
  const isCompleted = status === "completed";

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-card p-6 min-h-[140px] flex items-center justify-between transition-all duration-300",
        isCompleted
          ? "border-border/60 opacity-80"
          : "border-l-4 border-l-primary border-t border-r border-b border-border shadow-md"
      )}
    >
      <div className="flex items-center gap-5">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-lg font-heading font-bold",
            isCompleted
              ? "bg-muted text-muted-foreground"
              : "bg-primary/10 text-primary"
          )}
        >
          {stepOrder}
        </div>
        <div>
          <h3 className="font-heading font-semibold text-xl text-foreground">
            {stepName}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {isCompleted ? (
              <>
                <Check className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">
                  Completed{" "}
                  {completedAt
                    ? new Date(completedAt).toLocaleTimeString()
                    : ""}
                </span>
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs text-muted-foreground">Pending</span>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Expected yield: {yieldExpected}%
            {yieldActual != null && ` · Actual: ${yieldActual}%`}
          </p>
        </div>
      </div>

      {/* Oversized toggle */}
      <button
        onClick={onToggle}
        disabled={disabled}
        className={cn(
          "relative h-12 w-24 rounded-full transition-colors duration-300 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isCompleted ? "bg-primary" : "bg-input",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "absolute top-1 block h-10 w-10 rounded-full bg-card shadow-lg transition-transform duration-300",
            isCompleted ? "translate-x-[52px]" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
