import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search } from "lucide-react";
import { fetchAllRows } from "@/lib/batch-fetch";

export default function CustomerWiseReport() {
  const [rows, setRows] = useState<any[]>([]);
  const [areaFilter, setAreaFilter] = useState("");

  useEffect(() => { loadReport(); }, []);

  const loadReport = async () => {
    const NOT_POSTED = "(draft,voided,cancelled)";
    const [customers, invoices, payments, returns] = await Promise.all([
      fetchAllRows("customers", "id, name, area, balance"),
      fetchAllRows("sales_invoices", "customer_id, total", [
        { column: "status", op: "not", value: "in", value2: NOT_POSTED },
      ]),
      fetchAllRows("payments", "party_id, amount", [
        { column: "party_type", op: "eq", value: "customer" },
        { column: "status", op: "not", value: "in", value2: NOT_POSTED },
      ]),
      fetchAllRows("sales_returns", "customer_id, total", [
        { column: "status", op: "not", value: "in", value2: NOT_POSTED },
      ]),
    ]);
    if (!customers.length) return;
    const map = new Map<string, any>();
    customers.forEach((c: any) => map.set(c.id, { ...c, total_sales: 0, total_payments: 0, total_returns: 0 }));
    invoices.forEach((inv: any) => { if (inv.customer_id && map.has(inv.customer_id)) map.get(inv.customer_id).total_sales += Number(inv.total); });
    payments.forEach((p: any) => { if (map.has(p.party_id)) map.get(p.party_id).total_payments += Number(p.amount); });
    returns.forEach((r: any) => { if (r.customer_id && map.has(r.customer_id)) map.get(r.customer_id).total_returns += Number(r.total); });
    setRows(Array.from(map.values()));
  };

  const filtered = rows.filter(r => !areaFilter || (r.area || "").toLowerCase().includes(areaFilter.toLowerCase()));

  return (
    <AppLayout title="Customer-wise Report" subtitle="Sales, returns & balance by customer with area filter">
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter by area..." className="pl-9" value={areaFilter} onChange={e => setAreaFilter(e.target.value)} />
        </div>
        <Card className="glass-card"><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Area</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Returns</TableHead><TableHead className="text-right">Payments</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 opacity-40" />No data.</TableCell></TableRow> :
                filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.area || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{r.total_sales.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{r.total_returns.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{r.total_payments.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{Number(r.balance).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </AppLayout>
  );
}
