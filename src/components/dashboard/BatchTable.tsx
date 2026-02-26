import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

interface Batch {
  id: string;
  name: string;
  product: string;
  status: string;
  progress: number;
  stage: string;
  created_at: string;
  updated_at: string;
}

const statusLabel = (s: string) => {
  switch (s) {
    case "in_progress": return { text: "In Progress", cls: "status-active" };
    case "completed": return { text: "Completed", cls: "status-completed" };
    case "quarantine": return { text: "Quarantine", cls: "status-quarantine" };
    case "failed": return { text: "Failed", cls: "status-critical" };
    default: return { text: s, cls: "status-active" };
  }
};

export function BatchTable({ batches }: { batches: Batch[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="glass-card p-5"
    >
      <h3 className="font-heading text-sm font-medium text-muted-foreground mb-4">
        Recent Batch Activity
      </h3>

      {/* Header */}
      <div className="grid grid-cols-[1fr_1.5fr_100px_80px_100px_100px] gap-3 px-4 py-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
        <span>Batch</span>
        <span>Product</span>
        <span>Status</span>
        <span>Progress</span>
        <span>Stage</span>
        <span>Updated</span>
      </div>

      {/* Rows */}
      <div className="space-y-1.5">
        {batches.map((batch, i) => {
          const st = statusLabel(batch.status);
          return (
            <motion.div
              key={batch.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              className="floating-row grid grid-cols-[1fr_1.5fr_100px_80px_100px_100px] gap-3 items-center text-sm hover:bg-accent/30 transition-colors cursor-pointer"
            >
              <span className="font-medium text-foreground font-heading">{batch.name}</span>
              <span className="text-muted-foreground truncate">{batch.product}</span>
              <span className={st.cls}>{st.text}</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${batch.progress}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{batch.progress}%</span>
              </div>
              <span className="text-muted-foreground text-xs capitalize">
                {batch.stage.replace("_", " ")}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatDistanceToNow(new Date(batch.updated_at), { addSuffix: true })}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
