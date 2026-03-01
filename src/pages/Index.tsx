import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, Users, Truck, Package, AlertTriangle,
  DollarSign, ShoppingCart, ArrowDownLeft, ArrowUpRight, BarChart3,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface RecentInvoice { id: string; invoice_number: string; total: number; date: string; status: string; }
interface RecentPO { id: string; po_number: string; total: number; date: string; status: string; }
interface RecentPayment { id: string; payment_number: string; type: string; amount: number; date: string; party_type: string; party_id: string; }
interface LowStockProduct { id: string; name: string; stock_quantity: number; reorder_level: number; }
interface MonthlyData { month: string; revenue: number; expenses: number; }

export default function Index() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCustomers: 0, totalSuppliers: 0, totalProducts: 0,
    totalReceivables: 0, totalPayables: 0, lowStockCount: 0,
    inventoryValue: 0, retailValue: 0, todaySales: 0,
    monthRevenue: 0, monthExpenses: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [partyNames, setPartyNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const loadStats = async () => {
      const today = new Date().toISOString().split("T")[0];
      const monthStart = today.slice(0, 7) + "-01";

      const [customers, suppliers, products, invoices, payments, expenses, todayInv, monthInv, monthExp] = await Promise.all([
        supabase.from("customers").select("id, name, balance"),
        supabase.from("suppliers").select("id, name, balance"),
        supabase.from("products").select("id, name, stock_quantity, reorder_level, cost_price, selling_price"),
        supabase.from("sales_invoices").select("id, invoice_number, total, date, status").order("created_at", { ascending: false }).limit(5),
        supabase.from("payments").select("id, payment_number, type, amount, date, party_type, party_id").order("created_at", { ascending: false }).limit(5),
        supabase.from("expenses").select("amount, date, expense_type").gte("date", monthStart).lte("date", today),
        supabase.from("sales_invoices").select("subtotal").eq("date", today),
        supabase.from("sales_invoices").select("subtotal").gte("date", monthStart).lte("date", today),
        supabase.from("expenses").select("amount").eq("expense_type", "business").gte("date", monthStart).lte("date", today),
      ]);

      const totalReceivables = (customers.data || []).reduce((sum, c) => sum + Number(c.balance), 0);
      const totalPayables = (suppliers.data || []).reduce((sum, s) => sum + Number(s.balance), 0);
      const prods = products.data || [];
      const lowStock = prods.filter(p => Number(p.stock_quantity) <= Number(p.reorder_level));
      const inventoryValue = prods.reduce((s, p) => s + Number(p.stock_quantity) * Number(p.cost_price), 0);
      const retailValue = prods.reduce((s, p) => s + Number(p.stock_quantity) * Number(p.selling_price), 0);
      const todaySales = (todayInv.data || []).reduce((s, i) => s + Number(i.subtotal), 0);
      const monthRevenue = (monthInv.data || []).reduce((s, i) => s + Number(i.subtotal), 0);
      const monthExpenses = (monthExp.data || []).reduce((s, e) => s + Number(e.amount), 0);

      // Build party names
      const names: Record<string, string> = {};
      customers.data?.forEach(c => { names[c.id] = c.name; });
      suppliers.data?.forEach(s => { names[s.id] = s.name; });
      setPartyNames(names);

      setStats({
        totalCustomers: customers.data?.length || 0,
        totalSuppliers: suppliers.data?.length || 0,
        totalProducts: prods.length,
        totalReceivables, totalPayables,
        lowStockCount: lowStock.length,
        inventoryValue, retailValue,
        todaySales, monthRevenue, monthExpenses,
      });
      setRecentInvoices(invoices.data || []);
      setRecentPayments(payments.data || []);
      setLowStockProducts(lowStock.slice(0, 5).map(p => ({
        id: p.id, name: p.name,
        stock_quantity: Number(p.stock_quantity),
        reorder_level: Number(p.reorder_level),
      })));

      // Build monthly chart data (last 6 months)
      await loadMonthlyChart();
    };
    loadStats();
  }, []);

  const loadMonthlyChart = async () => {
    const months: MonthlyData[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = d.toISOString().split("T")[0];
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

      const [rev, exp] = await Promise.all([
        supabase.from("sales_invoices").select("subtotal").gte("date", start).lte("date", end),
        supabase.from("expenses").select("amount").eq("expense_type", "business").gte("date", start).lte("date", end),
      ]);

      months.push({
        month: label,
        revenue: (rev.data || []).reduce((s, r) => s + Number(r.subtotal), 0),
        expenses: (exp.data || []).reduce((s, e) => s + Number(e.amount), 0),
      });
    }
    setMonthlyData(months);
  };

  const primaryKPIs = [
    { label: "Total Receivables", value: `PKR ${stats.totalReceivables.toLocaleString()}`, icon: TrendingUp, accent: "border-l-4 border-l-emerald-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { label: "Total Payables", value: `PKR ${stats.totalPayables.toLocaleString()}`, icon: TrendingDown, accent: "border-l-4 border-l-rose-500", iconBg: "bg-rose-50", iconColor: "text-rose-600" },
    { label: "Today's Sales", value: `PKR ${stats.todaySales.toLocaleString()}`, icon: DollarSign, accent: "border-l-4 border-l-blue-500", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
    { label: "Monthly Revenue", value: `PKR ${stats.monthRevenue.toLocaleString()}`, icon: ShoppingCart, accent: "border-l-4 border-l-violet-500", iconBg: "bg-violet-50", iconColor: "text-violet-600" },
  ];

  const secondaryKPIs = [
    { label: "Inventory Value", value: `PKR ${stats.inventoryValue.toLocaleString()}`, icon: Package, iconBg: "bg-primary/10", iconColor: "text-primary" },
    { label: "Low Stock Alerts", value: stats.lowStockCount, icon: AlertTriangle, iconBg: "bg-destructive/10", iconColor: "text-destructive" },
    { label: "Customers", value: stats.totalCustomers, icon: Users, iconBg: "bg-primary/10", iconColor: "text-primary" },
    { label: "Suppliers", value: stats.totalSuppliers, icon: Truck, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div>
              <h1 className="text-xl font-bold text-foreground font-heading">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Financial overview of your pharma business</p>
            </div>
          </header>

          <div className="p-6 space-y-6">
            {/* Primary KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {primaryKPIs.map((kpi) => (
                <Card key={kpi.label} className={`glass-card ${kpi.accent} hover:shadow-md transition-shadow`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                        <p className="text-xl font-bold text-foreground mt-1.5 font-heading">{kpi.value}</p>
                      </div>
                      <div className={`p-2.5 rounded-lg ${kpi.iconBg}`}>
                        <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Secondary KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {secondaryKPIs.map((kpi) => (
                <Card key={kpi.label} className="glass-card hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${kpi.iconBg}`}>
                      <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                      <p className="text-lg font-bold text-foreground font-heading">{kpi.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Revenue vs Expenses Chart */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Revenue vs Expenses (Last 6 Months)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                          fontSize: 12,
                        }}
                        formatter={(value: number) => [`PKR ${value.toLocaleString()}`, undefined]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="revenue" name="Revenue" fill="hsl(231, 91%, 64%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="hsl(330, 81%, 60%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">Loading chart...</div>
                )}
              </CardContent>
            </Card>

            {/* Bottom Row: Recent Invoices, Recent Payments, Low Stock */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Invoices */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading">Recent Sales Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No invoices yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {recentInvoices.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => navigate("/sales-invoices")}>
                          <div>
                            <p className="font-medium text-xs font-mono">{inv.invoice_number}</p>
                            <p className="text-[10px] text-muted-foreground">{inv.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-xs font-semibold">PKR {Number(inv.total).toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{inv.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Payments */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading">Recent Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No payments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {recentPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => navigate("/payments")}>
                          <div className="flex items-center gap-2">
                            {p.type === "received" ? (
                              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                            )}
                            <div>
                              <p className="font-medium text-xs font-mono">{p.payment_number}</p>
                              <p className="text-[10px] text-muted-foreground">{partyNames[p.party_id] || p.party_type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-mono text-xs font-semibold ${p.type === "received" ? "text-emerald-600" : "text-destructive"}`}>
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
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    Low Stock Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lowStockProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">All stock levels OK.</p>
                  ) : (
                    <div className="space-y-2">
                      {lowStockProducts.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 cursor-pointer transition-colors" onClick={() => navigate("/products")}>
                          <p className="text-xs font-medium truncate max-w-[160px]">{p.name}</p>
                          <div className="text-right">
                            <p className="font-mono text-xs font-semibold text-destructive">{p.stock_quantity}</p>
                            <p className="text-[10px] text-muted-foreground">min: {p.reorder_level}</p>
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
