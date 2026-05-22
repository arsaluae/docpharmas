import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
// MetricCard kept available for future use; using bespoke vibrant tiles here
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import {
  TrendingUp, CalendarDays, FileText, Shield, Wallet, Package,
  Printer, Receipt, CreditCard, PackageCheck, Flame, Users,
  AlertTriangle, MessageCircle, CircleDollarSign, Clock, Truck,
  ArrowRight, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { WeekSalesDialog, MonthSalesDialog, GrossMarginDialog, UpcomingOrdersDialog } from "@/components/dashboard/KpiDialogs";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from "recharts";
import { formatDateDDMMMYYYY } from "@/lib/utils";

const fmtPkr = (n: number) =>
  new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(Math.round(n));

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

// Bloomberg-style ticker dot
const Dot = ({ tone = "muted" }: { tone?: "muted" | "success" | "danger" | "warning" }) => {
  const cls =
    tone === "success" ? "bg-success" :
    tone === "danger" ? "bg-danger" :
    tone === "warning" ? "bg-warning" :
    "bg-muted-foreground/40";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />;
};

// Section header: editorial label + thin rule
const SectionHeader = ({ label, right }: { label: string; right?: React.ReactNode }) => (
  <div className="flex items-end justify-between gap-4 mb-3">
    <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {label}
    </h3>
    {right}
  </div>
);

// Bordered panel — the Bloomberg "cell"
const Panel = ({
  children, className = "", padding = "p-4",
}: { children: React.ReactNode; className?: string; padding?: string }) => (
  <div className={`rounded-md border border-border bg-card ${padding} ${className}`}>
    {children}
  </div>
);

export default function Index() {
  const navigate = useNavigate();
  const { settings } = useCompanySettings();

  const [weekSales, setWeekSales] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [grossMargin, setGrossMargin] = useState(0);
  const [recentStock, setRecentStock] = useState<{ name: string; quantity: number; date: string }[]>([]);
  const [topSelling, setTopSelling] = useState<{ name: string; qty: number }[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; monthSale: number; yearlySale: number }[]>([]);
  const [reorderAlerts, setReorderAlerts] = useState<any[]>([]);
  const [loadingReorder, setLoadingReorder] = useState(false);
  const [dailySales, setDailySales] = useState<{ date: string; amount: number }[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<{ name: string; value: number }[]>([]);
  const [lastMonthSales, setLastMonthSales] = useState(0);
  const [upcomingPoCount, setUpcomingPoCount] = useState(0);
  const [upcomingPoValue, setUpcomingPoValue] = useState(0);
  const [totalReceivables, setTotalReceivables] = useState(0);
  const [totalPayables, setTotalPayables] = useState(0);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const monthStartStr = todayStr.slice(0, 7) + "-01";
  const dow = today.getDay();
  const monOffset = dow === 0 ? 6 : dow - 1;
  const weekStartDate = new Date(today); weekStartDate.setDate(today.getDate() - monOffset);
  const weekStartStr = weekStartDate.toISOString().split("T")[0];

  const [weekOpen, setWeekOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [gpOpen, setGpOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  const [expiryAlerts, setExpiryAlerts] = useState<{ critical: number; warning: number; info: number; items: { name: string; batch: string; expiry: string; qty: number; severity: string }[] }>({ critical: 0, warning: 0, info: 0, items: [] });

  useEffect(() => { loadDashboard(); loadReorderAlerts(); loadExpiryAlerts(); }, []);

  const loadDashboard = async () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const monthStart = todayStr.slice(0, 7) + "-01";
    const yearStart = todayStr.slice(0, 4) + "-01-01";
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - mondayOffset);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthStartStr = lastMonthStart.toISOString().split("T")[0];
    const lastMonthEndStr = lastMonthEnd.toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const [{ data: kpis }, { data: charts }] = await Promise.all([
      supabase.rpc("dashboard_kpis", {
        p_week_start: weekStartStr, p_month_start: monthStart, p_year_start: yearStart,
        p_last_month_start: lastMonthStartStr, p_last_month_end: lastMonthEndStr, p_today: todayStr,
      }),
      supabase.rpc("dashboard_charts", {
        p_month_start: monthStart, p_year_start: yearStart, p_trend_start: thirtyDaysAgoStr, p_today: todayStr,
      }),
    ]);

    const k: any = kpis || {};
    setWeekSales(Number(k.week_sales) || 0);
    setMonthSales(Number(k.month_sales) || 0);
    setLastMonthSales(Number(k.last_month_sales) || 0);
    setGrossMargin(Number(k.gross_profit) || 0);
    setTotalReceivables(Number(k.receivables) || 0);
    setTotalPayables(Number(k.payables) || 0);
    setUpcomingPoCount(Number(k.upcoming_po_count) || 0);
    setUpcomingPoValue(Number(k.upcoming_po_value) || 0);

    const c: any = charts || {};
    const dailyMap: Record<string, number> = {};
    (c.daily || []).forEach((d: any) => { dailyMap[d.date] = Number(d.amount); });
    const dailyArr: { date: string; amount: number }[] = [];
    for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split("T")[0];
      dailyArr.push({ date: ds.slice(5), amount: dailyMap[ds] || 0 });
    }
    setDailySales(dailyArr);
    setExpensesByCategory((c.expenses || []).map((e: any) => ({ name: String(e.name || "").replace(/_/g, " "), value: Number(e.value) })));
    setTopSelling((c.top_products || []).map((p: any) => ({ name: p.name, qty: Number(p.qty) })));
    setTopCustomers((c.top_customers || []).map((cu: any) => ({ name: cu.name, monthSale: Number(cu.monthSale), yearlySale: Number(cu.yearlySale) })));
    setRecentStock((c.recent_stock || []).map((s: any) => ({ name: s.name, quantity: Number(s.quantity), date: s.date })));
  };

  const loadReorderAlerts = async () => {
    const { data } = await supabase.from("reorder_alerts").select("*").order("days_until_stockout", { ascending: true }).limit(5);
    if (data) setReorderAlerts(data as any);
  };

  const loadExpiryAlerts = async () => {
    const today = new Date();
    const ninetyDaysLater = new Date(today);
    ninetyDaysLater.setDate(today.getDate() + 90);
    const { data: grnItems } = await supabase
      .from("grn_items")
      .select("product_id, batch_number, expiry_date, quantity_received")
      .not("expiry_date", "is", null)
      .lte("expiry_date", ninetyDaysLater.toISOString().split("T")[0]);
    const { data: prods } = await supabase.from("products").select("id, name");
    if (!grnItems || !prods) return;
    const prodMap = new Map(prods.map((p: any) => [p.id, p.name]));
    let critical = 0, warning = 0, info = 0;
    const items: { name: string; batch: string; expiry: string; qty: number; severity: string }[] = [];
    grnItems.forEach((g: any) => {
      if (!g.expiry_date) return;
      const diff = (new Date(g.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      let severity = "info";
      if (diff <= 0) { severity = "expired"; critical++; }
      else if (diff <= 30) { severity = "critical"; critical++; }
      else if (diff <= 60) { severity = "warning"; warning++; }
      else { severity = "info"; info++; }
      items.push({ name: prodMap.get(g.product_id) || "Unknown", batch: g.batch_number || "N/A", expiry: g.expiry_date, qty: Number(g.quantity_received), severity });
    });
    items.sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());
    setExpiryAlerts({ critical, warning, info, items: items.slice(0, 8) });
  };

  const generateReorderAlerts = async () => {
    setLoadingReorder(true);
    try {
      const { data, error } = await supabase.functions.invoke("reorder-alerts", {
        body: { whatsapp_number: settings?.whatsapp_number },
      });
      if (error) throw error;
      if (data?.alerts) {
        setReorderAlerts(data.alerts.slice(0, 5));
        toast.success(`${data.alerts.length} reorder alerts generated`);
        if (data.whatsapp_url) window.open(data.whatsapp_url, "_blank");
      }
    } catch (e: any) {
      toast.error("Failed to generate alerts: " + (e.message || "Unknown error"));
    }
    setLoadingReorder(false);
  };

  const monthGrowth = lastMonthSales > 0 ? ((monthSales - lastMonthSales) / lastMonthSales) * 100 : 0;
  const weekSparkline = dailySales.slice(-7).map(d => d.amount);
  const monthSparkline = dailySales.map(d => d.amount);
  const netPosition = totalReceivables - totalPayables;

  const quickActions = [
    { label: "Sales Invoice", path: "/proforma", icon: FileText, gradient: "gradient-indigo", glow: "glow-indigo" },
    { label: "Warranty", path: "/warranty-invoices", icon: Shield, gradient: "gradient-violet", glow: "glow-violet" },
    { label: "Payment In", path: "/payments", icon: Wallet, gradient: "gradient-emerald", glow: "glow-emerald" },
    { label: "Inventory", path: "/products", icon: Package, gradient: "gradient-amber", glow: "glow-amber" },
    { label: "Purchase Order", path: "/purchase-proforma", icon: FileText, gradient: "gradient-cyan", glow: "glow-cyan" },
    { label: "Print Jobs", path: "/print-jobs", icon: Printer, gradient: "gradient-fuchsia", glow: "glow-violet" },
    { label: "Expenses", path: "/expenses", icon: Receipt, gradient: "gradient-rose", glow: "glow-rose" },
    { label: "Credit Notes", path: "/credit-notes", icon: CreditCard, gradient: "gradient-sky", glow: "glow-cyan" },
  ];

  const kpiTiles = [
    {
      label: "Week to Date", value: weekSales, icon: TrendingUp,
      gradient: "gradient-indigo", glow: "glow-indigo",
      sparkline: weekSparkline, onClick: () => setWeekOpen(true),
      subtitle: "Last 7 days",
    },
    {
      label: "Month to Date", value: monthSales, icon: CalendarDays,
      gradient: "gradient-violet", glow: "glow-violet",
      sparkline: monthSparkline, onClick: () => setMonthOpen(true),
      trend: lastMonthSales > 0 ? monthGrowth : null,
      subtitle: lastMonthSales > 0 ? `vs PKR ${fmtCompact(lastMonthSales)} last month` : "No prior month",
    },
    {
      label: "Gross Profit", value: Math.abs(grossMargin), icon: CircleDollarSign,
      gradient: grossMargin >= 0 ? "gradient-emerald" : "gradient-rose",
      glow: grossMargin >= 0 ? "glow-emerald" : "glow-rose",
      onClick: () => setGpOpen(true),
      trend: monthSales > 0 ? (grossMargin / monthSales) * 100 : null,
      subtitle: "Revenue − COGS",
    },
    {
      label: "Upcoming Orders", value: upcomingPoValue, icon: Truck,
      gradient: "gradient-amber", glow: "glow-amber",
      onClick: () => setUpcomingOpen(true),
      subtitle: upcomingPoCount > 0 ? `${upcomingPoCount} open PO${upcomingPoCount > 1 ? "s" : ""}` : "None pending",
    },
  ];

  return (
    <AppLayout title="Dashboard" subtitle={`${new Date().toLocaleDateString("en-PK", { weekday: "long" })} · ${formatDateDDMMMYYYY(today)}`}>
      <div className="space-y-6">

        {/* ─── HERO ─── Vibrant mesh greeting */}
        <div className="mesh-hero-vibrant px-6 py-6 sm:py-7 relative overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-primary/70 mb-2 font-mono">
                {new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold font-heading">
                <span className="text-foreground">Good </span>
                <span className="text-gradient-primary">
                  {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}
                </span>
                {settings?.company_name && <span className="text-foreground">, {settings.company_name}</span>}
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5">Here's how your business is performing right now.</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur border border-border">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">Live</span>
            </div>
          </div>
        </div>

        {/* ─── TICKER ─── Vibrant gradient strip */}
        <div className="ticker-vibrant flex items-center gap-x-6 gap-y-2 flex-wrap px-4 py-2.5 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">MTD</span>
            <span className="tabular-nums text-foreground font-semibold">PKR {fmtPkr(monthSales)}</span>
            {lastMonthSales > 0 && (
              <span className={`inline-flex items-center gap-0.5 tabular-nums font-semibold ${monthGrowth >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {monthGrowth >= 0 ? <ArrowUpRight className="h-3 w-3" strokeWidth={2}/> : <ArrowDownRight className="h-3 w-3" strokeWidth={2}/>}
                {monthGrowth >= 0 ? "+" : ""}{monthGrowth.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">WTD</span>
            <span className="tabular-nums text-foreground font-semibold">PKR {fmtPkr(weekSales)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">A/R</span>
            <span className="tabular-nums text-emerald-500 font-semibold">PKR {fmtCompact(totalReceivables)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">A/P</span>
            <span className="tabular-nums text-rose-500 font-semibold">PKR {fmtCompact(totalPayables)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">NET</span>
            <span className={`tabular-nums font-semibold ${netPosition >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {netPosition >= 0 ? "+" : "−"}PKR {fmtCompact(Math.abs(netPosition))}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">PO Open</span>
            <span className="tabular-nums text-foreground font-semibold">{upcomingPoCount}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Expiring 90d</span>
            <span className={`tabular-nums font-semibold ${expiryAlerts.critical > 0 ? "text-rose-500" : "text-foreground"}`}>
              {expiryAlerts.critical + expiryAlerts.warning + expiryAlerts.info}
            </span>
          </div>
        </div>

        {/* ─── KPI GRID ─── Vibrant hero tiles */}
        <section>
          <SectionHeader label="Performance — Today" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiTiles.map((k) => (
              <button
                key={k.label}
                onClick={k.onClick}
                className={`card-vibrant ${k.glow} text-left p-5 group`}
              >
                <div className="flex items-start justify-between mb-4 relative z-10">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{k.label}</span>
                  <div className={`flex items-center justify-center h-9 w-9 rounded-xl ${k.gradient} shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                    <k.icon className="h-4 w-4 text-white" strokeWidth={2} />
                  </div>
                </div>
                <div className="font-mono text-[28px] font-bold leading-none tracking-tight tabular-nums text-foreground relative z-10">
                  <span className="text-muted-foreground/60 text-[16px] mr-1">PKR</span>
                  {fmtPkr(k.value)}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 relative z-10">
                  <span className="text-[11px] text-muted-foreground">{k.subtitle}</span>
                  {typeof k.trend === "number" && (
                    <span className={`inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded ${k.trend >= 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}`}>
                      {k.trend >= 0 ? <ArrowUpRight className="h-3 w-3" strokeWidth={2}/> : <ArrowDownRight className="h-3 w-3" strokeWidth={2}/>}
                      {k.trend >= 0 ? "+" : ""}{k.trend.toFixed(1)}%
                    </span>
                  )}
                </div>
                {k.sparkline && k.sparkline.length > 1 && (
                  <div className="h-10 -mx-1 mt-2 relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={k.sparkline.map((y, i) => ({ i, y }))}>
                        <defs>
                          <linearGradient id={`spark-${k.label}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="y" stroke="hsl(var(--primary))" strokeWidth={1.5} fill={`url(#spark-${k.label})`} isAnimationActive={false}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ─── COMMAND ROW ─── Vibrant gradient quick actions */}
        <section>
          <SectionHeader label="Quick Actions" right={
            <span className="text-[10px] font-mono text-muted-foreground/60">Press ⌘K for command palette</span>
          } />
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(a.path)}
                className="card-vibrant group flex flex-col items-center gap-2.5 py-4 px-2"
              >
                <div className={`flex items-center justify-center h-10 w-10 rounded-xl ${a.gradient} ${a.glow} group-hover:scale-110 transition-transform duration-200`}>
                  <a.icon className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-foreground/80 group-hover:text-foreground text-center leading-tight">
                  {a.label}
                </span>
              </button>
            ))}
          </div>
        </section>


        {/* ─── CHARTS ─── 30D trend (wide) + MoM bar */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel className="lg:col-span-2" padding="p-0">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div>
                <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Sales Trend — 30D</h3>
                <p className="font-mono text-[20px] font-light tracking-tight tabular-nums mt-1">
                  PKR {fmtPkr(dailySales.reduce((s, d) => s + d.amount, 0))}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Peak</span>
                <p className="font-mono text-[12px] tabular-nums">
                  PKR {fmtPkr(Math.max(0, ...dailySales.map(d => d.amount)))}
                </p>
              </div>
            </div>
            <div className="h-[180px] px-2 pb-3">
              {dailySales.length === 0 ? (
                <EmptyState icon={TrendingUp} title="No sales data" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySales} margin={{ top: 5, right: 12, left: 12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 4, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontFamily: "Geist Mono" }}
                      formatter={(v: number) => [`PKR ${fmtPkr(v)}`, "Sales"]}
                      cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={1.5} fill="url(#trendGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          <Panel padding="p-0">
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Month over Month</h3>
              <p className="font-mono text-[20px] font-light tracking-tight tabular-nums mt-1">
                {monthGrowth >= 0 ? "+" : ""}{monthGrowth.toFixed(1)}<span className="text-muted-foreground text-[14px]">%</span>
              </p>
            </div>
            <div className="h-[180px] px-2 pb-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: "Last", sales: lastMonthSales },
                  { name: "This", sales: monthSales },
                ]} margin={{ top: 5, right: 16, left: 16, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 4, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontFamily: "Geist Mono" }}
                    formatter={(v: number) => [`PKR ${fmtPkr(v)}`, "Sales"]}
                    cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                  />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} barSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </section>

        {/* ─── LEDGER ROW ─── Receivables/Payables + Expenses */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel>
            <SectionHeader label="Receivables · Payables" right={
              <button onClick={() => navigate("/payments")} className="text-[10px] font-mono text-primary hover:underline">
                View ledger →
              </button>
            } />
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-muted-foreground uppercase tracking-wider">Receivable</span>
                  <span className="font-mono tabular-nums text-foreground">PKR {fmtPkr(totalReceivables)}</span>
                </div>
                <div className="h-1 bg-muted rounded-sm overflow-hidden">
                  <div className="h-full bg-success" style={{ width: `${totalReceivables + totalPayables > 0 ? (totalReceivables / (totalReceivables + totalPayables)) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-muted-foreground uppercase tracking-wider">Payable</span>
                  <span className="font-mono tabular-nums text-foreground">PKR {fmtPkr(totalPayables)}</span>
                </div>
                <div className="h-1 bg-muted rounded-sm overflow-hidden">
                  <div className="h-full bg-danger" style={{ width: `${totalReceivables + totalPayables > 0 ? (totalPayables / (totalReceivables + totalPayables)) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="pt-3 border-t border-border flex justify-between items-center">
                <span className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">Net Position</span>
                <span className={`font-mono text-[16px] tabular-nums ${netPosition >= 0 ? "text-success" : "text-danger"}`}>
                  {netPosition >= 0 ? "+" : "−"}PKR {fmtPkr(Math.abs(netPosition))}
                </span>
              </div>
            </div>
          </Panel>

          <Panel>
            <SectionHeader label="Expense Breakdown — MTD" right={
              <button onClick={() => navigate("/expenses")} className="text-[10px] font-mono text-primary hover:underline">
                All expenses →
              </button>
            } />
            {expensesByCategory.length === 0 ? (
              <EmptyState icon={Receipt} title="No expenses recorded this month" />
            ) : (
              <div className="space-y-2">
                {(() => {
                  const total = expensesByCategory.reduce((s, e) => s + e.value, 0) || 1;
                  return expensesByCategory.slice(0, 6).map((cat) => {
                    const pct = (cat.value / total) * 100;
                    return (
                      <div key={cat.name}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="capitalize text-foreground/80">{cat.name}</span>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            PKR {fmtPkr(cat.value)} <span className="text-foreground/40 ml-1">{pct.toFixed(1)}%</span>
                          </span>
                        </div>
                        <div className="h-0.5 bg-muted rounded-sm overflow-hidden">
                          <div className="h-full bg-foreground/40" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </Panel>
        </section>

        {/* ─── TABLES ROW ─── Top customers + Top selling */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel padding="p-0">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
                <Users className="h-3 w-3" strokeWidth={1.5} /> Top Customers
              </h3>
            </div>
            {topCustomers.length === 0 ? (
              <div className="p-4"><EmptyState icon={Users} title="No customer data" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">MTD</TableHead>
                    <TableHead className="text-right">YTD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.slice(0, 5).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        <span className="text-muted-foreground/50 font-mono mr-2 text-[11px]">{String(i + 1).padStart(2, "0")}</span>
                        {c.name}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">PKR {fmtPkr(c.monthSale)}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">PKR {fmtPkr(c.yearlySale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>

          <Panel padding="p-0">
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
                <Flame className="h-3 w-3" strokeWidth={1.5} /> Top Selling Items — MTD
              </h3>
            </div>
            {topSelling.length === 0 ? (
              <div className="p-4"><EmptyState icon={Flame} title="No sales this month" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSelling.slice(0, 5).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-muted-foreground/50 text-[11px]">{String(i + 1).padStart(2, "0")}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{p.qty.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </section>

        {/* ─── STOCK INTAKE ─── */}
        <section>
          <Panel padding="p-0">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
                <PackageCheck className="h-3 w-3" strokeWidth={1.5} /> Recent Stock Intake
              </h3>
              <button onClick={() => navigate("/stock-movements")} className="text-[10px] font-mono text-primary hover:underline">
                Movements →
              </button>
            </div>
            {recentStock.length === 0 ? (
              <div className="p-4"><EmptyState icon={PackageCheck} title="No recent stock received" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right w-32">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentStock.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">+{s.quantity.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground text-[11px]">{formatDateDDMMMYYYY(s.date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </section>

        {/* ─── ALERTS ROW ─── Expiry + Reorder */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Panel padding="p-0">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" strokeWidth={1.5} /> Expiry Watch — 90D
              </h3>
              <div className="flex gap-1.5 text-[10px] font-mono">
                {expiryAlerts.critical > 0 && <StatusPill tone="danger">{expiryAlerts.critical} crit</StatusPill>}
                {expiryAlerts.warning > 0 && <StatusPill tone="warning">{expiryAlerts.warning} warn</StatusPill>}
                {expiryAlerts.info > 0 && <StatusPill tone="info">{expiryAlerts.info} soon</StatusPill>}
              </div>
            </div>
            {expiryAlerts.items.length === 0 ? (
              <div className="p-4"><EmptyState icon={Clock} title="Nothing expiring in 90 days" /></div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product · Batch</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right w-28">Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiryAlerts.items.slice(0, 6).map((item, i) => {
                      const tone =
                        item.severity === "expired" || item.severity === "critical" ? "danger" :
                        item.severity === "warning" ? "warning" : "info";
                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Dot tone={tone as any} />
                              <div>
                                <div className="font-medium text-[13px]">{item.name}</div>
                                <div className="font-mono text-[10.5px] text-muted-foreground">{item.batch}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{item.qty}</TableCell>
                          <TableCell className={`text-right font-mono text-[11px] tabular-nums ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-muted-foreground"}`}>
                            {item.severity === "expired" ? "EXPIRED" : formatDateDDMMMYYYY(item.expiry)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="border-t border-border px-4 py-2">
                  <button onClick={() => navigate("/reports/batch-wise")} className="text-[11px] font-mono text-primary hover:underline flex items-center gap-1">
                    Full batch report <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </div>
              </>
            )}
          </Panel>

          <Panel padding="p-0">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-3 w-3" strokeWidth={1.5} /> Smart Reorder
              </h3>
              <Button size="sm" variant="outline" onClick={generateReorderAlerts} disabled={loadingReorder} className="h-6 text-[10.5px] px-2">
                {loadingReorder ? "Analyzing…" : "Refresh"}
              </Button>
            </div>
            {reorderAlerts.length === 0 ? (
              <div className="p-4"><EmptyState icon={AlertTriangle} title="No reorder alerts" description="Click refresh to analyze consumption" /></div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right w-20">Runway</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reorderAlerts.map((a, i) => {
                      const tone = a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "info";
                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Dot tone={tone as any} />
                              <span className="font-medium">{a.product_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{a.current_stock}</TableCell>
                          <TableCell className={`text-right font-mono tabular-nums text-[11px] ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-muted-foreground"}`}>
                            {a.days_until_stockout}d
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {settings?.whatsapp_number && (
                  <div className="border-t border-border px-4 py-2">
                    <button onClick={generateReorderAlerts} className="text-[11px] font-mono text-success hover:underline inline-flex items-center gap-1.5">
                      <MessageCircle className="h-3 w-3" strokeWidth={1.5} /> Send WhatsApp alert
                    </button>
                  </div>
                )}
              </>
            )}
          </Panel>
        </section>

        {/* Dialogs */}
        <WeekSalesDialog open={weekOpen} onOpenChange={setWeekOpen} from={weekStartStr} to={todayStr} />
        <MonthSalesDialog open={monthOpen} onOpenChange={setMonthOpen} from={monthStartStr} to={todayStr} />
        <GrossMarginDialog open={gpOpen} onOpenChange={setGpOpen} monthStart={monthStartStr} monthEnd={todayStr} />
        <UpcomingOrdersDialog open={upcomingOpen} onOpenChange={setUpcomingOpen} />
      </div>
    </AppLayout>
  );
}
