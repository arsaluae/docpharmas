import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Users, Truck, Package, AlertTriangle, DollarSign, ShoppingCart } from "lucide-react";

interface RecentInvoice { id: string; invoice_number: string; total: number; date: string; status: string; }
interface RecentPO { id: string; po_number: string; total: number; date: string; status: string; }

export default function Index() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCustomers: 0, totalSuppliers: 0, totalProducts: 0,
    totalReceivables: 0, totalPayables: 0, lowStockCount: 0,
    inventoryValue: 0, retailValue: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [recentPOs, setRecentPOs] = useState<RecentPO[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const loadStats = async () => {
      const [customers, suppliers, products, invoices, pos] = await Promise.all([
        supabase.from("customers").select("id, balance"),
        supabase.from("suppliers").select("id, balance"),
        supabase.from("products").select("id, stock_quantity, reorder_level, cost_price, selling_price"),
        supabase.from("sales_invoices").select("id, invoice_number, total, date, status").order("created_at", { ascending: false }).limit(5),
        supabase.from("purchase_orders").select("id, po_number, total, date, status").order("created_at", { ascending: false }).limit(5),
      ]);

      const totalReceivables = (customers.data || []).reduce((sum, c) => sum + Number(c.balance), 0);
      const totalPayables = (suppliers.data || []).reduce((sum, s) => sum + Number(s.balance), 0);
      const prods = products.data || [];
      const lowStock = prods.filter(p => Number(p.stock_quantity) <= Number(p.reorder_level)).length;
      const inventoryValue = prods.reduce((s, p) => s + Number(p.stock_quantity) * Number(p.cost_price), 0);
      const retailValue = prods.reduce((s, p) => s + Number(p.stock_quantity) * Number(p.selling_price), 0);

      setStats({
        totalCustomers: customers.data?.length || 0,
        totalSuppliers: suppliers.data?.length || 0,
        totalProducts: prods.length,
        totalReceivables, totalPayables, lowStockCount: lowStock,
        inventoryValue, retailValue,
      });
      setRecentInvoices(invoices.data || []);
      setRecentPOs(pos.data || []);
    };
    loadStats();
  }, []);

  const kpiCards = [
    { label: "Total Receivables", value: `PKR ${stats.totalReceivables.toLocaleString()}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Total Payables", value: `PKR ${stats.totalPayables.toLocaleString()}`, icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Inventory Value", value: `PKR ${stats.inventoryValue.toLocaleString()}`, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
    { label: "Retail Value", value: `PKR ${stats.retailValue.toLocaleString()}`, icon: ShoppingCart, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Customers", value: stats.totalCustomers, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Suppliers", value: stats.totalSuppliers, icon: Truck, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Products", value: stats.totalProducts, icon: Package, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Low Stock Alerts", value: stats.lowStockCount, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {kpiCards.map((kpi) => (
                <Card key={kpi.label} className="glass-card hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{kpi.label}</p>
                        <p className="text-2xl font-bold text-foreground mt-1 font-heading">{kpi.value}</p>
                      </div>
                      <div className={`p-2.5 rounded-lg ${kpi.bg}`}>
                        <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-lg font-heading">Recent Sales Invoices</CardTitle></CardHeader>
                <CardContent>
                  {recentInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No invoices yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {recentInvoices.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => navigate("/sales-invoices")}>
                          <div>
                            <p className="font-medium text-sm">{inv.invoice_number}</p>
                            <p className="text-xs text-muted-foreground">{inv.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-semibold">PKR {Number(inv.total).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground capitalize">{inv.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader><CardTitle className="text-lg font-heading">Recent Purchase Orders</CardTitle></CardHeader>
                <CardContent>
                  {recentPOs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {recentPOs.map(po => (
                        <div key={po.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors" onClick={() => navigate("/purchase-orders")}>
                          <div>
                            <p className="font-medium text-sm">{po.po_number}</p>
                            <p className="text-xs text-muted-foreground">{po.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-semibold">PKR {Number(po.total).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground capitalize">{po.status}</p>
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
