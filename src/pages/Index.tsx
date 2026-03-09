import { useEffect, useState } from "react";
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
  CircleDollarSign, Clock,
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

  // New chart states
  const [dailySales, setDailySales] = useState<{ date: string; amount: number }[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<{ name: string; value: number }[]>([]);
  const [lastMonthSales, setLastMonthSales] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);
  const [totalReceivables, setTotalReceivables] = useState(0);
  const [totalPayables, setTotalPayables] = useState(0);

  useEffect(() => { loadDashboard(); loadReorderAlerts(); }, []);

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

    // Last month range
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthStartStr = lastMonthStart.toISOString().split("T")[0];
    const lastMonthEndStr = lastMonthEnd.toISOString().split("T")[0];

    // 30 days ago for trend chart
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

    // Last month total
    setLastMonthSales((lastMonthInv.data || []).reduce((s, i) => s + Number(i.subtotal), 0));

    // 30-day trend chart — group by date
    const dailyMap: Record<string, number> = {};
    (trendInv.data || []).forEach(inv => {
      dailyMap[inv.date] = (dailyMap[inv.date] || 0) + Number(inv.subtotal);
    });
    // Fill gaps for all 30 days
    const dailyArr: { date: string; amount: number }[] = [];
    for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split("T")[0];
      dailyArr.push({ date: ds.slice(5), amount: dailyMap[ds] || 0 }); // "MM-DD"
    }
    setDailySales(dailyArr);

    // Expense pie
    const catMap: Record<string, number> = {};
    (expenses.data || []).forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount); });
    setExpensesByCategory(
      Object.entries(catMap)
        .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6)
    );

    // Overdue invoices
    const od = overdueInv.data || [];
    setOverdueCount(od.length);
    setOverdueAmount(od.reduce((s, i) => s + Number(i.total), 0));

    // Receivables & Payables
    setTotalReceivables((custBalances.data || []).reduce((s, c) => s + Math.max(Number(c.balance), 0), 0));
    setTotalPayables((suppBalances.data || []).reduce((s, s2) => s + Math.max(Number(s2.balance), 0), 0));

    // Fetch month invoice IDs then items filtered by those IDs
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
  ];

  const rpData = [
    { name: "Receivables", value: totalReceivables },
    { name: "Payables", value: totalPayables },
  ];

  return (
    <AppLayout title="Dashboard" subtitle="Business overview">
      <div className="space-y-6">
        <TrialBanner />

        {/* KPI Row — 4 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary hover:shadow-md transition-all">
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">This Week</p>
              <p className="text-2xl font-bold text-foreground mt-1 font-heading">PKR {weekSales.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-all">
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">This Month</p>
              <p className="text-2xl font-bold text-foreground mt-1 font-heading">PKR {monthSales.toLocaleString()}</p>
              {lastMonthSales > 0 && (
                <p className={`text-[10px] mt-1 font-mono flex items-center gap-1 ${monthGrowth >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {monthGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {monthGrowth >= 0 ? "+" : ""}{monthGrowth.toFixed(1)}% vs last month
                </p>
              )}
            </CardContent>
          </Card>
          <Card className={`border-l-4 hover:shadow-md transition-all ${grossMargin >= 0 ? "border-l-primary" : "border-l-destructive"}`}>
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Gross Margin</p>
              <p className={`text-2xl font-bold mt-1 font-heading ${grossMargin >= 0 ? "text-primary" : "text-destructive"}`}>
                PKR {Math.abs(grossMargin).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Sale − Cost Price</p>
            </CardContent>
          </Card>
          <Card className={`border-l-4 hover:shadow-md transition-all ${overdueCount > 0 ? "border-l-destructive" : "border-l-emerald-500"}`}>
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Overdue Invoices</p>
              <p className={`text-2xl font-bold mt-1 font-heading ${overdueCount > 0 ? "text-destructive" : "text-emerald-600"}`}>
                {overdueCount > 0 ? `PKR ${overdueAmount.toLocaleString()}` : "None"}
              </p>
              {overdueCount > 0 && (
                <p className="text-[10px] text-destructive mt-0.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {overdueCount} invoice{overdueCount > 1 ? "s" : ""} past due
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 30-Day Sales Trend */}
        <Card>
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
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)" }}
                    formatter={(value: number) => [`PKR ${value.toLocaleString()}`, "Sales"]}
                  />
                  <Area type="monotone" dataKey="amount" stroke="hsl(199, 89%, 48%)" strokeWidth={2} fill="url(#salesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className={`group relative flex flex-col items-center justify-center gap-3 h-[120px] rounded-2xl bg-gradient-to-br ${action.gradient} border border-border/50 backdrop-blur-sm cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-lg ${action.shadow} overflow-hidden`}
            >
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${action.iconBg} shadow-md transition-transform duration-300 group-hover:scale-110`}>
                <action.icon className="h-6 w-6 text-white" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/80 font-heading group-hover:text-foreground transition-colors">
                {action.label}
              </span>
              <div className={`absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r ${action.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />
            </button>
          ))}
        </div>

        {/* Month Comparison + Expense Pie */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214, 32%, 91%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)" }}
                    formatter={(value: number) => [`PKR ${value.toLocaleString()}`, "Sales"]}
                  />
                  <Bar dataKey="sales" radius={[6, 6, 0, 0]} fill="hsl(199, 89%, 48%)" barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Receipt className="h-4 w-4 text-destructive" /> Expense Breakdown (This Month)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex items-center justify-center">
              {expensesByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No expenses this month</p>
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
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)" }}
                        formatter={(value: number) => [`PKR ${value.toLocaleString()}`, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {expensesByCategory.map((cat, idx) => (
                      <div key={cat.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                        <span className="capitalize text-muted-foreground truncate flex-1">{cat.name}</span>
                        <span className="font-mono text-foreground">{(cat.value / 1000).toFixed(0)}k</span>
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
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-primary" /> New Stock In
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {recentStock.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No recent stock received</p>
              ) : (
                <div className="space-y-2.5">
                  {recentStock.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                      <span className="text-sm font-medium text-foreground truncate max-w-[60%]">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="font-mono text-xs">{item.quantity} units</Badge>
                        <span className="text-[10px] text-muted-foreground">{item.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Flame className="h-4 w-4 text-destructive" /> Top Selling Items (This Month)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {topSelling.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No sales data this month</p>
              ) : (
                <div className="space-y-2.5">
                  {topSelling.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white ${idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-slate-400" : idx === 2 ? "bg-amber-700" : "bg-muted-foreground/30"}`}>
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-foreground truncate max-w-[50%]">{item.name}</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs">{item.qty} sold</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Receivables/Payables + Top Customers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Receivables vs Payables Donut */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-primary" /> Receivables vs Payables
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {totalReceivables === 0 && totalPayables === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No outstanding balances</p>
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
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)" }}
                        formatter={(value: number) => [`PKR ${value.toLocaleString()}`, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex gap-6 text-xs mt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "hsl(199, 89%, 48%)" }} />
                      <span className="text-muted-foreground">Receivable</span>
                      <span className="font-mono font-semibold text-foreground">PKR {totalReceivables.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "hsl(0, 72%, 51%)" }} />
                      <span className="text-muted-foreground">Payable</span>
                      <span className="font-mono font-semibold text-foreground">PKR {totalPayables.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Customers */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Top Customers
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              {topCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No customer data yet</p>
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
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-sm">{c.name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">PKR {c.monthSale.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-sm">PKR {c.yearlySale.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reorder Alerts */}
        <Card className="border-destructive/20">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Smart Reorder Alerts
              </CardTitle>
              <Button size="sm" variant="outline" onClick={generateReorderAlerts} disabled={loadingReorder} className="text-xs h-7">
                {loadingReorder ? "Analyzing..." : "Refresh"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {reorderAlerts.length === 0 ? (
              <div className="text-center py-6">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No reorder alerts</p>
                <p className="text-xs text-muted-foreground mt-1">Click Refresh to analyze stock levels</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reorderAlerts.map((alert, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50 border border-border/50">
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
                  <Button size="sm" variant="outline" className="w-full mt-2 text-xs gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/5" onClick={generateReorderAlerts}>
                    <MessageCircle className="h-3.5 w-3.5" /> Send WhatsApp Alert
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Insights CTA */}
        <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-all" onClick={() => navigate("/insights")}>
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
