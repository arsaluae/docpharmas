import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package } from "lucide-react";

export default function BatchWiseReport() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    const check = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };
    check(); loadReport();
  }, [navigate]);

  const loadReport = async () => {
    const [{ data: grnItems }, { data: salesItems }, { data: products }] = await Promise.all([
      supabase.from("grn_items").select("product_id, batch_number, expiry_date, quantity_received"),
      supabase.from("sales_invoice_items").select("product_id, batch_number, quantity"),
      supabase.from("products").select("id, name"),
    ]);
    if (!grnItems || !products) return;

    const pMap = new Map(products.map(p => [p.id, p.name]));
    const batchMap = new Map<string, any>();

    grnItems.forEach(g => {
      const key = `${g.product_id}__${g.batch_number || "N/A"}`;
      if (!batchMap.has(key)) batchMap.set(key, { product_name: pMap.get(g.product_id!) || "—", batch_number: g.batch_number || "N/A", expiry_date: g.expiry_date, qty_received: 0, qty_sold: 0 });
      batchMap.get(key).qty_received += Number(g.quantity_received);
    });

    (salesItems || []).forEach(s => {
      const key = `${s.product_id}__${s.batch_number || "N/A"}`;
      if (batchMap.has(key)) batchMap.get(key).qty_sold += Number(s.quantity);
    });

    const result = Array.from(batchMap.values()).map(r => ({ ...r, remaining: r.qty_received - r.qty_sold }));
    setRows(result);
  };

  const isNearExpiry = (d: string | null) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff < 90 && diff > 0;
  };
  const isExpired = (d: string | null) => d ? new Date(d) < new Date() : false;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1"><h1 className="text-xl font-bold text-foreground font-heading">Batch-wise Report</h1><p className="text-sm text-muted-foreground">Stock, sales & expiry by batch</p></div>
          </header>
          <div className="p-6">
            <Card className="glass-card"><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="text-right">Sold</TableHead><TableHead className="text-right">Remaining</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-2 opacity-40" />No batch data.</TableCell></TableRow> :
                    rows.map((r, i) => (
                      <TableRow key={i} className={isExpired(r.expiry_date) ? "bg-destructive/10" : isNearExpiry(r.expiry_date) ? "bg-amber-50" : ""}>
                        <TableCell className="font-medium">{r.product_name}</TableCell>
                        <TableCell>{r.batch_number}</TableCell>
                        <TableCell className={isExpired(r.expiry_date) ? "text-destructive font-semibold" : isNearExpiry(r.expiry_date) ? "text-amber-700 font-semibold" : ""}>{r.expiry_date || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{r.qty_received.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{r.qty_sold.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{r.remaining.toLocaleString()}</TableCell>
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
