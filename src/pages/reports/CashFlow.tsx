import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function CashFlow() {
  const navigate = useNavigate();
  const [chartData, setChartData] = useState<{ month: string; inflows: number; outflows: number; net: number }[]>([]);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const [payments, expenses] = await Promise.all([
      supabase.from("payments").select("type, amount, date"),
      supabase.from("expenses").select("amount, date"),
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

    const sorted = Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({
      month, inflows: v.inflows, outflows: v.outflows, net: v.inflows - v.outflows,
    }));
    setChartData(sorted);
  };

  const totalIn = chartData.reduce((s, d) => s + d.inflows, 0);
  const totalOut = chartData.reduce((s, d) => s + d.outflows, 0);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-bold text-foreground font-heading">Cash Flow</h1>
          </header>
          <div className="p-6 space-y-6">
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
        </main>
      </div>
    </SidebarProvider>
  );
}
