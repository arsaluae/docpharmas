import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package } from "lucide-react";
import { fetchAllRows } from "@/lib/batch-fetch";

export default function BatchWiseReport() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => { loadReport(); }, []);

  const loadReport = async () => {
    const [grnItems, salesItems, products] = await Promise.all([
      fetchAllRows("grn_items", "product_id, batch_number, expiry_date, quantity_received"),
      fetchAllRows("sales_invoice_items", "product_id, batch_number, quantity"),
      fetchAllRows("products", "id, name"),
    ]);
    if (!grnItems.length || !products.length) return;
    const pMap = new Map(products.map((p: any) => [p.id, p.name]));
    const batchMap = new Map<string, any>();
    grnItems.forEach((g: any) => {
      const key = `${g.product_id}__${g.batch_number || "N/A"}`;
      if (!batchMap.has(key)) batchMap.set(key, { product_name: pMap.get(g.product_id!) || "—", batch_number: g.batch_number || "N/A", expiry_date: g.expiry_date, qty_received: 0, qty_sold: 0 });
      batchMap.get(key).qty_received += Number(g.quantity_received);
    });
    salesItems.forEach((s: any) => {
      const key = `${s.product_id}__${s.batch_number || "N/A"}`;
      if (batchMap.has(key)) batchMap.get(key).qty_sold += Number(s.quantity);
    });
    setRows(Array.from(batchMap.values()).map(r => ({ ...r, remaining: r.qty_received - r.qty_sold })));
  };

  const isNearExpiry = (d: string | null) => { if (!d) return false; const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24); return diff < 90 && diff > 0; };
  const isExpired = (d: string | null) => d ? new Date(d) < new Date() : false;

  return (
    <AppLayout title="Batch-wise Report" subtitle="Stock, sales & expiry by batch">
      <Card className="glass-card"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead className="text-right">Received</TableHead><TableHead className="text-right">Sold</TableHead><TableHead className="text-right">Remaining</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-2 opacity-40" />No batch data.</TableCell></TableRow> :
              rows.map((r, i) => (
                <TableRow key={i} className={isExpired(r.expiry_date) ? "bg-destructive/10" : isNearExpiry(r.expiry_date) ? "bg-warning/10" : ""}>
                  <TableCell className="font-medium">{r.product_name}</TableCell>
                  <TableCell>{r.batch_number}</TableCell>
                  <TableCell className={isExpired(r.expiry_date) ? "text-destructive font-semibold" : isNearExpiry(r.expiry_date) ? "text-warning font-semibold" : ""}>{r.expiry_date || "—"}</TableCell>
                  <TableCell className="text-right font-mono">{r.qty_received.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{r.qty_sold.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{r.remaining.toLocaleString()}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </AppLayout>
  );
}
