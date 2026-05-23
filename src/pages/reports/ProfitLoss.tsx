import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

export default function ProfitLoss() {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0]; });
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [revenue, setRevenue] = useState(0);
  const [salesReturns, setSalesReturns] = useState(0);
  const [cogs, setCogs] = useState(0);
  const [purchaseReturns, setPurchaseReturns] = useState(0);
  const [expensesByCategory, setExpensesByCategory] = useState<Record<string, number>>({});
  const [salaries, setSalaries] = useState(0);

  useEffect(() => { load(); }, [from, to]);

  const load = async () => {
    const [sales, expenses, sReturns, pReturns, salaryPay] = await Promise.all([
      supabase.from("sales_invoices").select("id, subtotal").gte("date", from).lte("date", to),
      supabase.from("expenses").select("amount, category, expense_type").gte("date", from).lte("date", to),
      supabase.from("sales_returns").select("total").gte("date", from).lte("date", to),
      supabase.from("purchase_returns").select("total").gte("date", from).lte("date", to),
      supabase.from("salary_payments").select("amount").gte("date", from).lte("date", to),
    ]);

    const salesIds = (sales.data || []).map(s => s.id);
    setRevenue((sales.data || []).reduce((s, i) => s + Number(i.subtotal), 0));

    let allItems: any[] = [];
    for (let i = 0; i < salesIds.length; i += 50) {
      const batch = salesIds.slice(i, i + 50);
      const { data } = await supabase.from("sales_invoice_items").select("quantity, invoice_id, product_id, unit_cost").in("invoice_id", batch);
      allItems = allItems.concat(data || []);
    }

    const { data: products } = await supabase.from("products").select("id, cost_price");
    const costMap: Record<string, number> = {};
    (products || []).forEach(p => { costMap[p.id] = Number(p.cost_price); });

    const cogsTotal = allItems.reduce((s, item) => {
      const snap = Number(item.unit_cost || 0);
      const cost = snap > 0 ? snap : (costMap[item.product_id || ""] || 0);
      return s + Number(item.quantity) * cost;
    }, 0);
    setCogs(cogsTotal);

    setSalesReturns((sReturns.data || []).reduce((s, i) => s + Number(i.total), 0));
    setPurchaseReturns((pReturns.data || []).reduce((s, i) => s + Number(i.total), 0));
    setSalaries((salaryPay.data || []).reduce((s, i) => s + Number(i.amount), 0));
    const cats: Record<string, number> = {};
    (expenses.data || []).filter(e => e.expense_type === 'business').forEach(e => { cats[e.category] = (cats[e.category] || 0) + Number(e.amount); });
    setExpensesByCategory(cats);
  };

  const netRevenue = revenue - salesReturns;
  const netCogs = cogs - purchaseReturns;
  const grossProfit = netRevenue - netCogs;
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  const totalExpenses = Object.values(expensesByCategory).reduce((s, v) => s + v, 0);
  const operatingProfit = grossProfit - totalExpenses;
  const netProfit = operatingProfit - salaries;
  const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
  const formatCategory = (c: string) => c.replace(/_/g, " ");

  // Waterfall chart data
  const waterfallData = [
    { name: "Revenue", value: netRevenue, fill: "hsl(199, 89%, 48%)" },
    { name: "COGS", value: -netCogs, fill: "hsl(0, 72%, 51%)" },
    { name: "Gross Profit", value: grossProfit, fill: grossProfit >= 0 ? "hsl(160, 84%, 39%)" : "hsl(0, 72%, 51%)" },
    { name: "Expenses", value: -totalExpenses, fill: "hsl(263, 70%, 50%)" },
    { name: "Net Profit", value: netProfit, fill: netProfit >= 0 ? "hsl(160, 84%, 39%)" : "hsl(0, 72%, 51%)" },
  ];

  const headerActions = (
    <div className="flex items-center gap-2">
      <Label className="text-xs">From</Label><Input type="date" className="w-36" value={from} onChange={e => setFrom(e.target.value)} />
      <Label className="text-xs">To</Label><Input type="date" className="w-36" value={to} onChange={e => setTo(e.target.value)} />
    </div>
  );

  return (
    <AppLayout title="Profit & Loss" headerActions={headerActions}>
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Waterfall Chart */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">P&L Overview</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={waterfallData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214, 32%, 91%)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(214, 32%, 91%)" }}
                  formatter={(value: number) => [`PKR ${Math.abs(value).toLocaleString()}`, ""]}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                  {waterfallData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Revenue</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground text-sm">Gross Sales</span><span className="font-mono text-sm">PKR {revenue.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground text-sm">Less: Sales Returns</span><span className="font-mono text-sm text-destructive">({salesReturns.toLocaleString()})</span></div>
            <Separator className="my-1" />
            <div className="flex justify-between font-medium"><span>Net Revenue</span><span className="font-mono text-lg">PKR {netRevenue.toLocaleString()}</span></div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Cost of Goods Sold</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground text-sm">Cost of items sold</span><span className="font-mono text-sm">PKR {cogs.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground text-sm">Less: Purchase Returns</span><span className="font-mono text-sm text-primary">({purchaseReturns.toLocaleString()})</span></div>
            <Separator className="my-1" />
            <div className="flex justify-between font-medium"><span>Net COGS</span><span className="font-mono text-lg text-destructive">PKR {netCogs.toLocaleString()}</span></div>
          </CardContent>
        </Card>
        <Separator />
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Gross Profit</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold font-mono ${grossProfit >= 0 ? "text-primary" : "text-destructive"}`}>PKR {grossProfit.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Gross Margin: {grossMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>
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
        <Card className={`glass-card border-2 ${netProfit >= 0 ? "border-primary/30" : "border-destructive/30"}`}>
          <CardHeader><CardTitle className="text-base">Net Profit</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold font-mono ${netProfit >= 0 ? "text-primary" : "text-destructive"}`}>PKR {netProfit.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Net Profit Margin: {netMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
