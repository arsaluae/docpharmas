import { Activity, ShieldAlert, CheckCircle, FlaskConical } from "lucide-react";
import { motion } from "framer-motion";

interface KPIData {
  activeBatches: number;
  quarantineItems: number;
  complianceScore: number;
  pendingQC: number;
}

export function KPICards({ data }: { data: KPIData }) {
  const cards = [
    {
      label: "Active Batches",
      value: data.activeBatches,
      icon: Activity,
      color: "text-primary",
      glow: "glow-teal",
      bgAccent: "bg-primary/10",
    },
    {
      label: "Quarantine Items",
      value: data.quarantineItems,
      icon: ShieldAlert,
      color: "text-warning",
      glow: "",
      bgAccent: "bg-warning/10",
    },
    {
      label: "Compliance Score",
      value: `${data.complianceScore}%`,
      icon: CheckCircle,
      color: "text-primary",
      glow: "",
      bgAccent: "bg-primary/10",
    },
    {
      label: "Pending QC",
      value: data.pendingQC,
      icon: FlaskConical,
      color: "text-destructive",
      glow: "",
      bgAccent: "bg-destructive/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          className="glass-card-glow p-5 flex items-start gap-4"
        >
          <div className={`${card.bgAccent} p-2.5 rounded-lg`}>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">{card.label}</p>
            <p className={`text-2xl font-heading font-bold ${card.color} mt-0.5`}>
              {card.value}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
