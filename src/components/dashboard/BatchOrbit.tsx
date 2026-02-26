import { motion } from "framer-motion";

interface Batch {
  id: string;
  name: string;
  product: string;
  status: string;
  progress: number;
  stage: string;
}

export function BatchOrbit({ batches }: { batches: Batch[] }) {
  const activeBatches = batches.filter(b => b.status === "in_progress").slice(0, 5);
  const centerBatch = activeBatches[0];

  const statusColor = (status: string) => {
    switch (status) {
      case "in_progress": return "hsl(231, 91%, 64%)";
      case "quarantine": return "hsl(258, 73%, 58%)";
      case "failed": return "hsl(330, 81%, 60%)";
      default: return "hsl(231, 91%, 64%)";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="glass-card-glow p-6 flex flex-col items-center justify-center relative overflow-hidden"
      style={{ minHeight: 320 }}
    >
      <h3 className="font-heading text-sm font-medium text-muted-foreground mb-4 self-start">
        Batch Orbit
      </h3>

      <div className="relative w-[280px] h-[280px] flex items-center justify-center">
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full border-2 border-primary/15"
        />

        {/* Progress ring SVG */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 280 280">
          <circle
            cx="140" cy="140" r="130"
            fill="none"
            stroke="hsl(220, 13%, 91%)"
            strokeWidth="4"
          />
          {centerBatch && (
            <circle
              cx="140" cy="140" r="130"
              fill="none"
              stroke="hsl(231, 91%, 64%)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${(centerBatch.progress / 100) * 817} 817`}
              style={{ filter: "drop-shadow(0 0 4px hsl(231 91% 64% / 0.3))" }}
            />
          )}
        </svg>

        {/* Center info */}
        {centerBatch && (
          <div className="z-10 text-center">
            <p className="text-3xl font-heading font-bold text-primary">
              {centerBatch.progress}%
            </p>
            <p className="text-sm font-medium text-foreground mt-1">
              {centerBatch.name}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {centerBatch.stage.replace("_", " ")}
            </p>
          </div>
        )}

        {/* Orbiting dots */}
        {activeBatches.map((batch, i) => (
          <div
            key={batch.id}
            className="absolute inset-0 flex items-center justify-center"
            style={{
              animation: `orbit ${8 + i * 2}s linear infinite`,
              animationDelay: `${i * -1.5}s`,
            }}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor: statusColor(batch.status),
                boxShadow: `0 0 8px ${statusColor(batch.status)}`,
                transform: `translateX(120px)`,
              }}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
