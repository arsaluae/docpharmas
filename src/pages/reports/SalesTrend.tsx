import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { fetchAllRows } from "@/lib/batch-fetch";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function SalesTrend() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { (async () => {
    const inv = await fetchAllRows("sales_invoices", "date, subtotal, total");
    setRows(inv);
  })(); }, []);

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; orders: number }>();
    rows.forEach((r: any) => {
      const m = String(r.date).slice(0, 7);
      const cur = map.get(m) || { month: m, revenue: 0, orders: 0 };
      cur.revenue += Number(r.subtotal || 0);
      cur.orders += 1;
      map.set(m, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [rows]);

  const totalRev = monthly.reduce((s, m) => s + m.revenue, 0);
  const avg = monthly.length ? totalRev / monthly.length : 0;
  const last = monthly.at(-1), prev = monthly.at(-2);
  const mom = last && prev && prev.revenue > 0 ? ((last.revenue - prev.revenue) / prev.revenue) * 100 : 0;

  return (
    <AppLayout title="Sales Trend" subtitle="Monthly revenue & growth">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="glass-card"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Total Revenue</div><div className="text-2xl font-bold font-mono mt-1">PKR {totalRev.toLocaleString()}</div></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-5"><div className="text-xs text-muted-foreground">Avg / Month</div><div className="text-2xl font-bold font-mono mt-1">PKR {Math.round(avg).toLocaleString()}</div></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-5"><div className="text-xs text-muted-foreground">MoM Growth</div><div className={`text-2xl font-bold font-mono mt-1 ${mom >= 0 ? "text-primary" : "text-destructive"}`}>{mom.toFixed(1)}%</div></CardContent></Card>
      </div>
      <Card className="glass-card"><CardContent className="p-5">
        <div className="h-80">
          <ResponsiveContainer><LineChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="month" /><YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
          </LineChart></ResponsiveContainer>
        </div>
      </CardContent></Card>
    </AppLayout>
  );
}
