import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function CashFlow() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().split("T")[0]; });
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [chartData, setChartData] = useState<{ month: string; inflows: number; outflows: number; net: number }[]>([]);

  useEffect(() => { load(); }, [from, to]);

  const load = async () => {
    const NOT_POSTED = "(draft,voided,cancelled)";
    const [payments, expenses, salaries] = await Promise.all([
      supabase.from("payments").select("type, amount, date").gte("date", from).lte("date", to).not("status", "in", NOT_POSTED),
      supabase.from("expenses").select("amount, date").eq("expense_type", "business").gte("date", from).lte("date", to).not("status", "in", NOT_POSTED),
      supabase.from("salary_payments").select("amount, date").gte("date", from).lte("date", to).not("status", "in", NOT_POSTED),
    ]);

    const months: Record<string, { inflows: number; outflows: number }> = {};
    const addMonth = (d: string) => d.substring(0, 7);
    const ensure = (m: string) => { if (!months[m]) months[m] = { inflows: 0, outflows: 0 }; };

    (payments.data || []).forEach(p => {
      const m = addMonth(p.date);
      ensure(m);
      if (p.type === "received") months[m].inflows += Number(p.amount);
      else months[m].outflows += Number(p.amount);
    });
    (expenses.data || []).forEach(e => {
      const m = addMonth(e.date);
      ensure(m);
      months[m].outflows += Number(e.amount);
    });
    (salaries.data || []).forEach(s => {
      const m = addMonth(s.date);
      ensure(m);
      months[m].outflows += Number(s.amount);
    });

    const sorted = Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({
      month, inflows: v.inflows, outflows: v.outflows, net: v.inflows - v.outflows,
    }));
    setChartData(sorted);
  };

  const totalIn = chartData.reduce((s, d) => s + d.inflows, 0);
  const totalOut = chartData.reduce((s, d) => s + d.outflows, 0);

  const headerActions = (
    <div className="flex items-center gap-2">
      <Label className="text-xs">From</Label><Input type="date" className="w-36" value={from} onChange={e => setFrom(e.target.value)} />
      <Label className="text-xs">To</Label><Input type="date" className="w-36" value={to} onChange={e => setTo(e.target.value)} />
    </div>
  );

  return (
    <AppLayout title="Cash Flow" headerActions={headerActions}>
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Card className="glass-card"><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Total Inflows</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold font-mono text-primary">PKR {totalIn.toLocaleString()}</p></CardContent></Card>
          <Card className="glass-card"><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Total Outflows</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold font-mono text-destructive">PKR {totalOut.toLocaleString()}</p></CardContent></Card>
          <Card className="glass-card"><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Net Cash Flow</CardTitle></CardHeader>
            <CardContent><p className={`text-xl font-bold font-mono ${totalIn - totalOut >= 0 ? "text-primary" : "text-destructive"}`}>PKR {(totalIn - totalOut).toLocaleString()}</p></CardContent></Card>
        </div>
        <Card className="glass-card">
          <CardContent className="pt-6">
            {chartData.length === 0 ? <p className="text-center text-muted-foreground py-12">No cash flow data yet.</p> : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `PKR ${v.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="inflows" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outflows" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
