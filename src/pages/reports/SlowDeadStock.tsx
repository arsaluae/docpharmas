import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchAllRows } from "@/lib/batch-fetch";

export default function SlowDeadStock() {
  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => { (async () => {
    const NOT_POSTED = "(draft,voided,cancelled)";
    const [p, inv] = await Promise.all([
      fetchAllRows("products", "id, name, stock_quantity, cost_price"),
      fetchAllRows("sales_invoices", "id, date", [{ column: "status", op: "not", value: "in", value2: NOT_POSTED }]),
    ]);
    const invIds = inv.map((i: any) => i.id);
    let ii: any[] = [];
    for (let i = 0; i < invIds.length; i += 500) {
      ii = ii.concat(await fetchAllRows("sales_invoice_items", "product_id, invoice_id, quantity", [
        { column: "invoice_id", op: "in", value: invIds.slice(i, i + 500) },
      ]));
    }
    setProducts(p); setItems(ii); setInvoices(inv);
  })(); }, []);

  const rows = useMemo(() => {
    const dateById = new Map(invoices.map((i: any) => [i.id, i.date]));
    const lastByProd = new Map<string, string>();
    items.forEach((it: any) => {
      const d = dateById.get(it.invoice_id); if (!d) return;
      const prev = lastByProd.get(it.product_id);
      if (!prev || d > prev) lastByProd.set(it.product_id, d as string);
    });
    const today = new Date();
    return products.map((p: any) => {
      const last = lastByProd.get(p.id) || null;
      const days = last ? Math.floor((today.getTime() - new Date(last).getTime()) / (1000 * 60 * 60 * 24)) : 9999;
      const value = Number(p.stock_quantity || 0) * Number(p.cost_price || 0);
      return { ...p, last, days, value };
    })
      .filter(r => Number(r.stock_quantity) > 0 && r.days >= 60)
      .sort((a, b) => b.days - a.days);
  }, [products, items, invoices]);

  const totalLocked = rows.reduce((s, r) => s + r.value, 0);

  return (
    <AppLayout title="Slow & Dead Stock" subtitle="Products with no sales in 60+ days">
      <Card className="glass-card mb-4"><CardContent className="p-5">
        <div className="text-xs text-muted-foreground">Capital Locked in Slow Stock</div>
        <div className="text-2xl font-bold font-mono mt-1 text-destructive">PKR {totalLocked.toLocaleString()}</div>
      </CardContent></Card>
      <Card className="glass-card"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Last Sale</TableHead><TableHead className="text-right">Days Idle</TableHead><TableHead className="text-right">Locked Value</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.stock_quantity).toLocaleString()}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.last || "Never sold"}</TableCell>
                <TableCell className="text-right font-mono">{r.days >= 9999 ? "∞" : r.days}</TableCell>
                <TableCell className="text-right font-mono">{r.value.toLocaleString()}</TableCell>
                <TableCell>{r.days >= 180 ? <Badge variant="destructive">Dead</Badge> : r.days >= 90 ? <Badge variant="destructive">Very slow</Badge> : <Badge variant="secondary">Slow</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </AppLayout>
  );
}
