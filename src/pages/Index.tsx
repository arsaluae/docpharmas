import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp, TrendingDown, CalendarDays, ShoppingCart,
  FileText, CreditCard, Shield, Wallet,
  PackageCheck, Flame, Users,
} from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const [weekSales, setWeekSales] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [grossMargin, setGrossMargin] = useState(0);
  const [recentStock, setRecentStock] = useState<{ name: string; quantity: number; date: string }[]>([]);
  const [topSelling, setTopSelling] = useState<{ name: string; qty: number }[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; monthSale: number; yearlySale: number }[]>([]);

  useEffect(() => { loadDashboard(); }, []);

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

    const [weekInv, monthInv, yearInv, monthItems, recentMovements, products, customers] = await Promise.all([
      supabase.from("sales_invoices").select("subtotal").gte("date", weekStartStr).lte("date", todayStr),
      supabase.from("sales_invoices").select("subtotal, customer_id").gte("date", monthStart).lte("date", todayStr),
      supabase.from("sales_invoices").select("subtotal, customer_id").gte("date", yearStart).lte("date", todayStr),
      supabase.from("sales_invoice_items").select("product_id, quantity, amount, invoice_id, rate").order("amount", { ascending: false }),
      supabase.from("stock_movements").select("product_id, quantity, date").eq("movement_type", "purchase_in").order("created_at", { ascending: false }).limit(5),
      supabase.from("products").select("id, name, cost_price"),
      supabase.from("customers").select("id, name"),
    ]);

    const prodMap: Record<string, { name: string; cost: number }> = {};
    (products.data || []).forEach(p => { prodMap[p.id] = { name: p.name, cost: Number(p.cost_price) }; });
    const custMap: Record<string, string> = {};
    (customers.data || []).forEach(c => { custMap[c.id] = c.name; });

    const ws = (weekInv.data || []).reduce((s, i) => s + Number(i.subtotal), 0);
    const ms = (monthInv.data || []).reduce((s, i) => s + Number(i.subtotal), 0);
    setWeekSales(ws);
    setMonthSales(ms);

    const monthInvoiceIds = new Set<string>();
    const { data: monthInvIds } = await supabase.from("sales_invoices").select("id").gte("date", monthStart).lte("date", todayStr);
    (monthInvIds || []).forEach(inv => monthInvoiceIds.add(inv.id));

    let totalCost = 0;
    const prodQtyMonth: Record<string, number> = {};
    (monthItems.data || []).forEach(item => {
      if (item.product_id && monthInvoiceIds.has(item.invoice_id)) {
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

  const quickActions = [
    { label: "Sales Order", icon: FileText, path: "/proforma", gradient: "from-blue-600 to-indigo-700", shadow: "shadow-blue-500/25" },
    { label: "Sales Invoice", icon: ShoppingCart, path: "/proforma", gradient: "from-emerald-500 to-teal-600", shadow: "shadow-emerald-500/25" },
    { label: "Warranty Invoice", icon: Shield, path: "/warranty-invoices", gradient: "from-violet-500 to-purple-600", shadow: "shadow-violet-500/25" },
    { label: "Payment", icon: Wallet, path: "/payments", gradient: "from-amber-500 to-orange-600", shadow: "shadow-amber-500/25" },
  ];

  return (
    <AppLayout title="Dashboard" subtitle="Business overview">
      <div className="space-y-6">
        {/* Sales Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-primary hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">This Week Sale</p>
                  <p className="text-2xl font-bold text-foreground mt-1 font-heading">PKR {weekSales.toLocaleString()}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-primary/10"><CalendarDays className="h-5 w-5 text-primary" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">This Month Sale</p>
                  <p className="text-2xl font-bold text-foreground mt-1 font-heading">PKR {monthSales.toLocaleString()}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10"><ShoppingCart className="h-5 w-5 text-emerald-500" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-l-4 hover:shadow-md transition-all ${grossMargin >= 0 ? "border-l-primary" : "border-l-destructive"}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Gross Margin (Month)</p>
                  <p className={`text-2xl font-bold mt-1 font-heading ${grossMargin >= 0 ? "text-primary" : "text-destructive"}`}>
                    PKR {Math.abs(grossMargin).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Sale − Cost Price</p>
                </div>
                <div className={`p-2.5 rounded-xl ${grossMargin >= 0 ? "bg-primary/10" : "bg-destructive/10"}`}>
                  {grossMargin >= 0 ? <TrendingUp className="h-5 w-5 text-primary" /> : <TrendingDown className="h-5 w-5 text-destructive" />}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <button key={action.label} onClick={() => navigate(action.path)}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${action.gradient} p-5 text-white shadow-lg ${action.shadow} hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200`}>
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200" />
              <div className="relative flex flex-col items-center gap-3">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm"><action.icon className="h-6 w-6" /></div>
                <span className="font-semibold text-sm tracking-wide">{action.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Panels */}
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

        {/* Top Customers */}
        <Card>
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
        {/* AI Insights CTA */}
        <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-all" onClick={() => navigate("/insights")}>
          <CardContent className="p-0">
            <div className="flex items-center gap-5 bg-gradient-to-r from-violet-600/10 to-primary/10 p-5">
              <div className="p-3 rounded-xl bg-violet-600/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>
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
