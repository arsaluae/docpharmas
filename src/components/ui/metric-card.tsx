import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  format?: "number" | "currency" | "compact";
  trend?: { value: number; label?: string } | null;
  sparkline?: number[];
  icon?: LucideIcon;
  className?: string;
}

function formatValue(value: number, format: MetricCardProps["format"]) {
  if (format === "currency") {
    return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(value);
  }
  if (format === "compact") {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function useCountUp(target: number, durationMs = 800) {
  const [v, setV] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const p = Math.min(1, elapsed / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
      else setV(target);
    };
    if (Math.abs(target) > 0) rafRef.current = requestAnimationFrame(animate);
    else setV(0);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, durationMs]);

  return v;
}

/**
 * Bloomberg-style metric tile. Monospaced number, trend pill, sparkline.
 */
export function MetricCard({
  label,
  value,
  prefix,
  suffix,
  format = "number",
  trend,
  sparkline,
  icon: Icon,
  className,
}: MetricCardProps) {
  const animated = useCountUp(value);
  const display = formatValue(Math.round(animated), format);
  const trendPositive = (trend?.value ?? 0) >= 0;

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-md border border-border bg-card p-4 transition-colors duration-150 hover:border-foreground/15",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <Icon className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.25} />
        )}
      </div>

      <div className="flex items-end gap-2">
        <span className="font-mono text-[26px] font-light leading-none tracking-[-0.02em] text-foreground tabular-nums">
          {prefix && <span className="text-muted-foreground/70 mr-1 text-[18px]">{prefix}</span>}
          {display}
          {suffix && <span className="text-muted-foreground/70 ml-1 text-[16px]">{suffix}</span>}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        {trend ? (
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10.5px] font-mono",
              trendPositive
                ? "text-success bg-success/10 border border-success/30"
                : "text-danger bg-danger/10 border border-danger/30",
            )}
          >
            {trendPositive ? (
              <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} />
            ) : (
              <ArrowDownRight className="h-3 w-3" strokeWidth={1.5} />
            )}
            <span className="tabular-nums">
              {trendPositive ? "+" : ""}
              {trend.value.toFixed(1)}%
            </span>
            {trend.label && (
              <span className="text-muted-foreground ml-1 normal-case">{trend.label}</span>
            )}
          </div>
        ) : (
          <span />
        )}
        {sparkline && sparkline.length > 1 && (
          <div className="h-8 w-24 opacity-90">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline.map((y, i) => ({ i, y }))}>
                <Line
                  type="monotone"
                  dataKey="y"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.25}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
