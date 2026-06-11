import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Truck, Loader2 } from "lucide-react";
import { ReportToolbar } from "@/components/reports/ReportToolbar";
import { useFreightProviders } from "@/hooks/useFreightProviders";
import { applyPosted } from "@/lib/reports/posted";

interface ExpenseRow {
  id: string;
  date: string;
  expense_number: string;
  description: string | null;
  amount: number;
  payment_method: string;
  freight_provider_id: string | null;
}

const fmt = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const monthKey = (d: string) => d.slice(0, 7); // YYYY-MM
const monthLabel = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

export default function CourierExpenses() {
  const { providers } = useFreightProviders(true);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 11); d.setDate(1); return d.toISOString().slice(0, 10); });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillKey, setDrillKey] = useState<{ provider: string; month: string } | null>(null);

  useEffect(() => { (async () => {
    setLoading(true);
    let q = supabase.from("expenses")
      .select("id, date, expense_number, description, amount, payment_method, freight_provider_id")
      .gte("date", from).lte("date", to)
      .not("freight_provider_id", "is", null)
      .order("date", { ascending: false });
    q = applyPosted(q);
    const { data } = await q;
    setRows((data as any) ?? []);
    setLoading(false);
  })(); }, [from, to]);

  const months = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(monthKey(r.date)));
    // Always include all months in range, even empty
    const start = new Date(from); start.setDate(1);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return Array.from(set).sort();
  }, [rows, from, to]);

  const providerList = useMemo(() => {
    const ids = new Set(rows.map(r => r.freight_provider_id!));
    return providers.filter(p => ids.has(p.id));
  }, [rows, providers]);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    rows.forEach(r => {
      const pid = r.freight_provider_id!;
      const mk = monthKey(r.date);
      m[pid] = m[pid] || {};
      m[pid][mk] = (m[pid][mk] || 0) + Number(r.amount || 0);
    });
    return m;
  }, [rows]);

  const monthTotals = useMemo(() => {
    const t: Record<string, number> = {};
    months.forEach(mk => {
      t[mk] = providerList.reduce((s, p) => s + (matrix[p.id]?.[mk] || 0), 0);
    });
    return t;
  }, [months, providerList, matrix]);
  const providerTotals = useMemo(() => {
    const t: Record<string, number> = {};
    providerList.forEach(p => {
      t[p.id] = months.reduce((s, mk) => s + (matrix[p.id]?.[mk] || 0), 0);
    });
    return t;
  }, [providerList, months, matrix]);
  const grandTotal = Object.values(providerTotals).reduce((s, n) => s + n, 0);

  const drillRows = useMemo(() => {
    if (!drillKey) return [];
    return rows.filter(r => r.freight_provider_id === drillKey.provider && monthKey(r.date) === drillKey.month);
  }, [drillKey, rows]);

  // Export structure
  const exportColumns = useMemo(() => [
    { header: "Courier", key: "courier" },
    ...months.map(mk => ({ header: monthLabel(mk), key: mk, align: "right" as const })),
    { header: "Total", key: "total", align: "right" as const },
  ], [months]);

  const exportData = useMemo(() => providerList.map(p => {
    const row: Record<string, any> = { courier: p.name };
    months.forEach(mk => { row[mk] = matrix[p.id]?.[mk] || 0; });
    row.total = providerTotals[p.id] || 0;
    return row;
  }), [providerList, months, matrix, providerTotals]);

  const totalsRow: Record<string, any> = { courier: "TOTAL" };
  months.forEach(mk => { totalsRow[mk] = monthTotals[mk] || 0; });
  totalsRow.total = grandTotal;

  const headerActions = (
    <ReportToolbar
      title="Courier Expenses"
      columns={exportColumns}
      rows={exportData}
      totalsRow={totalsRow}
      dateRange={{ from, to }}
      filters={[{ label: "Couriers", value: providerList.length ? `${providerList.length} couriers` : "All" }]}
    />
  );

  return (
    <AppLayout title="Courier Expenses" subtitle="Monthly transport spend by courier" headerActions={headerActions}>
      <div className="space-y-4">
        <Card className="glass-card"><CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div className="flex items-end gap-2 text-xs text-muted-foreground"><Truck className="h-4 w-4 text-primary"/> {providerList.length} couriers · {rows.length} expense lines</div>
        </CardContent></Card>

        <Card className="glass-card"><CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card">Courier</TableHead>
                {months.map(mk => <TableHead key={mk} className="text-right whitespace-nowrap">{monthLabel(mk)}</TableHead>)}
                <TableHead className="text-right font-bold">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={months.length + 2} className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 mx-auto animate-spin"/></TableCell></TableRow>
              ) : providerList.length === 0 ? (
                <TableRow><TableCell colSpan={months.length + 2} className="py-12 text-center text-muted-foreground">No courier-tagged expenses in this range. Record a transport expense and pick a courier.</TableCell></TableRow>
              ) : (
                <>
                  {providerList.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium sticky left-0 bg-card">{p.name}</TableCell>
                      {months.map(mk => {
                        const v = matrix[p.id]?.[mk] || 0;
                        return (
                          <TableCell key={mk} className={`text-right font-mono tabular-nums ${v ? "cursor-pointer hover:text-primary" : "text-muted-foreground"}`}
                            onClick={() => v && setDrillKey({ provider: p.id, month: mk })}>
                            {v ? fmt(v) : "—"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-mono tabular-nums font-bold">{fmt(providerTotals[p.id] || 0)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-bold">
                    <TableCell className="sticky left-0 bg-muted/40">TOTAL</TableCell>
                    {months.map(mk => <TableCell key={mk} className="text-right font-mono tabular-nums">{monthTotals[mk] ? fmt(monthTotals[mk]) : "—"}</TableCell>)}
                    <TableCell className="text-right font-mono tabular-nums">{fmt(grandTotal)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>

      <Dialog open={!!drillKey} onOpenChange={o => !o && setDrillKey(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {drillKey && `${providers.find(p => p.id === drillKey.provider)?.name} — ${monthLabel(drillKey.month)}`}
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Expense #</TableHead><TableHead>Description</TableHead>
              <TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {drillRows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{new Date(r.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                  <TableCell className="font-mono text-xs">{r.expense_number}</TableCell>
                  <TableCell>{r.description || "—"}</TableCell>
                  <TableCell className="capitalize text-xs">{r.payment_method.replace("_", " ")}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{fmt(Number(r.amount))}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/30">
                <TableCell colSpan={4}>Total</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{fmt(drillRows.reduce((s, r) => s + Number(r.amount), 0))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
