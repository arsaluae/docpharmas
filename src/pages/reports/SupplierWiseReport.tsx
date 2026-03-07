import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck } from "lucide-react";

export default function SupplierWiseReport() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => { loadReport(); }, []);

  const loadReport = async () => {
    const [{ data: suppliers }, { data: invoices }, { data: payments }, { data: returns }] = await Promise.all([
      supabase.from("suppliers").select("id, name, balance"),
      supabase.from("purchase_invoices").select("supplier_id, total"),
      supabase.from("payments").select("party_id, amount").eq("party_type", "supplier"),
      supabase.from("purchase_returns").select("supplier_id, total"),
    ]);
    if (!suppliers) return;
    const map = new Map<string, any>();
    suppliers.forEach(s => map.set(s.id, { ...s, total_purchases: 0, total_payments: 0, total_returns: 0 }));
    (invoices || []).forEach(inv => { if (inv.supplier_id && map.has(inv.supplier_id)) map.get(inv.supplier_id).total_purchases += Number(inv.total); });
    (payments || []).forEach(p => { if (map.has(p.party_id)) map.get(p.party_id).total_payments += Number(p.amount); });
    (returns || []).forEach(r => { if (r.supplier_id && map.has(r.supplier_id)) map.get(r.supplier_id).total_returns += Number(r.total); });
    setRows(Array.from(map.values()));
  };

  return (
    <AppLayout title="Supplier-wise Report" subtitle="Purchases, returns & balance by supplier">
      <Card className="glass-card"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Purchases</TableHead><TableHead className="text-right">Returns</TableHead><TableHead className="text-right">Payments</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground"><Truck className="h-8 w-8 mx-auto mb-2 opacity-40" />No data.</TableCell></TableRow> :
              rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right font-mono">{r.total_purchases.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{r.total_returns.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{r.total_payments.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{Number(r.balance).toLocaleString()}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </AppLayout>
  );
}
