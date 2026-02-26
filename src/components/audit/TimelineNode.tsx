import {
  Package, FlaskConical, ShieldCheck, Truck, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ElementType> = {
  raw_material_received: Package,
  qc_released: ShieldCheck,
  production_started: FlaskConical,
  step_completed: CheckCircle2,
  qc_passed: ShieldCheck,
  dispatched: Truck,
  default: AlertTriangle,
};

const colorMap: Record<string, string> = {
  raw_material_received: "bg-warning/10 text-warning border-warning/20",
  qc_released: "bg-primary/10 text-primary border-primary/20",
  production_started: "bg-accent text-accent-foreground border-border",
  step_completed: "bg-primary/10 text-primary border-primary/20",
  qc_passed: "bg-primary/10 text-primary border-primary/20",
  dispatched: "bg-destructive/10 text-destructive border-destructive/20",
};

interface TimelineNodeProps {
  eventType: string;
  eventLabel: string;
  actorName: string | null;
  entityName: string | null;
  occurredAt: string;
  side: "left" | "right";
}

export function TimelineNode({
  eventType,
  eventLabel,
  actorName,
  entityName,
  occurredAt,
  side,
}: TimelineNodeProps) {
  const Icon = iconMap[eventType] || iconMap.default;
  const colors = colorMap[eventType] || "bg-muted text-muted-foreground border-border";

  return (
    <div
      className={cn(
        "flex items-center gap-4 w-full",
        side === "left" ? "flex-row-reverse text-right" : "flex-row text-left"
      )}
    >
      {/* Content card */}
      <div className={cn("flex-1 max-w-[45%] rounded-xl border p-4 transition-all hover:shadow-md", colors)}>
        <div className="flex items-center gap-2" style={{ flexDirection: side === "left" ? "row-reverse" : "row" }}>
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="font-heading font-semibold text-sm">{eventLabel}</span>
        </div>
        {entityName && <p className="text-xs mt-1 opacity-80">{entityName}</p>}
        <div className="flex items-center gap-2 mt-2 text-[10px] opacity-60" style={{ justifyContent: side === "left" ? "flex-end" : "flex-start" }}>
          {actorName && <span>{actorName}</span>}
          <span>{new Date(occurredAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Center dot */}
      <div className="relative z-10 flex-shrink-0">
        <div className={cn("w-4 h-4 rounded-full border-2 border-card", eventType === "dispatched" ? "bg-destructive" : "bg-primary")} />
      </div>

      {/* Spacer */}
      <div className="flex-1 max-w-[45%]" />
    </div>
  );
}
