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
} from "lucide-react";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { toast } from "sonner";

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

  const actionHubs = [
    {
      title: "Sales",
      icon: ShoppingCart,
      borderColor: "border-l-blue-500",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
      actions: [
        { label: "Sales Order", path: "/proforma", icon: FileText },
        { label: "Sales Invoice", path: "/proforma", icon: ShoppingCart },
        { label: "Warranty", path: "/warranty-invoices", icon: Shield },
        { label: "Payment In", path: "/payments", icon: Wallet },
      ],
    },
    {
      title: "Purchase",
      icon: Package,
      borderColor: "border-l-emerald-500",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
      actions: [
        { label: "Purchase Order", path: "/purchase-proforma", icon: FileText },
        { label: "Purchase Return", path: "/purchase-returns", icon: RotateCcw },
      ],
    },
    {
      title: "Inventory",
      icon: PackageCheck,
      borderColor: "border-l-amber-500",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600",
      actions: [
        { label: "Products", path: "/products", icon: Package },
        { label: "Stock Movements", path: "/stock-movements", icon: ArrowRightLeft },
      ],
    },
    {
      title: "Printing",
      icon: Printer,
      borderColor: "border-l-violet-500",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-600",
      actions: [
        { label: "Print Jobs", path: "/print-jobs", icon: Printer },
      ],
    },
    {
      title: "Finance",
      icon: Landmark,
      borderColor: "border-l-rose-500",
      iconBg: "bg-rose-500/10",
      iconColor: "text-rose-600",
      actions: [
        { label: "Expenses", path: "/expenses", icon: Receipt },
        { label: "Bank Accounts", path: "/bank-accounts", icon: Landmark },
      ],
    },
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

        {/* Grouped Action Hubs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {actionHubs.map((hub) => (
            <Card key={hub.title} className={`border-l-4 ${hub.borderColor} hover:shadow-md transition-all`}>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-heading flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                  <div className={`p-1.5 rounded-lg ${hub.iconBg}`}>
                    <hub.icon className={`h-3.5 w-3.5 ${hub.iconColor}`} />
                  </div>
                  {hub.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-1">
                <div className="flex flex-col gap-1.5">
                  {hub.actions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => navigate(action.path)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-accent/50 transition-colors text-left"
                    >
                      <action.icon className={`h-3.5 w-3.5 ${hub.iconColor}`} />
                      {action.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
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

        {/* Smart Reorder Alerts */}
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
