import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const fmtPkr = (n: number) =>
  new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(Math.round(n));

interface Props {
  data: { date: string; amount: number }[];
}

export default function PerformanceTrendChart({ data }: Props) {
  const max = Math.max(...data.map(d => d.amount), 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 4 }} barCategoryGap={4}>
        <CartesianGrid strokeDasharray="0" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="date" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            fontSize: 11, borderRadius: 4, padding: "8px 12px",
            border: "1px solid hsl(var(--border-strong))",
            background: "#FFFFFF",
            boxShadow: "none",
            fontFamily: "JetBrains Mono",
          }}
          labelStyle={{ color: "hsl(var(--subtle))", marginBottom: 4, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}
          formatter={(v: number) => [`PKR ${fmtPkr(v)}`, "Sales"]}
          cursor={{ fill: "hsl(var(--brand-blue) / 0.06)" }}
        />
        <Bar dataKey="amount" radius={0} isAnimationActive={false}>
          {data.map((d, i) => {
            const isToday = i === data.length - 1;
            const isPeak = !isToday && d.amount === max && max > 0;
            const fill = isToday
              ? "hsl(var(--brand-blue))"
              : isPeak
                ? "hsl(var(--success) / 0.55)"
                : "hsl(var(--brand-navy) / 0.12)";
            return <Cell key={i} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
