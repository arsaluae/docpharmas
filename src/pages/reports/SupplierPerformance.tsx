import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAllRows } from "@/lib/batch-fetch";

export default function SupplierPerformance() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [pis, setPis] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);

  useEffect(() => { (async () => {
    const [s, p, g, r] = await Promise.all([
      fetchAllRows("suppliers", "id, name, balance"),
      fetchAllRows("purchase_invoices", "supplier_id, total"),
      fetchAllRows("goods_received_notes", "supplier_id, date, po_id"),
      fetchAllRows("purchase_returns", "supplier_id, total"),
    ]);
    setSuppliers(s); setPis(p); setGrns(g); setReturns(r);
  })(); }, []);

  const rows = useMemo(() => {
    const map = new Map<string, any>();
    suppliers.forEach((s: any) => map.set(s.id, { ...s, purchases: 0, grnCount: 0, returns: 0 }));
    pis.forEach((p: any) => { const m = map.get(p.supplier_id); if (m) m.purchases += Number(p.total || 0); });
    grns.forEach((g: any) => { const m = map.get(g.supplier_id); if (m) m.grnCount += 1; });
    returns.forEach((r: any) => { const m = map.get(r.supplier_id); if (m) m.returns += Number(r.total || 0); });
    return Array.from(map.values())
      .map((s: any) => ({ ...s, returnPct: s.purchases > 0 ? (s.returns / s.purchases) * 100 : 0 }))
      .sort((a, b) => b.purchases - a.purchases);
  }, [suppliers, pis, grns, returns]);

  return (
    <AppLayout title="Supplier Performance" subtitle="Purchases, GRN throughput & return rate">
      <Card className="glass-card"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Total Purchases</TableHead><TableHead className="text-right">GRNs</TableHead><TableHead className="text-right">Returns</TableHead><TableHead className="text-right">Return %</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right font-mono">{r.purchases.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono">{r.grnCount}</TableCell>
                <TableCell className="text-right font-mono">{r.returns.toLocaleString()}</TableCell>
                <TableCell className={`text-right font-mono ${r.returnPct > 5 ? "text-destructive" : ""}`}>{r.returnPct.toFixed(1)}%</TableCell>
                <TableCell className="text-right font-mono">{Number(r.balance).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </AppLayout>
  );
}
