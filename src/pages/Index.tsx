import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp, TrendingDown, CalendarDays, ShoppingCart,
  FileText, CreditCard, Shield, Wallet,
  PackageCheck, Flame, Users, AlertTriangle, MessageCircle, Brain,
  Package, Printer, Receipt, Landmark, ArrowRightLeft, RotateCcw,
  CircleDollarSign, Clock, Sparkles,
} from "lucide-react";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { toast } from "sonner";
import { TrialBanner } from "@/components/TrialBanner";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid,
} from "recharts";

const CHART_COLORS = [
  "hsl(199, 89%, 48%)", // primary teal
  "hsl(263, 70%, 50%)", // violet
  "hsl(160, 84%, 39%)", // sage/success
  "hsl(0, 72%, 51%)",   // destructive
  "hsl(45, 93%, 47%)",  // amber
  "hsl(210, 40%, 60%)", // steel
];

// Animated counter component
function AnimatedCounter({ value, prefix = "", suffix = "", duration = 800 }: { value: number; prefix?: string; suffix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    if (start === end) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    prevValue.current = end;
  }, [value, duration]);

  return <>{prefix}{display.toLocaleString()}{suffix}</>;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

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
  const [overdueCount, setOverdueCount] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);
  const [totalReceivables, setTotalReceivables] = useState(0);
  const [totalPayables, setTotalPayables] = useState(0);

  // Expiry alerts
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

    const [weekInv, monthInv, yearInv, recentMovements, products, customers, trendInv, lastMonthInv, expenses, overdueInv, custBalances, suppBalances] = await Promise.all([
      supabase.from("sales_invoices").select("subtotal").gte("date", weekStartStr).lte("date", todayStr),
      supabase.from("sales_invoices").select("subtotal, customer_id").gte("date", monthStart).lte("date", todayStr),
      supabase.from("sales_invoices").select("subtotal, customer_id").gte("date", yearStart).lte("date", todayStr),
      supabase.from("stock_movements").select("product_id, quantity, date").eq("movement_type", "purchase_in").order("created_at", { ascending: false }).limit(5),
      supabase.from("products").select("id, name, cost_price"),
      supabase.from("customers").select("id, name, balance"),
      supabase.from("sales_invoices").select("date, subtotal").gte("date", thirtyDaysAgoStr).lte("date", todayStr),
      supabase.from("sales_invoices").select("subtotal").gte("date", lastMonthStartStr).lte("date", lastMonthEndStr),
      supabase.from("expenses").select("category, amount").eq("expense_type", "business").gte("date", monthStart).lte("date", todayStr),
      supabase.from("sales_invoices").select("total, due_date, status").in("status", ["dispatched", "partial"]).lt("due_date", todayStr),
      supabase.from("customers").select("balance"),
      supabase.from("suppliers").select("balance"),
    ]);

    const prodMap: Record<string, { name: string; cost: number }> = {};
    (products.data || []).forEach(p => { prodMap[p.id] = { name: p.name, cost: Number(p.cost_price) }; });
    const custMap: Record<string, string> = {};
    (customers.data || []).forEach(c => { custMap[c.id] = c.name; });

    const ws = (weekInv.data || []).reduce((s, i) => s + Number(i.subtotal), 0);
    const ms = (monthInv.data || []).reduce((s, i) => s + Number(i.subtotal), 0);
    setWeekSales(ws);
    setMonthSales(ms);

    setLastMonthSales((lastMonthInv.data || []).reduce((s, i) => s + Number(i.subtotal), 0));

    const dailyMap: Record<string, number> = {};
    (trendInv.data || []).forEach(inv => {
      dailyMap[inv.date] = (dailyMap[inv.date] || 0) + Number(inv.subtotal);
    });
    const dailyArr: { date: string; amount: number }[] = [];
    for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split("T")[0];
      dailyArr.push({ date: ds.slice(5), amount: dailyMap[ds] || 0 });
    }
    setDailySales(dailyArr);

    const catMap: Record<string, number> = {};
    (expenses.data || []).forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount); });
    setExpensesByCategory(
      Object.entries(catMap)
        .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
    );

    const od = overdueInv.data || [];
    setOverdueCount(od.length);
    setOverdueAmount(od.reduce((s, i) => s + Number(i.total), 0));

    setTotalReceivables((custBalances.data || []).reduce((s, c) => s + Math.max(Number(c.balance), 0), 0));
    setTotalPayables((suppBalances.data || []).reduce((s, s2) => s + Math.max(Number(s2.balance), 0), 0));

    const { data: monthInvIds } = await supabase.from("sales_invoices").select("id").gte("date", monthStart).lte("date", todayStr);
    const allMonthIds = (monthInvIds || []).map(inv => inv.id);

    let monthItemsData: any[] = [];
    for (let i = 0; i < allMonthIds.length; i += 50) {
      const batch = allMonthIds.slice(i, i + 50);
      const { data } = await supabase.from("sales_invoice_items").select("product_id, quantity, amount, invoice_id, rate").in("invoice_id", batch);
      monthItemsData = monthItemsData.concat(data || []);
    }

    let totalCost = 0;
    const prodQtyMonth: Record<string, number> = {};
    monthItemsData.forEach(item => {
      if (item.product_id) {
        const cost = prodMap[item.product_id]?.cost || 0;
        totalCost += Number(item.quantity) * cost;
        prodQtyMonth[item.product_id] = (prodQtyMonth[item.product_id] || 0) + Number(item.quantity);
      }
    });
    setGrossMargin(ms - totalCost);

    const topSell = Object.entries(prodQtyMonth)
      .map(([id, qty]) => ({ name: prodMap[id]?.name || "Unknown", qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    setTopSelling(topSell);

    const rs = (recentMovements.data || []).map(m => ({
      name: prodMap[m.product_id]?.name || "Unknown",
      quantity: Number(m.quantity),
      date: m.date,
    }));
    setRecentStock(rs);

    const monthCust: Record<string, number> = {};
    (monthInv.data || []).forEach(inv => {
      if (inv.customer_id) monthCust[inv.customer_id] = (monthCust[inv.customer_id] || 0) + Number(inv.subtotal);
    });
    const yearCust: Record<string, number> = {};
    (yearInv.data || []).forEach(inv => {
      if (inv.customer_id) yearCust[inv.customer_id] = (yearCust[inv.customer_id] || 0) + Number(inv.subtotal);
    });
    const allCustIds = new Set([...Object.keys(monthCust), ...Object.keys(yearCust)]);
    const tc = Array.from(allCustIds)
      .map(id => ({ name: custMap[id] || "Unknown", monthSale: monthCust[id] || 0, yearlySale: yearCust[id] || 0 }))
      .sort((a, b) => b.yearlySale - a.yearlySale)
      .slice(0, 8);
    setTopCustomers(tc);
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
        if (data.whatsapp_url) {
          window.open(data.whatsapp_url, "_blank");
        }
      }
    } catch (e: any) {
      toast.error("Failed to generate alerts: " + (e.message || "Unknown error"));
    }
    setLoadingReorder(false);
  };

  const monthGrowth = lastMonthSales > 0 ? ((monthSales - lastMonthSales) / lastMonthSales) * 100 : 0;

  const quickActions = [
    { label: "Sales Invoice", path: "/proforma", icon: FileText, gradient: "from-indigo-500/8 to-indigo-600/18", iconBg: "from-indigo-500 to-indigo-600", accent: "from-indigo-500 to-indigo-400", shadow: "shadow-indigo-500/20" },
    { label: "Warranty Invoice", path: "/warranty-invoices", icon: Shield, gradient: "from-violet-500/8 to-violet-600/18", iconBg: "from-violet-500 to-violet-600", accent: "from-violet-500 to-violet-400", shadow: "shadow-violet-500/20" },
    { label: "Payment In", path: "/payments", icon: Wallet, gradient: "from-cyan-500/8 to-teal-600/18", iconBg: "from-cyan-500 to-teal-600", accent: "from-cyan-500 to-teal-400", shadow: "shadow-cyan-500/20" },
    { label: "Inventory", path: "/products", icon: Package, gradient: "from-amber-500/8 to-orange-600/18", iconBg: "from-amber-500 to-orange-600", accent: "from-amber-500 to-orange-400", shadow: "shadow-amber-500/20" },
    { label: "Purchase Order", path: "/purchase-proforma", icon: FileText, gradient: "from-emerald-500/8 to-emerald-600/18", iconBg: "from-emerald-500 to-emerald-600", accent: "from-emerald-500 to-emerald-400", shadow: "shadow-emerald-500/20" },
    { label: "Print Jobs", path: "/print-jobs", icon: Printer, gradient: "from-fuchsia-500/8 to-purple-600/18", iconBg: "from-fuchsia-500 to-purple-600", accent: "from-fuchsia-500 to-purple-400", shadow: "shadow-fuchsia-500/20" },
    { label: "Expenses", path: "/expenses", icon: Receipt, gradient: "from-rose-500/8 to-rose-600/18", iconBg: "from-rose-500 to-rose-600", accent: "from-rose-500 to-rose-400", shadow: "shadow-rose-500/20" },
    { label: "Credit Notes", path: "/credit-notes", icon: CreditCard, gradient: "from-slate-500/8 to-slate-600/18", iconBg: "from-slate-500 to-slate-600", accent: "from-slate-500 to-slate-400", shadow: "shadow-slate-500/20" },
  ];

  const rpData = [
    { name: "Receivables", value: totalReceivables },
    { name: "Payables", value: totalPayables },
  ];

  const kpiCards = [
    {
      label: "This Week",
      value: weekSales,
      icon: TrendingUp,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
      glowColor: "shadow-[0_0_20px_hsl(199,89%,48%,0.12)]",
    },
    {
      label: "This Month",
      value: monthSales,
      icon: CalendarDays,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-500/10",
      glowColor: "shadow-[0_0_20px_hsl(160,84%,39%,0.12)]",
      extra: lastMonthSales > 0 ? (
        <p className={`text-[10px] mt-1 font-mono flex items-center gap-1 ${monthGrowth >= 0 ? "text-emerald-600" : "text-destructive"}`}>
          {monthGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {monthGrowth >= 0 ? "+" : ""}{monthGrowth.toFixed(1)}% vs last month
        </p>
      ) : null,
    },
    {
      label: "Gross Margin",
      value: Math.abs(grossMargin),
      icon: CircleDollarSign,
      iconColor: grossMargin >= 0 ? "text-primary" : "text-destructive",
      iconBg: grossMargin >= 0 ? "bg-primary/10" : "bg-destructive/10",
      glowColor: grossMargin >= 0 ? "shadow-[0_0_20px_hsl(199,89%,48%,0.12)]" : "shadow-[0_0_20px_hsl(0,72%,51%,0.12)]",
      extra: <p className="text-[10px] text-muted-foreground mt-0.5">Sale − Cost Price</p>,
    },
    {
      label: "Overdue Invoices",
      value: overdueCount > 0 ? overdueAmount : 0,
      icon: Clock,
      iconColor: overdueCount > 0 ? "text-destructive" : "text-emerald-600",
      iconBg: overdueCount > 0 ? "bg-destructive/10" : "bg-emerald-500/10",
      glowColor: overdueCount > 0 ? "shadow-[0_0_20px_hsl(0,72%,51%,0.12)]" : "",
      displayOverride: overdueCount === 0 ? "None" : undefined,
      extra: overdueCount > 0 ? (
        <p className="text-[10px] text-destructive mt-0.5 flex items-center gap-1">
          <Clock className="h-3 w-3" /> {overdueCount} invoice{overdueCount > 1 ? "s" : ""} past due
        </p>
      ) : null,
    },
  ];

  return (
    <AppLayout title="Dashboard" subtitle="Business overview">
      <div className="space-y-6">
        <TrialBanner />

        {/* Hero Greeting — Mesh gradient */}
        <div className="mesh-hero p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-primary/60 mb-1 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                {new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold font-heading text-foreground">
                {getGreeting()}{settings?.company_name ? `, ${settings.company_name}` : ""}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Here's your business at a glance
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/60 border border-border/40 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[11px] font-mono text-muted-foreground">Live</span>
            </div>
          </div>
        </div>

        {/* KPI Row — Premium glass cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger-children">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className={`glass-kpi gradient-border p-4 sm:p-5 ${kpi.glowColor}`}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">{kpi.label}</p>
                <div className={`icon-ring w-9 h-9 sm:w-11 sm:h-11 rounded-2xl ${kpi.iconBg}`}>
                  <kpi.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${kpi.iconColor}`} />
                </div>
              </div>
              <p className={`text-xl sm:text-2xl font-bold mt-1 font-heading tabular-nums ${kpi.iconColor}`}>
                {kpi.displayOverride || <>PKR <AnimatedCounter value={kpi.value} /></>}
              </p>
              {kpi.extra}
            </div>
          ))}
        </div>

        {/* 30-Day Sales Trend */}
        <Card className="glass-card overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> 30-Day Sales Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {dailySales.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No sales data</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={dailySales} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid hsl(214, 32%, 91%)", backdropFilter: "blur(8px)", background: "rgba(255,255,255,0.9)" }}
                    formatter={(value: number) => [`PKR ${value.toLocaleString()}`, "Sales"]}
                  />
                  <Area type="monotone" dataKey="amount" stroke="hsl(199, 89%, 48%)" strokeWidth={2} fill="url(#salesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions — 4x2 Grid */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 stagger-children">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className={`group relative flex flex-col items-center justify-center gap-1.5 sm:gap-3 h-[80px] sm:h-[110px] rounded-xl sm:rounded-2xl bg-gradient-to-br ${action.gradient} border border-border/50 backdrop-blur-sm cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-lg ${action.shadow} overflow-hidden press-scale`}
            >
              <div className={`flex items-center justify-center w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br ${action.iconBg} shadow-md transition-transform duration-300 group-hover:scale-110`}>
                <action.icon className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-white" />
              </div>
              <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-[0.08em] sm:tracking-[0.12em] text-foreground/80 font-heading group-hover:text-foreground transition-colors text-center leading-tight px-0.5">
                {action.label}
              </span>
              <div className={`absolute bottom-0 left-0 right-0 h-[2px] sm:h-[3px] bg-gradient-to-r ${action.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />
            </button>
          ))}
        </div>

        {/* Month Comparison + Expense Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Monthly Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={[
                  { name: "Last Month", sales: lastMonthSales },
                  { name: "This Month", sales: monthSales },
                ]} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(199, 89%, 48%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(199, 89%, 38%)" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214, 32%, 91%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid hsl(214, 32%, 91%)", background: "rgba(255,255,255,0.9)" }}
                    formatter={(value: number) => [`PKR ${value.toLocaleString()}`, "Sales"]}
                  />
                  <Bar dataKey="sales" radius={[8, 8, 0, 0]} fill="url(#barGrad)" barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Receipt className="h-4 w-4 text-destructive" /> Expense Breakdown (This Month)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex items-center justify-center">
              {expensesByCategory.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No expenses this month</p>
                </div>
              ) : (
                <div className="flex items-center gap-4 w-full">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie
                        data={expensesByCategory}
                        cx="50%" cy="50%"
                        innerRadius={40} outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {expensesByCategory.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 12, border: "1px solid hsl(214, 32%, 91%)", background: "rgba(255,255,255,0.9)" }}
                        formatter={(value: number) => [`PKR ${value.toLocaleString()}`, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {expensesByCategory.map((cat, idx) => (
                      <div key={cat.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                        <span className="capitalize text-muted-foreground truncate flex-1">{cat.name}</span>
                        <span className="font-mono tabular-nums text-foreground">{(cat.value / 1000).toFixed(0)}k</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stock + Top Selling */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-primary" /> New Stock In
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {recentStock.length === 0 ? (
                <div className="text-center py-6">
                  <PackageCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No recent stock received</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentStock.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                      <span className="text-sm font-medium text-foreground truncate max-w-[60%]">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-mono text-xs tabular-nums">{item.quantity} units</Badge>
                        <span className="text-[10px] text-muted-foreground">{item.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Flame className="h-4 w-4 text-destructive" /> Top Selling Items (This Month)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {topSelling.length === 0 ? (
                <div className="text-center py-6">
                  <Flame className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No sales data this month</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {topSelling.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white ${idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : idx === 2 ? "bg-amber-700" : "bg-muted-foreground/30"}`}>
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-foreground truncate max-w-[50%]">{item.name}</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs tabular-nums">{item.qty} sold</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Receivables/Payables + Top Customers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-primary" /> Receivables vs Payables
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {totalReceivables === 0 && totalPayables === 0 ? (
                <div className="text-center py-8">
                  <CircleDollarSign className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No outstanding balances</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={rpData}
                        cx="50%" cy="50%"
                        innerRadius={45} outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        <Cell fill="hsl(199, 89%, 48%)" />
                        <Cell fill="hsl(0, 72%, 51%)" />
                      </Pie>
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 12, border: "1px solid hsl(214, 32%, 91%)", background: "rgba(255,255,255,0.9)" }}
                        formatter={(value: number) => [`PKR ${value.toLocaleString()}`, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex gap-6 text-xs mt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "hsl(199, 89%, 48%)" }} />
                      <span className="text-muted-foreground">Receivable</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground">PKR {totalReceivables.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "hsl(0, 72%, 51%)" }} />
                      <span className="text-muted-foreground">Payable</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground">PKR {totalPayables.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 glass-card overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Top Customers
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {topCustomers.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No customer data yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">This Month</TableHead>
                      <TableHead className="text-right">This Year</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCustomers.map((c, idx) => (
                      <TableRow key={idx} className="table-row-hover">
                        <TableCell className="font-medium text-sm">{c.name}</TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">PKR {c.monthSale.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">PKR {c.yearlySale.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Expiry Alerts Widget */}
        {(expiryAlerts.critical > 0 || expiryAlerts.warning > 0 || expiryAlerts.info > 0) && (
          <Card className="glass-card border-amber-500/20 overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" /> Expiry Alerts
                </CardTitle>
                <div className="flex gap-2">
                  {expiryAlerts.critical > 0 && <Badge variant="destructive" className="text-[10px]">{expiryAlerts.critical} Critical</Badge>}
                  {expiryAlerts.warning > 0 && <Badge className="bg-amber-500 text-white text-[10px]">{expiryAlerts.warning} Warning</Badge>}
                  {expiryAlerts.info > 0 && <Badge variant="secondary" className="text-[10px]">{expiryAlerts.info} Soon</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="space-y-2">
                {expiryAlerts.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${item.severity === "expired" || item.severity === "critical" ? "bg-destructive animate-pulse" : item.severity === "warning" ? "bg-amber-500" : "bg-blue-500"}`} />
                        <span className="text-sm font-medium truncate">{item.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-4">Batch: {item.batch} • Qty: {item.qty}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-mono ${item.severity === "expired" ? "text-destructive font-bold" : item.severity === "critical" ? "text-destructive" : item.severity === "warning" ? "text-amber-600" : "text-muted-foreground"}`}>
                        {item.severity === "expired" ? "EXPIRED" : item.expiry}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" className="w-full mt-3 text-xs press-scale" onClick={() => navigate("/reports/batch-wise")}>
                View Full Batch Report →
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Reorder Alerts */}
        <Card className="glass-card border-destructive/20 overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Smart Reorder Alerts
              </CardTitle>
              <Button size="sm" variant="outline" onClick={generateReorderAlerts} disabled={loadingReorder} className="text-xs h-7 press-scale">
                {loadingReorder ? "Analyzing..." : "Refresh"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {reorderAlerts.length === 0 ? (
              <div className="text-center py-6">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">No reorder alerts</p>
                <p className="text-xs text-muted-foreground mt-1">Click Refresh to analyze stock levels</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reorderAlerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted/80 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${alert.severity === "critical" ? "bg-destructive animate-pulse" : alert.severity === "warning" ? "bg-amber-500" : "bg-blue-500"}`} />
                        <span className="text-sm font-medium text-foreground truncate">{alert.product_name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground ml-4">
                        Stock: {alert.current_stock} • {alert.days_until_stockout}d left
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${
                      alert.severity === "critical" ? "border-destructive/30 text-destructive" :
                      alert.severity === "warning" ? "border-amber-500/30 text-amber-600" :
                      "border-blue-500/30 text-blue-600"
                    }`}>
                      {alert.severity}
                    </Badge>
                  </div>
                ))}
                {settings?.whatsapp_number && (
                  <Button size="sm" variant="outline" className="w-full mt-2 text-xs gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/5 press-scale" onClick={generateReorderAlerts}>
                    <MessageCircle className="h-3.5 w-3.5" /> Send WhatsApp Alert
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Insights CTA */}
        <Card className="glass-card overflow-hidden cursor-pointer hover:shadow-lg transition-all press-scale" onClick={() => navigate("/insights")}>
          <CardContent className="p-0">
            <div className="flex items-center gap-5 bg-gradient-to-r from-violet-600/10 to-primary/10 p-5">
              <div className="p-3 rounded-xl bg-violet-600/20">
                <Brain className="h-6 w-6 text-violet-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground font-heading">AI Business Insights</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Demand forecasting, reorder alerts, margin analysis & more</p>
              </div>
              <span className="text-xs font-semibold text-primary">View Insights →</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
