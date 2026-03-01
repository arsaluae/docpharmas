import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function ProfitLoss() {
  const navigate = useNavigate();
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [revenue, setRevenue] = useState(0);
  const [salesReturns, setSalesReturns] = useState(0);
  const [cogs, setCogs] = useState(0);
  const [purchaseReturns, setPurchaseReturns] = useState(0);
  const [expensesByCategory, setExpensesByCategory] = useState<Record<string, number>>({});

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check();
  }, [navigate]);

  useEffect(() => { load(); }, [from, to]);

  const load = async () => {
    const [sales, purchases, expenses, sReturns, pReturns] = await Promise.all([
      supabase.from("sales_invoices").select("subtotal").gte("date", from).lte("date", to),
      supabase.from("purchase_invoices").select("subtotal").gte("date", from).lte("date", to),
      supabase.from("expenses").select("amount, category, expense_type").gte("date", from).lte("date", to),
      supabase.from("sales_returns").select("total").gte("date", from).lte("date", to),
      supabase.from("purchase_returns").select("total").gte("date", from).lte("date", to),
    ]);
    setRevenue((sales.data || []).reduce((s, i) => s + Number(i.subtotal), 0));
    setCogs((purchases.data || []).reduce((s, i) => s + Number(i.subtotal), 0));
    setSalesReturns((sReturns.data || []).reduce((s, i) => s + Number(i.total), 0));
    setPurchaseReturns((pReturns.data || []).reduce((s, i) => s + Number(i.total), 0));
    const cats: Record<string, number> = {};
    (expenses.data || []).filter(e => e.expense_type === 'business').forEach(e => { cats[e.category] = (cats[e.category] || 0) + Number(e.amount); });
    setExpensesByCategory(cats);
  };

  const netRevenue = revenue - salesReturns;
  const netCogs = cogs - purchaseReturns;
  const grossProfit = netRevenue - netCogs;
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  const totalExpenses = Object.values(expensesByCategory).reduce((s, v) => s + v, 0);
  const netProfit = grossProfit - totalExpenses;
  const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  const formatCategory = (c: string) => c.replace(/_/g, " ");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-bold text-foreground font-heading flex-1">Profit & Loss</h1>
            <div className="flex items-center gap-2">
              <Label className="text-xs">From</Label><Input type="date" className="w-36" value={from} onChange={e => setFrom(e.target.value)} />
              <Label className="text-xs">To</Label><Input type="date" className="w-36" value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </header>
          <div className="p-6 max-w-2xl mx-auto space-y-4">
            {/* Revenue */}
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-base">Revenue</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground text-sm">Gross Sales</span><span className="font-mono text-sm">PKR {revenue.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground text-sm">Less: Sales Returns</span><span className="font-mono text-sm text-destructive">({salesReturns.toLocaleString()})</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between font-medium"><span>Net Revenue</span><span className="font-mono text-lg">PKR {netRevenue.toLocaleString()}</span></div>
              </CardContent>
            </Card>

            {/* COGS */}
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-base">Cost of Goods Sold</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground text-sm">Purchases</span><span className="font-mono text-sm">PKR {cogs.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground text-sm">Less: Purchase Returns</span><span className="font-mono text-sm text-emerald-600">({purchaseReturns.toLocaleString()})</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between font-medium"><span>Net COGS</span><span className="font-mono text-lg text-destructive">PKR {netCogs.toLocaleString()}</span></div>
              </CardContent>
            </Card>

            <Separator />

            {/* Gross Profit */}
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-base">Gross Profit</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold font-mono ${grossProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>PKR {grossProfit.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Gross Margin: {grossMargin.toFixed(1)}%</p>
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-base">Operating Expenses</CardTitle></CardHeader>
              <CardContent>
                {Object.keys(expensesByCategory).length === 0 ? <p className="text-muted-foreground text-sm">No expenses in period</p> :
                  Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between py-1">
                      <span className="capitalize text-sm text-muted-foreground">{formatCategory(cat)}</span>
                      <span className="font-mono text-sm">PKR {amt.toLocaleString()}</span>
                    </div>
                  ))}
                <Separator className="my-2" />
                <div className="flex justify-between font-medium">
                  <span>Total Expenses</span><span className="font-mono text-destructive">PKR {totalExpenses.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Net Profit */}
            <Card className={`glass-card border-2 ${netProfit >= 0 ? "border-emerald-500/30" : "border-destructive/30"}`}>
              <CardHeader><CardTitle className="text-base">Net Profit</CardTitle></CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold font-mono ${netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>PKR {netProfit.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Net Profit Margin: {netMargin.toFixed(1)}%</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
