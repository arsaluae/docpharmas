import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package } from "lucide-react";

export default function ItemWiseReport() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    const check = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };
    check(); loadReport();
  }, [navigate]);

  const loadReport = async () => {
    const [{ data: products }, { data: grnItems }, { data: salesItems }] = await Promise.all([
      supabase.from("products").select("id, name, stock_quantity, cost_price, selling_price"),
      supabase.from("grn_items").select("product_id, quantity_received, amount"),
      supabase.from("sales_invoice_items").select("product_id, quantity, amount"),
    ]);
    if (!products) return;

    const map = new Map<string, any>();
    products.forEach(p => map.set(p.id, { ...p, purchased_qty: 0, sold_qty: 0, total_cost: 0, total_revenue: 0 }));
    (grnItems || []).forEach(g => { if (g.product_id && map.has(g.product_id)) { const r = map.get(g.product_id); r.purchased_qty += Number(g.quantity_received); r.total_cost += Number(g.amount); } });
    (salesItems || []).forEach(s => { if (s.product_id && map.has(s.product_id)) { const r = map.get(s.product_id); r.sold_qty += Number(s.quantity); r.total_revenue += Number(s.amount); } });
    setRows(Array.from(map.values()));
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1"><h1 className="text-xl font-bold text-foreground font-heading">Item-wise Report</h1><p className="text-sm text-muted-foreground">Purchases, sales & stock per product</p></div>
          </header>
          <div className="p-6">
            <Card className="glass-card"><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Purchased Qty</TableHead><TableHead className="text-right">Sold Qty</TableHead><TableHead className="text-right">Current Stock</TableHead><TableHead className="text-right">Total Cost</TableHead><TableHead className="text-right">Total Revenue</TableHead><TableHead className="text-right">Profit</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-2 opacity-40" />No data.</TableCell></TableRow> :
                    rows.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right font-mono">{r.purchased_qty.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{r.sold_qty.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{Number(r.stock_quantity).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{r.total_cost.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{r.total_revenue.toLocaleString()}</TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${r.total_revenue - r.total_cost >= 0 ? "text-emerald-600" : "text-destructive"}`}>{(r.total_revenue - r.total_cost).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
