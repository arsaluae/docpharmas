import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Users, Truck, Package, AlertTriangle } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalSuppliers: 0,
    totalProducts: 0,
    totalReceivables: 0,
    totalPayables: 0,
    lowStockCount: 0,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const loadStats = async () => {
      const [customers, suppliers, products] = await Promise.all([
        supabase.from("customers").select("id, balance"),
        supabase.from("suppliers").select("id, balance"),
        supabase.from("products").select("id, stock_quantity, reorder_level"),
      ]);

      const totalReceivables = (customers.data || []).reduce((sum, c) => sum + Number(c.balance), 0);
      const totalPayables = (suppliers.data || []).reduce((sum, s) => sum + Number(s.balance), 0);
      const lowStock = (products.data || []).filter(p => Number(p.stock_quantity) <= Number(p.reorder_level)).length;

      setStats({
        totalCustomers: customers.data?.length || 0,
        totalSuppliers: suppliers.data?.length || 0,
        totalProducts: products.data?.length || 0,
        totalReceivables,
        totalPayables,
        lowStockCount: lowStock,
      });
    };
    loadStats();
  }, []);

  const kpiCards = [
    { label: "Total Receivables", value: `PKR ${stats.totalReceivables.toLocaleString()}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Total Payables", value: `PKR ${stats.totalPayables.toLocaleString()}`, icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10" },
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg font-heading">Quick Start</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button onClick={() => navigate("/customers")} className="p-4 rounded-lg border border-border hover:bg-accent transition-colors text-left">
                    <Users className="h-5 w-5 text-primary mb-2" />
                    <p className="font-medium text-foreground">Add Customer</p>
                    <p className="text-xs text-muted-foreground mt-1">Set up customer accounts & credit terms</p>
                  </button>
                  <button onClick={() => navigate("/suppliers")} className="p-4 rounded-lg border border-border hover:bg-accent transition-colors text-left">
                    <Truck className="h-5 w-5 text-amber-600 mb-2" />
                    <p className="font-medium text-foreground">Add Supplier</p>
                    <p className="text-xs text-muted-foreground mt-1">Register RM & packing material suppliers</p>
                  </button>
                  <button onClick={() => navigate("/products")} className="p-4 rounded-lg border border-border hover:bg-accent transition-colors text-left">
                    <Package className="h-5 w-5 text-violet-600 mb-2" />
                    <p className="font-medium text-foreground">Add Product</p>
                    <p className="text-xs text-muted-foreground mt-1">Register products with DRAP & pricing</p>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
