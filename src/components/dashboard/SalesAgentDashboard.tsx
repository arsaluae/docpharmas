import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Users, FileText, Wallet } from "lucide-react";

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const startOf = (period: "today" | "week" | "month") => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") d.setDate(d.getDate() - d.getDay());
  if (period === "month") d.setDate(1);
  return d.toISOString().split("T")[0];
};

/**
 * Slim dashboard for the sales_agent role.
 * Scope: ONLY the agent's assigned customers' sales activity.
 * No purchase, cost, margin, P&L, or company-wide data of any kind.
 */
export default function SalesAgentDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(0);
  const [week, setWeek] = useState(0);
  const [month, setMonth] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [customers, setCustomers] = useState(0);
  const [recent, setRecent] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; total: number }[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    // RLS + is_agent_customer() automatically scope these to the agent's customers.
    const [{ data: invs }, { data: custs }] = await Promise.all([
      supabase.from("sales_invoices")
        .select("id, invoice_number, date, total, amount_paid, status, customer_id, customers(name)")
        .neq("status", "voided")
        .order("date", { ascending: false })
        .limit(500),
      supabase.from("customers").select("id, name, balance"),
    ]);

    const today0 = startOf("today"), week0 = startOf("week"), month0 = startOf("month");
    let t = 0, w = 0, m = 0;
    (invs || []).forEach((i: any) => {
      const total = Number(i.total) || 0;
      if (i.date >= today0) t += total;
      if (i.date >= week0)  w += total;
      if (i.date >= month0) m += total;
    });
    setToday(t); setWeek(w); setMonth(m);

    setCustomers((custs || []).length);
    setOutstanding((custs || []).reduce((s, c: any) => s + Math.max(0, Number(c.balance) || 0), 0));

    setRecent((invs || []).slice(0, 8));

    // top customers by month sales
    const byCust = new Map<string, number>();
    (invs || []).filter((i: any) => i.date >= month0).forEach((i: any) => {
      const name = (i.customers as any)?.name || "—";
      byCust.set(name, (byCust.get(name) || 0) + Number(i.total));
    });
    setTopCustomers(Array.from(byCust.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5));

    setLoading(false);
  };

  const kpis = [
    { label: "Today", value: today, hint: "Sales booked today" },
    { label: "This Week", value: week, hint: "Sales since Sunday" },
    { label: "This Month", value: month, hint: "Sales month to date" },
    { label: "Outstanding", value: outstanding, hint: `${customers} customer${customers === 1 ? "" : "s"}`, accent: true },
  ];

  return (
    <AppLayout title="My Sales" subtitle="Your assigned customers only">
      <div className="space-y-5">
        {/* KPI strip */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {kpis.map(k => (
              <div key={k.label} className={`p-5 md:p-6 border-r border-border last:border-r-0 ${k.accent ? "bg-primary/[0.03]" : ""}`}>
                <div className={`text-[10px] font-bold tracking-widest uppercase mb-2 ${k.accent ? "text-primary" : "text-muted-foreground"}`}>{k.label}</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs text-muted-foreground font-light">PKR</span>
                  <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                    {loading ? "—" : Math.round(k.value).toLocaleString()}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5">{k.hint}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Recent invoices */}
          <div className="lg:col-span-2 rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Recent Invoices
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => navigate("/proforma")}>
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-border bg-muted/10">
                    <th className="py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Invoice</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Customer</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Total</th>
                    <th className="py-2.5 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No invoices yet.</td></tr>
                  ) : recent.map((i: any) => (
                    <tr key={i.id} className="border-b border-border/60 hover:bg-accent/40 cursor-pointer"
                      onClick={() => navigate(`/proforma?invoice=${i.id}`)}>
                      <td className="py-3 px-4 font-mono text-[12.5px] text-muted-foreground tabular-nums">{fmtDate(i.date)}</td>
                      <td className="py-3 px-4 font-mono text-[12.5px] text-foreground">{i.invoice_number}</td>
                      <td className="py-3 px-4 text-[13px] text-foreground/90">{(i.customers as any)?.name || "—"}</td>
                      <td className="py-3 px-4 text-right font-mono text-[13px] tabular-nums">{Number(i.total).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-mono text-[13px] tabular-nums text-success">{Number(i.amount_paid).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top customers + quick actions */}
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Top Customers (Month)
              </div>
              <div className="divide-y divide-border/60">
                {topCustomers.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No sales this month.</div>
                ) : topCustomers.map(c => (
                  <div key={c.name} className="flex items-center justify-between px-5 py-3">
                    <span className="text-sm text-foreground truncate">{c.name}</span>
                    <span className="font-mono text-[13px] tabular-nums text-primary font-medium">{Math.round(c.total).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 space-y-2">
              <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">Quick Actions</div>
              <Button className="w-full justify-start gap-2" variant="outline" onClick={() => navigate("/proforma")}>
                <FileText className="h-4 w-4" /> New Sales Order
              </Button>
              <Button className="w-full justify-start gap-2" variant="outline" onClick={() => navigate("/collect-payment")}>
                <Wallet className="h-4 w-4" /> Record Payment
              </Button>
              <Button className="w-full justify-start gap-2" variant="outline" onClick={() => navigate("/stock-availability")}>
                <Users className="h-4 w-4" /> Check Stock
              </Button>
              <Button className="w-full justify-start gap-2" variant="outline" onClick={() => navigate("/reports/agent")}>
                <ArrowUpRight className="h-4 w-4" /> My Reports
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
