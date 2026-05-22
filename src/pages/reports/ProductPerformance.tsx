import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchAllRows } from "@/lib/batch-fetch";

export default function ProductPerformance() {
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => { (async () => {
    const [p, ii, inv] = await Promise.all([
      fetchAllRows("products", "id, name, cost_price, selling_price, stock_quantity"),
      fetchAllRows("sales_invoice_items", "product_id, quantity, amount, invoice_id"),
      fetchAllRows("sales_invoices", "id, date"),
    ]);
    setProducts(p); setItems(ii); setInvoices(inv);
  })(); }, []);

  const rows = useMemo(() => {
    const dateById = new Map(invoices.map((i: any) => [i.id, i.date]));
    const cutoff60 = new Date(); cutoff60.setDate(cutoff60.getDate() - 60);
    const stats = new Map<string, any>();
    products.forEach((p: any) => stats.set(p.id, { ...p, units: 0, revenue: 0, lastSale: null as string | null }));
    items.forEach((it: any) => {
      const s = stats.get(it.product_id); if (!s) return;
      s.units += Number(it.quantity || 0); s.revenue += Number(it.amount || 0);
      const d = dateById.get(it.invoice_id);
      if (d && (!s.lastSale || d > s.lastSale)) s.lastSale = d;
    });
    return Array.from(stats.values()).map((s: any) => {
      const margin = s.revenue - s.units * Number(s.cost_price || 0);
      const slow = !s.lastSale || new Date(s.lastSale) < cutoff60;
      return { ...s, margin, slow };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [products, items, invoices]);

  return (
    <AppLayout title="Product Performance" subtitle="Units, revenue, margin & slow movers">
      <Card className="glass-card"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Units Sold</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Gross Margin</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Last Sale</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right font-mono">{r.units.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono">{r.revenue.toLocaleString()}</TableCell>
                <TableCell className={`text-right font-mono ${r.margin >= 0 ? "text-primary" : "text-destructive"}`}>{r.margin.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.stock_quantity).toLocaleString()}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.lastSale || "Never"}</TableCell>
                <TableCell>{r.slow ? <Badge variant="destructive">Slow</Badge> : <Badge variant="secondary">Active</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </AppLayout>
  );
}
