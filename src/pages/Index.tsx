import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileText, Shield, Wallet, Package, Receipt, CreditCard,
  AlertTriangle, MessageCircle, PackageCheck, Users, Flame,
  ChevronRight, TrendingUp, ShoppingBag, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { WeekSalesDialog, MonthSalesDialog, GrossMarginDialog, UpcomingOrdersDialog } from "@/components/dashboard/KpiDialogs";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { formatDateDDMMMYYYY } from "@/lib/utils";

const fmtPkr = (n: number) =>
  new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(Math.round(n));
const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/* ─── presentational primitives ─── */

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "hsl(var(--subtle))" }}>
    {children}
  </span>
);

const MicroLabel = ({ children, className = "", accent }: { children: React.ReactNode; className?: string; accent?: string }) => (
  <span className={`text-[10.5px] font-bold uppercase tracking-[0.15em] inline-flex items-center gap-2 ${className}`}
    style={{ color: "hsl(var(--subtle))" }}>
    {accent && <span className="h-1.5 w-1.5" style={{ background: accent }} />}
    {children}
  </span>
);

const PanelHead = ({ title, action, accent }: { title: string; action?: React.ReactNode; accent?: string }) => (
  <div className="flex items-center justify-between px-5 h-11 border-b" style={{ borderColor: "hsl(var(--border))" }}>
    <span className="font-heading text-[12.5px] font-semibold uppercase tracking-[0.15em] inline-flex items-center gap-2.5"
      style={{ color: "hsl(var(--foreground))" }}>
      {accent && <span className="h-2 w-2" style={{ background: accent }} />}
      {title}
    </span>
    {action}
  </div>
);

const Dot = ({ tone }: { tone: "success" | "danger" | "warning" | "info" | "muted" }) => {
  const color =
    tone === "success" ? "hsl(var(--success))" :
    tone === "danger"  ? "hsl(var(--danger))"  :
    tone === "warning" ? "hsl(var(--warning))" :
    tone === "info"    ? "hsl(var(--brand-blue))" :
                         "hsl(var(--subtle))";
  return <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />;
};

const greetingFor = (d: Date) => {
  const h = d.getHours();
  if (h < 5)  return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
};

const fiscalLabel = (d: Date) => {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()} Fiscal Period`;
};

export default function Index() {
  const navigate = useNavigate();
  const { settings } = useCompanySettings();
  const { user } = useAuth();

  const [weekSales, setWeekSales] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [grossMargin, setGrossMargin] = useState(0);
  const [recentStock, setRecentStock] = useState<{ name: string; quantity: number; date: string }[]>([]);
  const [topSelling, setTopSelling] = useState<{ name: string; qty: number }[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; monthSale: number; yearlySale: number }[]>([]);
  const [reorderAlerts, setReorderAlerts] = useState<any[]>([]);
  const [loadingReorder, setLoadingReorder] = useState(false);
  const [dailySales, setDailySales] = useState<{ date: string; amount: number }[]>([]);
  const [lastMonthSales, setLastMonthSales] = useState(0);
  const [upcomingPoCount, setUpcomingPoCount] = useState(0);
  const [upcomingPoValue, setUpcomingPoValue] = useState(0);
  const [totalReceivables, setTotalReceivables] = useState(0);
  const [totalPayables, setTotalPayables] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [todayCollections, setTodayCollections] = useState(0);

  const today = new Date();

  const [weekOpen, setWeekOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [gpOpen, setGpOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  const [expiryAlerts, setExpiryAlerts] = useState<{ critical: number; warning: number; info: number; items: { name: string; batch: string; expiry: string; qty: number; severity: string }[] }>({ critical: 0, warning: 0, info: 0, items: [] });

  useEffect(() => { loadDashboard(); loadReorderAlerts(); loadExpiryAlerts(); loadToday(); }, []);

  const loadToday = async () => {
    const t = new Date().toISOString().split("T")[0];
    const [{ data: invs }, { data: pays }] = await Promise.all([
      supabase.from("sales_invoices").select("total").eq("date", t),
      supabase.from("payments").select("amount").eq("date", t).eq("type", "received"),
    ]);
    setTodaySales((invs || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0));
    setTodayCollections((pays || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0));
  };

  const loadDashboard = async () => {
    const t = new Date();
    const tStr = t.toISOString().split("T")[0];
    const monthStart = tStr.slice(0, 7) + "-01";
    const yearStart = tStr.slice(0, 4) + "-01-01";
    const dayOfWeek = t.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const wStart = new Date(t); wStart.setDate(t.getDate() - mondayOffset);
    const wStartStr = wStart.toISOString().split("T")[0];
    const lastMonthEnd = new Date(t.getFullYear(), t.getMonth(), 0);
    const lastMonthStart = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    const thirtyDaysAgo = new Date(t); thirtyDaysAgo.setDate(t.getDate() - 29);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const [{ data: kpis }, { data: charts }] = await Promise.all([
      supabase.rpc("dashboard_kpis", {
        p_week_start: wStartStr, p_month_start: monthStart, p_year_start: yearStart,
        p_last_month_start: lastMonthStart.toISOString().split("T")[0],
        p_last_month_end: lastMonthEnd.toISOString().split("T")[0],
        p_today: tStr,
      }),
      supabase.rpc("dashboard_charts", {
        p_month_start: monthStart, p_year_start: yearStart,
        p_trend_start: thirtyDaysAgoStr, p_today: tStr,
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
    for (let d = new Date(thirtyDaysAgo); d <= t; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split("T")[0];
      dailyArr.push({ date: ds.slice(5), amount: dailyMap[ds] || 0 });
    }
    setDailySales(dailyArr);
    setTopSelling((c.top_products || []).map((p: any) => ({ name: p.name, qty: Number(p.qty) })));
    setTopCustomers((c.top_customers || []).map((cu: any) => ({ name: cu.name, monthSale: Number(cu.monthSale), yearlySale: Number(cu.yearlySale) })));
    setRecentStock((c.recent_stock || []).map((s: any) => ({ name: s.name, quantity: Number(s.quantity), date: s.date })));
  };

  const loadReorderAlerts = async () => {
    const { data } = await supabase.from("reorder_alerts").select("*").order("days_until_stockout", { ascending: true }).limit(5);
    if (data) setReorderAlerts(data as any);
  };

  const loadExpiryAlerts = async () => {
    const t = new Date();
    const ninety = new Date(t); ninety.setDate(t.getDate() + 90);
    const { data: grnItems } = await supabase
      .from("grn_items")
      .select("product_id, batch_number, expiry_date, quantity_received")
      .not("expiry_date", "is", null)
      .lte("expiry_date", ninety.toISOString().split("T")[0]);
    const { data: prods } = await supabase.from("products").select("id, name");
    if (!grnItems || !prods) return;
    const prodMap = new Map(prods.map((p: any) => [p.id, p.name]));
    let critical = 0, warning = 0, info = 0;
    const items: { name: string; batch: string; expiry: string; qty: number; severity: string }[] = [];
    grnItems.forEach((g: any) => {
      if (!g.expiry_date) return;
      const diff = (new Date(g.expiry_date).getTime() - t.getTime()) / (1000 * 60 * 60 * 24);
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
  const gpMargin = monthSales > 0 ? (grossMargin / monthSales) * 100 : 0;
  const netPosition = totalReceivables - totalPayables;

  const firstName = (() => {
    const raw = (user?.email || "").split("@")[0] || "there";
    const cleaned = raw.replace(/[._-]+/g, " ").trim().split(" ")[0] || "there";
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  })();

  const quickActions = [
    { label: "New Sales Invoice",    path: "/proforma",          icon: FileText },
    { label: "Purchase Order",       path: "/purchase-proforma", icon: ShoppingBag },
    { label: "Record Payment",       path: "/payments",          icon: Wallet },
    { label: "Warranty Invoice",     path: "/warranty-invoices", icon: Shield },
    { label: "Inventory",            path: "/products",          icon: Package },
    { label: "Expense Entry",        path: "/expenses",          icon: Receipt },
    { label: "Credit Note",          path: "/credit-notes",      icon: CreditCard },
  ];

  // KPI tiles — 4 primary metrics, MOUJ navy text, JetBrains Mono numbers
  const kpis = [
    {
      label: "Month-to-Date Sales",
      value: monthSales,
      footnote: lastMonthSales > 0 ? `vs PKR ${fmtCompact(lastMonthSales)} last month` : "No prior month",
      onClick: () => setMonthOpen(true),
      delta: lastMonthSales > 0 ? monthGrowth : null,
      active: monthOpen,
      isPrimary: true,
      rail: "hsl(var(--brand-blue))",
      icon: TrendingUp,
    },
    {
      label: "Receivables",
      value: totalReceivables,
      footnote: totalReceivables > 0 ? "Outstanding from customers" : "Nothing outstanding",
      onClick: () => navigate("/payments?tab=received"),
      delta: null as number | null,
      active: false,
      rail: "hsl(var(--success))",
      icon: Wallet,
    },
    {
      label: "Payables",
      value: totalPayables,
      footnote: totalPayables > 0 ? "Due to suppliers" : "Nothing due",
      onClick: () => navigate("/payments?tab=made"),
      delta: null,
      active: false,
      rail: "hsl(var(--warning))",
      icon: CreditCard,
    },
    {
      label: "Gross Profit · MTD",
      value: Math.abs(grossMargin),
      footnote: monthSales > 0 ? `${gpMargin.toFixed(1)}% margin` : "Revenue − COGS",
      onClick: () => setGpOpen(true),
      delta: null,
      active: gpOpen,
      rail: "hsl(var(--info))",
      icon: Flame,
    },
  ];

  // Glance strip items
  const todayInvoices = todaySales > 0 ? 1 : 0; // placeholder; we only have totals
  const overdueCount = reorderAlerts.filter(a => a.severity === "critical").length;
  const expiringCount = expiryAlerts.critical;

  return (
    <AppLayout title="" >
      <div className="space-y-8 -mt-6">

        {/* ─── HERO ─── eyebrow + greeting + date */}
        <header className="flex items-end justify-between gap-6 flex-wrap pb-2">
          <div className="flex gap-4">
            <div className="w-[2px] mt-2 mb-1 self-stretch" style={{ background: "hsl(var(--brand-blue))" }} />
            <div>
              <div className="mb-3"><Eyebrow>Overview Dashboard</Eyebrow></div>
              <h1 className="font-heading text-[40px] sm:text-[44px] leading-[1.05] font-semibold tracking-[-0.025em]"
                style={{ color: "hsl(var(--brand-navy))" }}>
                {greetingFor(today)}, {firstName}.
              </h1>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] font-medium" style={{ color: "hsl(var(--brand-navy))" }}>
              {today.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long" })}
            </div>
            <div className="text-[11.5px] mt-0.5" style={{ color: "hsl(var(--subtle))" }}>
              {fiscalLabel(today)}
            </div>
          </div>
        </header>

        {/* ─── GLANCE STRIP ─── hairline top + bottom, colored signal dots */}
        <div className="flex items-center gap-7 py-5 flex-wrap"
          style={{ borderTop: "1px solid hsl(var(--border))", borderBottom: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center gap-2.5">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "hsl(var(--brand-blue) / 0.5)" }} />
              <span className="relative inline-block h-2 w-2 rounded-full" style={{ background: "hsl(var(--brand-blue))" }} />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "hsl(var(--brand-blue))" }}>Live</span>
            <span className="text-[13.5px] font-semibold" style={{ color: "hsl(var(--brand-navy))" }}>
              PKR <span className="font-mono tabular-nums" style={{ color: "hsl(var(--brand-blue))" }}>{fmtCompact(todaySales)}</span>
              <span className="ml-1" style={{ color: "hsl(var(--subtle))" }}>sold today</span>
            </span>
          </div>
          <Dot tone="success" />
          <div className="text-[13.5px] font-semibold" style={{ color: "hsl(var(--brand-navy))" }}>
            PKR <span className="font-mono tabular-nums" style={{ color: "hsl(var(--success))" }}>{fmtCompact(todayCollections)}</span>
            <span className="ml-1" style={{ color: "hsl(var(--subtle))" }}>collected</span>
          </div>
          <Dot tone="info" />
          <div className="text-[13.5px] font-semibold" style={{ color: "hsl(var(--brand-navy))" }}>
            <span className="font-mono tabular-nums" style={{ color: "hsl(var(--info))" }}>{upcomingPoCount}</span>
            <span className="ml-1.5" style={{ color: "hsl(var(--subtle))" }}>open PO{upcomingPoCount === 1 ? "" : "s"}</span>
          </div>
          {(overdueCount > 0 || expiringCount > 0) && (
            <>
              <Dot tone="danger" />
              <div className="text-[13.5px] font-semibold" style={{ color: "hsl(var(--danger))" }}>
                <span className="font-mono tabular-nums">{overdueCount + expiringCount}</span>
                <span className="ml-1.5 font-medium">need attention</span>
              </div>
            </>
          )}
        </div>

        {/* ─── KPI GRID ─── hairline grid effect via 1px gap on navy/10 background */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px"
          style={{ background: "hsl(var(--border))", border: "1px solid hsl(var(--border))" }}>
          {kpis.map((k) => (
            <button
              key={k.label}
              onClick={k.onClick}
              data-active={k.active || undefined}
              className="group relative text-left px-6 py-7 transition-colors duration-150"
              style={{ background: "hsl(var(--card))" }}
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <MicroLabel>{k.label}</MicroLabel>
                {k.icon && (
                  <span className="inline-flex items-center justify-center h-6 w-6 shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${k.rail} 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${k.rail} 35%, transparent)`,
                    }}>
                    <k.icon className="h-3 w-3" strokeWidth={1.75} style={{ color: k.rail }} />
                  </span>
                )}
              </div>
              <div className="font-mono text-[26px] leading-none tabular-nums font-medium"
                style={{ color: "hsl(var(--brand-navy))" }}>
                <span className="text-[13px] mr-1.5 align-baseline" style={{ color: "hsl(var(--muted-foreground))" }}>PKR</span>
                {fmtPkr(k.value)}
              </div>
              <div className="mt-3 flex items-center gap-2">
                {k.delta !== null && (
                  <span className="inline-flex items-center gap-0.5 font-mono text-[11px] font-bold"
                    style={{ color: k.delta >= 0 ? "hsl(var(--success))" : "hsl(var(--danger))" }}>
                    {k.delta >= 0 ? <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                                  : <ArrowDownRight className="h-3 w-3" strokeWidth={2} />}
                    {k.delta >= 0 ? "+" : ""}{k.delta.toFixed(1)}%
                  </span>
                )}
                <span className="text-[11px] font-medium" style={{ color: "hsl(var(--subtle))" }}>
                  {k.footnote}
                </span>
              </div>
              {/* 2px colored accent rail per metric */}
              <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: k.rail }} />
            </button>
          ))}
        </div>

        {/* ─── TREND + SIDEBAR ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* 30-Day trend — col-8 */}
          <div className="lg:col-span-8">
            <div className="flex items-end justify-between mb-7">
              <div>
                <h2 className="font-heading text-[18px] font-semibold tracking-[-0.015em]"
                  style={{ color: "hsl(var(--brand-navy))" }}>
                  30-Day Performance Trend
                </h2>
                <p className="text-[11.5px] mt-1" style={{ color: "hsl(var(--subtle))" }}>
                  Daily revenue · today highlighted
                </p>
              </div>
              <div className="font-mono text-[12px] tabular-nums" style={{ color: "hsl(var(--muted-foreground))" }}>
                Σ PKR {fmtPkr(dailySales.reduce((s, d) => s + d.amount, 0))}
              </div>
            </div>

            <div className="h-[260px]" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
              {dailySales.length === 0 ? (
                <EmptyState icon={TrendingUp} title="No sales data" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailySales} margin={{ top: 8, right: 0, left: 0, bottom: 4 }} barCategoryGap={4}>
                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date" hide
                    />
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
                      {(() => {
                        const max = Math.max(...dailySales.map(d => d.amount));
                        return dailySales.map((d, i) => {
                          const isToday = i === dailySales.length - 1;
                          const isPeak = !isToday && d.amount === max && max > 0;
                          const fill = isToday
                            ? "hsl(var(--brand-blue))"
                            : isPeak
                              ? "hsl(var(--success) / 0.55)"
                              : "hsl(var(--brand-navy) / 0.12)";
                          return <Cell key={i} fill={fill} />;
                        });
                      })()}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex justify-between mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.15em]"
              style={{ color: "hsl(var(--subtle))" }}>
              <span>{dailySales[0]?.date ?? "—"}</span>
              <span>{dailySales[Math.floor(dailySales.length / 2)]?.date ?? "—"}</span>
              <span>Today</span>
            </div>
          </div>

          {/* Sidebar — col-4 */}
          <div className="lg:col-span-4 space-y-8">
            {/* Quick actions */}
            <div>
              <div className="mb-5"><MicroLabel>Quick Actions</MicroLabel></div>
              <div className="space-y-2">
                {quickActions.slice(0, 4).map((a) => (
                  <button
                    key={a.label}
                    onClick={() => navigate(a.path)}
                    className="group w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] font-semibold transition-colors duration-150"
                    style={{
                      border: "1px solid hsl(var(--border))",
                      color: "hsl(var(--brand-navy))",
                      background: "hsl(var(--card))",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "hsl(var(--brand-blue))")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "hsl(var(--border))")}
                  >
                    <a.icon className="h-3.5 w-3.5" strokeWidth={1.75} style={{ color: "hsl(var(--brand-blue))" }} />
                    <span className="flex-1">{a.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      strokeWidth={1.75} style={{ color: "hsl(var(--brand-blue))" }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            <div>
              <div className="mb-5"><MicroLabel>Recent Activity</MicroLabel></div>
              {recentStock.length === 0 ? (
                <p className="text-[12px]" style={{ color: "hsl(var(--subtle))" }}>
                  No recent intake to show.
                </p>
              ) : (
                <ul className="space-y-4">
                  {recentStock.slice(0, 5).map((s, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className="inline-block h-1.5 w-1.5 rounded-full mt-1.5 shrink-0"
                        style={{ background: i === 0 ? "hsl(var(--brand-blue))" : "hsl(var(--border-strong))" }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-semibold truncate" style={{ color: "hsl(var(--brand-navy))" }}>
                          {s.name}
                        </div>
                        <div className="text-[10.5px] font-medium mt-0.5" style={{ color: "hsl(var(--subtle))" }}>
                          {s.quantity.toLocaleString()} units · {formatDateDDMMMYYYY(s.date)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ─── BUSINESS PANELS ─── top customers · top selling · receivable/payable */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          <div className="lg:col-span-4 border" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
            <PanelHead
              title="Receivable · Payable"
              action={
                <button onClick={() => navigate("/payments")}
                  className="text-[11px] font-bold uppercase tracking-[0.12em] hover:opacity-80"
                  style={{ color: "hsl(var(--brand-blue))" }}>
                  Ledger →
                </button>
              }
            />
            <div className="p-5 space-y-5">
              <div>
                <div className="flex justify-between text-[11.5px] mb-2">
                  <MicroLabel>Receivable</MicroLabel>
                  <span className="font-mono tabular-nums font-medium" style={{ color: "hsl(var(--brand-navy))" }}>
                    PKR {fmtPkr(totalReceivables)}
                  </span>
                </div>
                <div className="h-[3px]" style={{ background: "hsl(var(--border))" }}>
                  <div className="h-full" style={{
                    width: `${totalReceivables + totalPayables > 0 ? (totalReceivables / (totalReceivables + totalPayables)) * 100 : 0}%`,
                    background: "hsl(var(--brand-blue))",
                  }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11.5px] mb-2">
                  <MicroLabel>Payable</MicroLabel>
                  <span className="font-mono tabular-nums font-medium" style={{ color: "hsl(var(--brand-navy))" }}>
                    PKR {fmtPkr(totalPayables)}
                  </span>
                </div>
                <div className="h-[3px]" style={{ background: "hsl(var(--border))" }}>
                  <div className="h-full" style={{
                    width: `${totalReceivables + totalPayables > 0 ? (totalPayables / (totalReceivables + totalPayables)) * 100 : 0}%`,
                    background: "hsl(var(--brand-navy))",
                  }} />
                </div>
              </div>
              <div className="flex justify-between items-center pt-4"
                style={{ borderTop: "1px solid hsl(var(--border))" }}>
                <MicroLabel>Net Position</MicroLabel>
                <span className="font-mono text-[16px] tabular-nums font-medium"
                  style={{ color: netPosition >= 0 ? "hsl(var(--brand-blue))" : "hsl(var(--danger))" }}>
                  {netPosition >= 0 ? "+" : "−"}PKR {fmtPkr(Math.abs(netPosition))}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 border" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
            <PanelHead
              title="Top Customers · MTD"
              action={<Users className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: "hsl(var(--subtle))" }} />}
            />
            {topCustomers.length === 0 ? (
              <EmptyState icon={Users} title="No customer data" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">MTD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.slice(0, 5).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        <span className="font-mono mr-2 text-[11px]" style={{ color: "hsl(var(--subtle))" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {c.name}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">PKR {fmtPkr(c.monthSale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="lg:col-span-4 border" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
            <PanelHead
              title="Top Selling · MTD"
              action={<Flame className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: "hsl(var(--subtle))" }} />}
            />
            {topSelling.length === 0 ? (
              <EmptyState icon={Flame} title="No sales this month" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topSelling.slice(0, 5).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">
                        <span className="font-mono mr-2 text-[11px]" style={{ color: "hsl(var(--subtle))" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {p.name}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{p.qty.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* ─── OPERATIONAL ALERTS ─── expiry · reorder */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          <div className="lg:col-span-7 border" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
            <PanelHead
              title="Expiry Watch · 90D"
              action={
                <div className="flex gap-3 font-mono text-[10.5px] tabular-nums">
                  {expiryAlerts.critical > 0 && (
                    <span className="inline-flex items-center gap-1.5" style={{ color: "hsl(var(--danger))" }}>
                      <Dot tone="danger" />{expiryAlerts.critical}
                    </span>
                  )}
                  {expiryAlerts.warning > 0 && (
                    <span className="inline-flex items-center gap-1.5" style={{ color: "hsl(var(--warning))" }}>
                      <Dot tone="warning" />{expiryAlerts.warning}
                    </span>
                  )}
                  {expiryAlerts.info > 0 && (
                    <span className="inline-flex items-center gap-1.5" style={{ color: "hsl(var(--brand-blue))" }}>
                      <Dot tone="info" />{expiryAlerts.info}
                    </span>
                  )}
                </div>
              }
            />
            {expiryAlerts.items.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-[13px]" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Nothing expiring in the next 90 days.
                </p>
              </div>
            ) : (
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
                    const tone = item.severity === "expired" || item.severity === "critical" ? "danger"
                              : item.severity === "warning" ? "warning" : "info";
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Dot tone={tone} />
                            <div>
                              <div className="font-medium text-[12.5px]">{item.name}</div>
                              <div className="font-mono text-[10.5px]" style={{ color: "hsl(var(--subtle))" }}>
                                {item.batch}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{item.qty}</TableCell>
                        <TableCell className="text-right font-mono text-[11px] tabular-nums"
                          style={{
                            color: tone === "danger" ? "hsl(var(--danger))"
                                 : tone === "warning" ? "hsl(var(--warning))"
                                 : "hsl(var(--muted-foreground))",
                          }}>
                          {item.severity === "expired" ? "EXPIRED" : formatDateDDMMMYYYY(item.expiry)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="lg:col-span-5 border" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
            <PanelHead
              title="Smart Reorder"
              action={
                <Button size="sm" variant="outline" onClick={generateReorderAlerts} disabled={loadingReorder}
                  className="h-6 text-[10.5px] px-2">
                  {loadingReorder ? "Analyzing…" : "Refresh"}
                </Button>
              }
            />
            {reorderAlerts.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="No reorder alerts"
                description="Click refresh to analyze consumption"
              />
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
                              <Dot tone={tone} />
                              <span className="font-medium">{a.product_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">{a.current_stock}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-[11px]"
                            style={{
                              color: tone === "danger" ? "hsl(var(--danger))"
                                   : tone === "warning" ? "hsl(var(--warning))"
                                   : "hsl(var(--muted-foreground))",
                            }}>
                            {a.days_until_stockout}d
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {settings?.whatsapp_number && (
                  <div className="px-5 py-2.5" style={{ borderTop: "1px solid hsl(var(--border))" }}>
                    <button onClick={generateReorderAlerts}
                      className="text-[11px] font-mono inline-flex items-center gap-1.5 hover:underline"
                      style={{ color: "hsl(var(--success))" }}>
                      <MessageCircle className="h-3 w-3" strokeWidth={1.5} /> Send WhatsApp alert
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      {/* KPI drill-downs */}
      {(() => {
        const tStr = today.toISOString().split("T")[0];
        const monthStart = tStr.slice(0, 7) + "-01";
        const dow = today.getDay();
        const wStart = new Date(today); wStart.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
        return (
          <>
            <WeekSalesDialog open={weekOpen} onOpenChange={setWeekOpen} from={wStart.toISOString().split("T")[0]} to={tStr} />
            <MonthSalesDialog open={monthOpen} onOpenChange={setMonthOpen} from={monthStart} to={tStr} />
            <GrossMarginDialog open={gpOpen} onOpenChange={setGpOpen} monthStart={monthStart} monthEnd={tStr} />
          </>
        );
      })()}
      <UpcomingOrdersDialog open={upcomingOpen} onOpenChange={setUpcomingOpen} />
    </AppLayout>
  );
}
