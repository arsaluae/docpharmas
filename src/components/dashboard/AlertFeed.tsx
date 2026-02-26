import { motion } from "framer-motion";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  batch_id: string | null;
  created_at: string;
  resolved: boolean;
}

const severityConfig = (s: string) => {
  switch (s) {
    case "critical": return { icon: ShieldAlert, cls: "text-destructive", dot: "bg-destructive", bg: "bg-destructive/10" };
    case "warning": return { icon: AlertTriangle, cls: "text-warning", dot: "bg-warning", bg: "bg-warning/10" };
    default: return { icon: Info, cls: "text-primary", dot: "bg-primary", bg: "bg-primary/10" };
  }
};

export function AlertFeed({ alerts }: { alerts: Alert[] }) {
  const unresolvedAlerts = alerts.filter(a => !a.resolved);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="glass-card p-5 h-full"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-sm font-medium text-muted-foreground">
          Alert Feed
        </h3>
        <span className="status-critical text-[10px]">
          {unresolvedAlerts.length} Active
        </span>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
        {unresolvedAlerts.map((alert, i) => {
          const cfg = severityConfig(alert.severity);
          const Icon = cfg.icon;
          const borderVar = alert.severity === "critical" ? "--destructive" : alert.severity === "warning" ? "--warning" : "--primary";
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.08 }}
              className={`floating-row flex gap-3 items-start ${cfg.bg} border-l-2`}
              style={{ borderLeftColor: `hsl(var(${borderVar}))` }}
            >
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.cls}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-relaxed">
                  {alert.message}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-muted-foreground capitalize">{alert.type}</span>
                  <span className="text-[10px] text-muted-foreground">•</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
