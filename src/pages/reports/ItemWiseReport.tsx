import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package } from "lucide-react";
import { fetchAllRows } from "@/lib/batch-fetch";

export default function ItemWiseReport() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => { loadReport(); }, []);

  const loadReport = async () => {
    const NOT_POSTED = "(draft,voided,cancelled)";
    const [products, grnItems, postedInv] = await Promise.all([
      fetchAllRows("products", "id, name, stock_quantity, cost_price, selling_price"),
      fetchAllRows("grn_items", "product_id, quantity_received, amount"),
      fetchAllRows("sales_invoices", "id", [{ column: "status", op: "not", value: "in", value2: NOT_POSTED }]),
    ]);
    const invIds = postedInv.map((i: any) => i.id);
    let salesItems: any[] = [];
    for (let i = 0; i < invIds.length; i += 500) {
      salesItems = salesItems.concat(await fetchAllRows("sales_invoice_items", "product_id, quantity, amount", [
        { column: "invoice_id", op: "in", value: invIds.slice(i, i + 500) },
      ]));
    }
    if (!products.length) return;
    const map = new Map<string, any>();
    products.forEach((p: any) => map.set(p.id, { ...p, purchased_qty: 0, sold_qty: 0, total_cost: 0, total_revenue: 0 }));
    grnItems.forEach((g: any) => { if (g.product_id && map.has(g.product_id)) { const r = map.get(g.product_id); r.purchased_qty += Number(g.quantity_received); r.total_cost += Number(g.amount); } });
    salesItems.forEach((s: any) => { if (s.product_id && map.has(s.product_id)) { const r = map.get(s.product_id); r.sold_qty += Number(s.quantity); r.total_revenue += Number(s.amount); } });
    setRows(Array.from(map.values()));
  };

  return (
    <AppLayout title="Item-wise Report" subtitle="Purchases, sales & stock per product">
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
                  <TableCell className={`text-right font-mono font-semibold ${r.total_revenue - r.total_cost >= 0 ? "text-primary" : "text-destructive"}`}>{(r.total_revenue - r.total_cost).toLocaleString()}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </AppLayout>
  );
}
