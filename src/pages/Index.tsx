import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Users, Truck, Package, AlertTriangle,
  DollarSign, ShoppingCart, ArrowDownLeft, ArrowUpRight, BarChart3,
  Crown, Star, BoxIcon, CalendarDays, Zap, ArrowRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";

interface RecentInvoice { id: string; invoice_number: string; total: number; subtotal: number; date: string; status: string; customer_id: string | null; }
interface RecentPayment { id: string; payment_number: string; type: string; amount: number; date: string; party_type: string; party_id: string; }
interface LowStockProduct { id: string; name: string; stock_quantity: number; reorder_level: number; }
interface TopProduct { name: string; total_qty: number; total_revenue: number; }
interface TopCustomer { id: string; name: string; total: number; count: number; }
interface MonthlyData { month: string; revenue: number; expenses: number; }
interface RecentGRN { id: string; grn_number: string; date: string; supplier_name: string; }

export default function Index() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCustomers: 0, totalSuppliers: 0, totalProducts: 0,
    totalReceivables: 0, totalPayables: 0, lowStockCount: 0,
    inventoryValue: 0, todaySales: 0,
    weekSales: 0, monthSales: 0, monthExpenses: 0,
    totalInvoicesThisMonth: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [recentGRNs, setRecentGRNs] = useState<RecentGRN[]>([]);
  const [partyNames, setPartyNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const monthStart = todayStr.slice(0, 7) + "-01";
    // Week start (Monday)
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - mondayOffset);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const [
      customers, suppliers, products,
      recentInv, payments,
      todayInv, weekInv, monthInv,
      monthExp, grns, suppliers2,
      // For top products we need invoice items this month
      monthItems,
    ] = await Promise.all([
      supabase.from("customers").select("id, name, balance"),
      supabase.from("suppliers").select("id, name, balance"),
      supabase.from("products").select("id, name, stock_quantity, reorder_level, cost_price, selling_price"),
      supabase.from("sales_invoices").select("id, invoice_number, total, subtotal, date, status, customer_id").order("created_at", { ascending: false }).limit(6),
      supabase.from("payments").select("id, payment_number, type, amount, date, party_type, party_id").order("created_at", { ascending: false }).limit(5),
      supabase.from("sales_invoices").select("subtotal").eq("date", todayStr),
      supabase.from("sales_invoices").select("subtotal").gte("date", weekStartStr).lte("date", todayStr),
      supabase.from("sales_invoices").select("subtotal, customer_id").gte("date", monthStart).lte("date", todayStr),
      supabase.from("expenses").select("amount").eq("expense_type", "business").gte("date", monthStart).lte("date", todayStr),
      supabase.from("goods_received_notes").select("id, grn_number, date, supplier_id").order("created_at", { ascending: false }).limit(5),
      supabase.from("suppliers").select("id, name"),
      supabase.from("sales_invoice_items").select("product_id, quantity, amount, invoice_id").order("amount", { ascending: false }),
    ]);

    // Build party names
    const names: Record<string, string> = {};
    customers.data?.forEach(c => { names[c.id] = c.name; });
    suppliers.data?.forEach(s => { names[s.id] = s.name; });
    const suppMap: Record<string, string> = {};
    suppliers2.data?.forEach(s => { suppMap[s.id] = s.name; });
    setPartyNames(names);

    const totalReceivables = (customers.data || []).reduce((sum, c) => sum + Number(c.balance), 0);
    const totalPayables = (suppliers.data || []).reduce((sum, s) => sum + Number(s.balance), 0);
    const prods = products.data || [];
    const prodMap: Record<string, string> = {};
    prods.forEach(p => { prodMap[p.id] = p.name; });
    const lowStock = prods.filter(p => Number(p.stock_quantity) <= Number(p.reorder_level));
    const inventoryValue = prods.reduce((s, p) => s + Number(p.stock_quantity) * Number(p.cost_price), 0);
    const todaySales = (todayInv.data || []).reduce((s, i) => s + Number(i.subtotal), 0);
    const weekSales = (weekInv.data || []).reduce((s, i) => s + Number(i.subtotal), 0);
    const monthSalesData = monthInv.data || [];
    const monthSales = monthSalesData.reduce((s, i) => s + Number(i.subtotal), 0);
    const monthExpenses = (monthExp.data || []).reduce((s, e) => s + Number(e.amount), 0);

    // Top customers this month
    const custTotals: Record<string, { total: number; count: number }> = {};
    monthSalesData.forEach(inv => {
      if (inv.customer_id) {
        if (!custTotals[inv.customer_id]) custTotals[inv.customer_id] = { total: 0, count: 0 };
        custTotals[inv.customer_id].total += Number(inv.subtotal);
        custTotals[inv.customer_id].count += 1;
      }
    });
    const topCusts: TopCustomer[] = Object.entries(custTotals)
      .map(([id, d]) => ({ id, name: names[id] || "Unknown", total: d.total, count: d.count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Top products sold (all time from items)
    const prodTotals: Record<string, { qty: number; rev: number }> = {};
    (monthItems.data || []).forEach(item => {
      if (item.product_id) {
        if (!prodTotals[item.product_id]) prodTotals[item.product_id] = { qty: 0, rev: 0 };
        prodTotals[item.product_id].qty += Number(item.quantity);
        prodTotals[item.product_id].rev += Number(item.amount);
      }
    });
    const topProds: TopProduct[] = Object.entries(prodTotals)
      .map(([id, d]) => ({ name: prodMap[id] || "Unknown", total_qty: d.qty, total_revenue: d.rev }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 5);

    // Recent GRNs with supplier names
    const grnList: RecentGRN[] = (grns.data || []).map(g => ({
      id: g.id, grn_number: g.grn_number, date: g.date,
      supplier_name: g.supplier_id ? (suppMap[g.supplier_id] || "Unknown") : "—",
    }));

    setStats({
      totalCustomers: customers.data?.length || 0,
      totalSuppliers: suppliers.data?.length || 0,
      totalProducts: prods.length,
      totalReceivables, totalPayables,
      lowStockCount: lowStock.length,
      inventoryValue, todaySales, weekSales, monthSales, monthExpenses,
      totalInvoicesThisMonth: monthSalesData.length,
    });
    setRecentInvoices(recentInv.data || []);
    setRecentPayments(payments.data || []);
    setLowStockProducts(lowStock.slice(0, 5).map(p => ({
      id: p.id, name: p.name,
      stock_quantity: Number(p.stock_quantity),
      reorder_level: Number(p.reorder_level),
    })));
    setTopProducts(topProds);
    setTopCustomers(topCusts);
    setRecentGRNs(grnList);

    // Monthly chart
    loadMonthlyChart();
  };

  const loadMonthlyChart = async () => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startDate = sixMonthsAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    const [rev, exp] = await Promise.all([
      supabase.from("sales_invoices").select("subtotal, date").gte("date", startDate).lte("date", endDate),
      supabase.from("expenses").select("amount, date").eq("expense_type", "business").gte("date", startDate).lte("date", endDate),
    ]);

    const months: MonthlyData[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const revenue = (rev.data || []).filter(r => r.date.startsWith(monthStr)).reduce((s, r) => s + Number(r.subtotal), 0);
      const expenses = (exp.data || []).filter(e => e.date.startsWith(monthStr)).reduce((s, e) => s + Number(e.amount), 0);
      months.push({ month: label, revenue, expenses });
    }
    setMonthlyData(months);
  };

  const netProfit = stats.monthSales - stats.monthExpenses;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Real-time business intelligence</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                <CalendarDays className="h-3 w-3 mr-1" />
                {new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
              </Badge>
            </div>
          </header>

          <div className="p-6 space-y-5">

            {/* === ROW 1: Hero Sales Cards === */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="glass-card border-l-4 border-l-primary hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Today's Sales</p>
                      <p className="text-2xl font-bold text-foreground mt-1 font-heading">PKR {stats.todaySales.toLocaleString()}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-l-4 border-l-primary/70 hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">This Week</p>
                      <p className="text-2xl font-bold text-foreground mt-1 font-heading">PKR {stats.weekSales.toLocaleString()}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-primary/10">
                      <CalendarDays className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-l-4 border-l-warning hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">This Month</p>
                      <p className="text-2xl font-bold text-foreground mt-1 font-heading">PKR {stats.monthSales.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{stats.totalInvoicesThisMonth} invoices</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-warning/10">
                      <ShoppingCart className="h-5 w-5 text-warning" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`glass-card border-l-4 hover:shadow-md transition-all ${netProfit >= 0 ? "border-l-primary" : "border-l-destructive"}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Net Profit (Month)</p>
                      <p className={`text-2xl font-bold mt-1 font-heading ${netProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                        PKR {Math.abs(netProfit).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Expenses: PKR {stats.monthExpenses.toLocaleString()}
                      </p>
                    </div>
                    <div className={`p-2.5 rounded-xl ${netProfit >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                      {netProfit >= 0 ? <TrendingUp className="h-5 w-5 text-primary" /> : <TrendingDown className="h-5 w-5 text-destructive" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* === ROW 2: Financial Overview === */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Receivables", value: `${(stats.totalReceivables / 1000).toFixed(0)}k`, icon: TrendingUp, iconBg: "bg-primary/10", iconColor: "text-primary" },
                { label: "Payables", value: `${(stats.totalPayables / 1000).toFixed(0)}k`, icon: TrendingDown, iconBg: "bg-destructive/10", iconColor: "text-destructive" },
                { label: "Inventory", value: `${(stats.inventoryValue / 1000).toFixed(0)}k`, icon: Package, iconBg: "bg-primary/10", iconColor: "text-primary" },
                { label: "Low Stock", value: stats.lowStockCount, icon: AlertTriangle, iconBg: "bg-destructive/10", iconColor: "text-destructive" },
                { label: "Customers", value: stats.totalCustomers, icon: Users, iconBg: "bg-primary/10", iconColor: "text-primary" },
                { label: "Suppliers", value: stats.totalSuppliers, icon: Truck, iconBg: "bg-warning/10", iconColor: "text-warning" },
              ].map(kpi => (
                <Card key={kpi.label} className="glass-card hover:shadow-sm transition-all">
                  <CardContent className="p-3 flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${kpi.iconBg}`}>
                      <kpi.icon className={`h-3.5 w-3.5 ${kpi.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                      <p className="text-sm font-bold text-foreground font-heading">{kpi.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* === ROW 3: Charts Row === */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Revenue vs Expenses Bar Chart */}
              <Card className="glass-card lg:col-span-2">
                <CardHeader className="pb-1 pt-4 px-5">
                  <CardTitle className="text-sm font-heading flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Monthly Revenue vs Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-3">
                  {monthlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={monthlyData} barGap={2} barSize={20}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                            borderRadius: "0.5rem", fontSize: 11, boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                          }}
                          formatter={(value: number) => [`PKR ${value.toLocaleString()}`, undefined]}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Bar dataKey="revenue" name="Revenue" fill="hsl(231, 91%, 64%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name="Expenses" fill="hsl(330, 81%, 60%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">Loading chart...</div>
                  )}
                </CardContent>
              </Card>

              {/* Top Customers */}
              <Card className="glass-card">
                <CardHeader className="pb-1 pt-4 px-5">
                  <CardTitle className="text-sm font-heading flex items-center gap-2">
                    <Crown className="h-4 w-4 text-warning" />
                    Top Customers (This Month)
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {topCustomers.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">No sales this month.</p>
                  ) : (
                    <div className="space-y-2 mt-1">
                      {topCustomers.map((c, i) => (
                        <div key={c.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate("/customers")}>
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            i === 0 ? "bg-warning/20 text-warning" : i === 1 ? "bg-secondary text-secondary-foreground" : "bg-accent text-accent-foreground"
                          }`}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground">{c.count} invoice{c.count > 1 ? "s" : ""}</p>
                          </div>
                          <p className="text-xs font-bold font-mono text-foreground">PKR {c.total.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* === ROW 4: Sales Intelligence === */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Top Products Sold */}
              <Card className="glass-card">
                <CardHeader className="pb-1 pt-4 px-5">
                  <CardTitle className="text-sm font-heading flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary" />
                    Top Products Sold
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {topProducts.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">No product sales data.</p>
                  ) : (
                    <div className="space-y-2 mt-1">
                      {topProducts.map((p, i) => {
                        const maxRev = topProducts[0]?.total_revenue || 1;
                        const pct = (p.total_revenue / maxRev) * 100;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium truncate max-w-[140px]">{p.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">{p.total_qty} sold</span>
                                <span className="text-xs font-bold font-mono">PKR {p.total_revenue.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Sales Invoices */}
              <Card className="glass-card">
                <CardHeader className="pb-1 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-heading flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      Recent Sales
                    </CardTitle>
                    <button className="text-[10px] text-primary flex items-center gap-0.5 hover:underline" onClick={() => navigate("/sales-invoices")}>
                      View all <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {recentInvoices.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">No invoices yet.</p>
                  ) : (
                    <div className="space-y-1.5 mt-1">
                      {recentInvoices.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg border border-border/50 hover:bg-accent/40 cursor-pointer transition-colors" onClick={() => navigate("/sales-invoices")}>
                          <div>
                            <p className="text-xs font-medium font-mono">{inv.invoice_number}</p>
                            <p className="text-[10px] text-muted-foreground">{inv.customer_id ? partyNames[inv.customer_id] || "" : ""} · {inv.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-xs font-bold">PKR {Number(inv.total).toLocaleString()}</p>
                            <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="text-[9px] px-1.5 py-0 h-4">
                              {inv.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Inventory Inbound */}
              <Card className="glass-card">
                <CardHeader className="pb-1 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-heading flex items-center gap-2">
                      <BoxIcon className="h-4 w-4 text-primary" />
                      Inventory Inbound
                    </CardTitle>
                    <button className="text-[10px] text-primary flex items-center gap-0.5 hover:underline" onClick={() => navigate("/goods-received-notes")}>
                      View all <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {recentGRNs.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">No recent GRNs.</p>
                  ) : (
                    <div className="space-y-1.5 mt-1">
                      {recentGRNs.map(g => (
                        <div key={g.id} className="flex items-center justify-between p-2 rounded-lg border border-border/50 hover:bg-accent/40 cursor-pointer transition-colors" onClick={() => navigate("/goods-received-notes")}>
                          <div>
                            <p className="text-xs font-medium font-mono">{g.grn_number}</p>
                            <p className="text-[10px] text-muted-foreground">{g.supplier_name}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{g.date}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* === ROW 5: Bottom Row === */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Recent Payments */}
              <Card className="glass-card">
                <CardHeader className="pb-1 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-heading flex items-center gap-2">
                      <ArrowDownLeft className="h-4 w-4 text-primary" />
                      Recent Payments
                    </CardTitle>
                    <button className="text-[10px] text-primary flex items-center gap-0.5 hover:underline" onClick={() => navigate("/payments")}>
                      View all <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {recentPayments.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">No payments yet.</p>
                  ) : (
                    <div className="space-y-1.5 mt-1">
                      {recentPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-border/50 hover:bg-accent/40 cursor-pointer transition-colors" onClick={() => navigate("/payments")}>
                          <div className="flex items-center gap-2">
                            {p.type === "received" ? (
                              <div className="p-1 rounded bg-primary/10"><ArrowDownLeft className="h-3 w-3 text-primary" /></div>
                            ) : (
                              <div className="p-1 rounded bg-destructive/10"><ArrowUpRight className="h-3 w-3 text-destructive" /></div>
                            )}
                            <div>
                              <p className="text-xs font-medium font-mono">{p.payment_number}</p>
                              <p className="text-[10px] text-muted-foreground">{partyNames[p.party_id] || p.party_type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-mono text-xs font-bold ${p.type === "received" ? "text-primary" : "text-destructive"}`}>
                              {p.type === "received" ? "+" : "-"}PKR {Number(p.amount).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{p.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Low Stock Alerts */}
              <Card className="glass-card">
                <CardHeader className="pb-1 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-heading flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Low Stock Alerts
                    </CardTitle>
                    <button className="text-[10px] text-primary flex items-center gap-0.5 hover:underline" onClick={() => navigate("/products")}>
                      View all <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {lowStockProducts.length === 0 ? (
                    <p className="text-xs text-primary py-6 text-center font-medium">✓ All stock levels are healthy</p>
                  ) : (
                    <div className="space-y-1.5 mt-1">
                      {lowStockProducts.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-destructive/20 bg-destructive/5 cursor-pointer transition-colors hover:bg-destructive/10" onClick={() => navigate("/products")}>
                          <p className="text-xs font-medium truncate max-w-[200px]">{p.name}</p>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-mono text-xs font-bold text-destructive">{p.stock_quantity}</p>
                              <p className="text-[10px] text-muted-foreground">min: {p.reorder_level}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
