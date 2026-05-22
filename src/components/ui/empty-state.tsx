import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Centered, thin-icon empty state. No cartoons, no illustration.
 * Two lines of text, optional action button.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 px-6 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded border border-border bg-foreground/[0.02]">
          <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.25} />
        </div>
      )}
      <div className="space-y-1 max-w-sm">
        <p className="text-[14px] font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
