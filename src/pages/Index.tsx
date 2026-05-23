import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileText, Shield, Wallet, Package, Printer, Receipt, CreditCard,
  Clock, AlertTriangle, MessageCircle, PackageCheck, Users, Flame,
  ChevronRight, ArrowUpRight, ArrowDownRight, TrendingUp,
} from "lucide-react";
import { WeekSalesDialog, MonthSalesDialog, GrossMarginDialog, UpcomingOrdersDialog } from "@/components/dashboard/KpiDialogs";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { formatDateDDMMMYYYY } from "@/lib/utils";

const fmtPkr = (n: number) =>
  new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(Math.round(n));
const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/* ─── tiny presentational helpers ─── */

const MicroLabel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`text-[10.5px] font-semibold uppercase tracking-[0.12em] text-subtle ${className}`}
    style={{ color: "hsl(var(--subtle))" }}>
    {children}
  </span>
);

const PanelHead = ({
  title, action,
}: { title: string; action?: React.ReactNode }) => (
  <div
    className="flex items-center justify-between px-4 h-10"
    style={{ borderBottom: "1px solid hsl(var(--border))" }}
  >
    <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: "hsl(var(--subtle))" }}>
      {title}
    </span>
    {action}
  </div>
);

const Delta = ({ value, suffix = "%" }: { value: number; suffix?: string }) => {
  const positive = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums"
      style={{ color: positive ? "hsl(var(--success))" : "hsl(var(--danger))" }}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" strokeWidth={1.75} />
                : <ArrowDownRight className="h-3 w-3" strokeWidth={1.75} />}
      {positive ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
};

const Dot = ({ tone }: { tone: "success" | "danger" | "warning" | "info" | "muted" }) => {
  const color =
    tone === "success" ? "hsl(var(--success))" :
    tone === "danger"  ? "hsl(var(--danger))"  :
    tone === "warning" ? "hsl(var(--warning))" :
    tone === "info"    ? "hsl(var(--info))"    :
                         "hsl(var(--subtle))";
  return <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />;
};

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

  const quickActions = [
    { label: "Sales Invoice", path: "/proforma", icon: FileText },
    { label: "Warranty Invoice", path: "/warranty-invoices", icon: Shield },
    { label: "Payment In", path: "/payments", icon: Wallet },
    { label: "Inventory", path: "/products", icon: Package },
    { label: "Purchase Order", path: "/purchase-proforma", icon: FileText },
    { label: "Print Jobs", path: "/print-jobs", icon: Printer },
    { label: "Expenses", path: "/expenses", icon: Receipt },
    { label: "Credit Notes", path: "/credit-notes", icon: CreditCard },
  ];

  const tickerCells: { label: string; value: React.ReactNode }[] = [
    { label: "MTD", value: (
      <span className="flex items-center gap-1.5">
        <span>PKR {fmtCompact(monthSales)}</span>
        {lastMonthSales > 0 && <Delta value={monthGrowth} />}
      </span>
    )},
    { label: "WTD", value: <>PKR {fmtCompact(weekSales)}</> },
    { label: "A/R", value: <>PKR {fmtCompact(totalReceivables)}</> },
    { label: "A/P", value: <>PKR {fmtCompact(totalPayables)}</> },
    { label: "NET", value: (
      <span style={{ color: netPosition >= 0 ? "hsl(var(--success))" : "hsl(var(--danger))" }}>
        {netPosition >= 0 ? "+" : "−"}PKR {fmtCompact(Math.abs(netPosition))}
      </span>
    )},
    { label: "PO OPEN", value: <>{upcomingPoCount}</> },
    { label: "EXP 90D", value: (
      <span style={{ color: expiryAlerts.critical > 0 ? "hsl(var(--danger))" : undefined }}>
        {expiryAlerts.critical + expiryAlerts.warning + expiryAlerts.info}
      </span>
    )},
  ];

  const kpis = [
    { label: "Week to Date", value: weekSales, footnote: "Mon → today", onClick: () => setWeekOpen(true), delta: null as number | null, active: weekOpen },
    { label: "Month to Date", value: monthSales, footnote: lastMonthSales > 0 ? `vs PKR ${fmtCompact(lastMonthSales)} last month` : "No prior month", onClick: () => setMonthOpen(true), delta: lastMonthSales > 0 ? monthGrowth : null, active: monthOpen },
    { label: "Gross Profit", value: Math.abs(grossMargin), footnote: "Revenue − COGS", onClick: () => setGpOpen(true), delta: monthSales > 0 ? gpMargin : null, active: gpOpen },
    { label: "Upcoming Orders", value: upcomingPoValue, footnote: upcomingPoCount > 0 ? `${upcomingPoCount} open PO${upcomingPoCount > 1 ? "s" : ""}` : "None pending", onClick: () => setUpcomingOpen(true), delta: null, active: upcomingOpen },
  ];

  return (
    <AppLayout
      title="Dashboard"
      subtitle={`${new Date().toLocaleDateString("en-GB", { weekday: "long" })} · ${formatDateDDMMMYYYY(today)}`}
    >
      <div className="space-y-6">

        {/* ─── TICKER STRIP ─── 36px, surface-2 well, divided cells */}
        <div className="well flex items-stretch h-9 overflow-x-auto">
          {tickerCells.map((c, i) => (
            <div
              key={c.label}
              className="flex items-center gap-2 px-4 whitespace-nowrap"
              style={i > 0 ? { borderLeft: "1px solid hsl(var(--border))" } : undefined}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "hsl(var(--subtle))" }}>
                {c.label}
              </span>
              <span className="font-mono text-[11.5px] tabular-nums text-foreground">
                {c.value}
              </span>
            </div>
          ))}
        </div>

        {/* ─── KPI ROW ─── four equal tiles, 112px tall */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <button
              key={k.label}
              onClick={k.onClick}
              data-active={k.active || undefined}
              className="kpi p-4 flex flex-col justify-between"
              style={{ minHeight: 112 }}
            >
              <MicroLabel>{k.label}</MicroLabel>
              <div className="font-mono text-[26px] leading-none tracking-[-0.02em] tabular-nums text-foreground">
                <span className="text-[14px] mr-1" style={{ color: "hsl(var(--muted-foreground))" }}>PKR</span>
                {fmtPkr(k.value)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11.5px]" style={{ color: "hsl(var(--muted-foreground))" }}>{k.footnote}</span>
                {k.delta !== null && <Delta value={k.delta} />}
              </div>
            </button>
          ))}
        </div>

        {/* ─── BODY ─── 8/4 split: trend + quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

          {/* Daily sales · 30D */}
          <div className="panel lg:col-span-8">
            <PanelHead
              title="Daily Sales · 30D"
              action={
                <span className="font-mono text-[11.5px] tabular-nums" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Σ PKR {fmtPkr(dailySales.reduce((s, d) => s + d.amount, 0))}
                </span>
              }
            />
            <div className="h-[200px] px-2 py-3">
              {dailySales.length === 0 ? (
                <EmptyState icon={TrendingUp} title="No sales data" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySales} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(var(--subtle))", fontFamily: "JetBrains Mono" }}
                      tickLine={false} axisLine={false} interval="preserveStartEnd"
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        fontSize: 11, borderRadius: 4, padding: "6px 10px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        boxShadow: "none",
                        fontFamily: "JetBrains Mono",
                      }}
                      labelStyle={{ color: "hsl(var(--subtle))", marginBottom: 2 }}
                      formatter={(v: number) => [`PKR ${fmtPkr(v)}`, "Sales"]}
                      cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "2 3" }}
                    />
                    <Area
                      type="monotone" dataKey="amount"
                      stroke="hsl(var(--primary))" strokeWidth={1.5}
                      fill="hsl(var(--primary))" fillOpacity={0.08}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="panel lg:col-span-4">
            <PanelHead
              title="Quick Actions"
              action={
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded border"
                  style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--subtle))" }}>
                  ⌘K
                </kbd>
              }
            />
            <ul>
              {quickActions.map((a, i) => (
                <li key={a.label}>
                  <button
                    onClick={() => navigate(a.path)}
                    className="group w-full flex items-center gap-3 h-9 px-4 text-left transition-colors duration-100 hover:bg-[hsl(var(--primary-soft))]"
                    style={i > 0 ? { borderTop: "1px solid hsl(var(--border))" } : undefined}
                  >
                    <a.icon className="h-3.5 w-3.5 shrink-0 transition-colors group-hover:text-primary"
                      strokeWidth={1.5}
                      style={{ color: "hsl(var(--muted-foreground))" }} />
                    <span className="text-[12.5px] flex-1 text-foreground group-hover:text-primary">
                      {a.label}
                    </span>
                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      strokeWidth={1.5}
                      style={{ color: "hsl(var(--primary))" }} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ─── BODY ROW 2 ─── ledger + top customers */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

          {/* Receivables / Payables */}
          <div className="panel lg:col-span-4">
            <PanelHead
              title="Receivable · Payable"
              action={
                <button onClick={() => navigate("/payments")}
                  className="text-[11px] font-mono hover:underline" style={{ color: "hsl(var(--primary))" }}>
                  Ledger →
                </button>
              }
            />
            <div className="p-4 space-y-4">
              <div>
                <div className="flex justify-between text-[11.5px] mb-1.5">
                  <MicroLabel>Receivable</MicroLabel>
                  <span className="font-mono tabular-nums text-foreground">PKR {fmtPkr(totalReceivables)}</span>
                </div>
                <div className="h-[3px]" style={{ background: "hsl(var(--surface-2))" }}>
                  <div className="h-full" style={{
                    width: `${totalReceivables + totalPayables > 0 ? (totalReceivables / (totalReceivables + totalPayables)) * 100 : 0}%`,
                    background: "hsl(var(--success))",
                  }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11.5px] mb-1.5">
                  <MicroLabel>Payable</MicroLabel>
                  <span className="font-mono tabular-nums text-foreground">PKR {fmtPkr(totalPayables)}</span>
                </div>
                <div className="h-[3px]" style={{ background: "hsl(var(--surface-2))" }}>
                  <div className="h-full" style={{
                    width: `${totalReceivables + totalPayables > 0 ? (totalPayables / (totalReceivables + totalPayables)) * 100 : 0}%`,
                    background: "hsl(var(--danger))",
                  }} />
                </div>
              </div>
              <div className="flex justify-between items-center pt-3"
                style={{ borderTop: "1px solid hsl(var(--border))" }}>
                <MicroLabel>Net Position</MicroLabel>
                <span className="font-mono text-[15px] tabular-nums"
                  style={{ color: netPosition >= 0 ? "hsl(var(--success))" : "hsl(var(--danger))" }}>
                  {netPosition >= 0 ? "+" : "−"}PKR {fmtPkr(Math.abs(netPosition))}
                </span>
              </div>
            </div>
          </div>

          {/* Top customers */}
          <div className="panel lg:col-span-4">
            <PanelHead
              title="Top Customers · MTD"
              action={<Users className="h-3 w-3" strokeWidth={1.5} style={{ color: "hsl(var(--subtle))" }} />}
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

          {/* Top selling */}
          <div className="panel lg:col-span-4">
            <PanelHead
              title="Top Selling · MTD"
              action={<Flame className="h-3 w-3" strokeWidth={1.5} style={{ color: "hsl(var(--subtle))" }} />}
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

        {/* ─── ALERTS ROW ─── expiry · reorder · recent intake */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

          {/* Expiry watch */}
          <div className="panel lg:col-span-5">
            <PanelHead
              title="Expiry Watch · 90D"
              action={
                <div className="flex gap-3 font-mono text-[10.5px] tabular-nums">
                  {expiryAlerts.critical > 0 && (
                    <span className="inline-flex items-center gap-1" style={{ color: "hsl(var(--danger))" }}>
                      <Dot tone="danger" />{expiryAlerts.critical}
                    </span>
                  )}
                  {expiryAlerts.warning > 0 && (
                    <span className="inline-flex items-center gap-1" style={{ color: "hsl(var(--warning))" }}>
                      <Dot tone="warning" />{expiryAlerts.warning}
                    </span>
                  )}
                  {expiryAlerts.info > 0 && (
                    <span className="inline-flex items-center gap-1" style={{ color: "hsl(var(--info))" }}>
                      <Dot tone="info" />{expiryAlerts.info}
                    </span>
                  )}
                </div>
              }
            />
            {expiryAlerts.items.length === 0 ? (
              <EmptyState icon={Clock} title="Nothing expiring in 90 days" />
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

          {/* Reorder */}
          <div className="panel lg:col-span-4">
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
                  <div className="px-4 py-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
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

          {/* Recent intake */}
          <div className="panel lg:col-span-3">
            <PanelHead
              title="Recent Intake"
              action={
                <button onClick={() => navigate("/stock")}
                  className="text-[11px] font-mono hover:underline" style={{ color: "hsl(var(--primary))" }}>
                  All →
                </button>
              }
            />
            {recentStock.length === 0 ? (
              <EmptyState icon={PackageCheck} title="No recent intake" />
            ) : (
              <ul>
                {recentStock.slice(0, 6).map((s, i) => (
                  <li key={i}
                    className="px-4 py-2.5 flex items-center justify-between gap-2"
                    style={i > 0 ? { borderTop: "1px solid hsl(var(--border))" } : undefined}>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium truncate">{s.name}</div>
                      <div className="font-mono text-[10.5px]" style={{ color: "hsl(var(--subtle))" }}>
                        {formatDateDDMMMYYYY(s.date)}
                      </div>
                    </div>
                    <span className="font-mono text-[12px] tabular-nums" style={{ color: "hsl(var(--success))" }}>
                      +{s.quantity.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Dialogs */}
        <WeekSalesDialog open={weekOpen} onOpenChange={setWeekOpen} from={weekStartStr} to={todayStr} />
        <MonthSalesDialog open={monthOpen} onOpenChange={setMonthOpen} from={monthStartStr} to={todayStr} />
        <GrossMarginDialog open={gpOpen} onOpenChange={setGpOpen} monthStart={monthStartStr} monthEnd={todayStr} />
        <UpcomingOrdersDialog open={upcomingOpen} onOpenChange={setUpcomingOpen} />
      </div>
    </AppLayout>
  );
}
