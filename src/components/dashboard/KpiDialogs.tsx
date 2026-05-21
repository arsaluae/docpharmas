import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

const fmt = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

interface SalesRow { id: string; invoice_number: string; date: string; customer: string; total: number; }

function SalesListDialog({
  open, onOpenChange, title, description, fromDate, toDate,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  title: string; description: string; fromDate: string; toDate: string;
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: invs } = await supabase
        .from("sales_invoices")
        .select("id, invoice_number, date, total, customer_id")
        .gte("date", fromDate).lte("date", toDate)
        .order("date", { ascending: false });
      const custIds = Array.from(new Set((invs || []).map((i: any) => i.customer_id).filter(Boolean)));
      const custMap: Record<string, string> = {};
      if (custIds.length) {
        const { data: custs } = await supabase.from("customers").select("id, name").in("id", custIds);
        (custs || []).forEach((c: any) => { custMap[c.id] = c.name; });
      }
      setRows((invs || []).map((i: any) => ({
        id: i.id,
        invoice_number: i.invoice_number,
        date: i.date,
        customer: custMap[i.customer_id] || "—",
        total: Number(i.total),
      })));
      setLoading(false);
    })();
  }, [open, fromDate, toDate]);

  const total = rows.reduce((s, r) => s + r.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No invoices in this period</p>
        ) : (
          <>
            <div className="flex justify-between items-center text-xs text-muted-foreground pb-2 border-b">
              <span>{rows.length} invoice{rows.length !== 1 ? "s" : ""}</span>
              <span className="font-mono font-semibold text-foreground">Total: {fmt(total)}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/60"
                    onClick={() => { onOpenChange(false); navigate(`/proforma?open=${encodeURIComponent(r.invoice_number)}`); }}
                  >
                    <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                    <TableCell className="text-xs">{r.date}</TableCell>
                    <TableCell className="text-sm">{r.customer}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">{fmt(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WeekSalesDialog(p: { open: boolean; onOpenChange: (v: boolean) => void; from: string; to: string; }) {
  return <SalesListDialog open={p.open} onOpenChange={p.onOpenChange} title="This Week's Sales" description="All sales invoices from this week" fromDate={p.from} toDate={p.to} />;
}

export function MonthSalesDialog(p: { open: boolean; onOpenChange: (v: boolean) => void; from: string; to: string; }) {
  return <SalesListDialog open={p.open} onOpenChange={p.onOpenChange} title="This Month's Sales" description="All sales invoices from this month" fromDate={p.from} toDate={p.to} />;
}

// ── Gross Margin Dialog ──
interface GpRow { product: string; qty: number; revenue: number; cogs: number; gp: number; gpPct: number; }

export function GrossMarginDialog({
  open, onOpenChange, monthStart, monthEnd,
}: { open: boolean; onOpenChange: (v: boolean) => void; monthStart: string; monthEnd: string; }) {
  const [rows, setRows] = useState<GpRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: invs } = await supabase
        .from("sales_invoices").select("id").gte("date", monthStart).lte("date", monthEnd);
      const ids = (invs || []).map((i: any) => i.id);
      let items: any[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const { data } = await supabase.from("sales_invoice_items")
          .select("product_id, quantity, amount").in("invoice_id", ids.slice(i, i + 50));
        items = items.concat(data || []);
      }
      const { data: prods } = await supabase.from("products").select("id, name, cost_price");
      const pmap: Record<string, { name: string; cost: number }> = {};
      (prods || []).forEach((p: any) => { pmap[p.id] = { name: p.name, cost: Number(p.cost_price) }; });

      const agg: Record<string, GpRow> = {};
      items.forEach(it => {
        if (!it.product_id) return;
        const p = pmap[it.product_id];
        if (!p) return;
        const qty = Number(it.quantity);
        const rev = Number(it.amount);
        const cogs = qty * p.cost;
        if (!agg[it.product_id]) agg[it.product_id] = { product: p.name, qty: 0, revenue: 0, cogs: 0, gp: 0, gpPct: 0 };
        agg[it.product_id].qty += qty;
        agg[it.product_id].revenue += rev;
        agg[it.product_id].cogs += cogs;
      });
      const arr = Object.values(agg).map(r => ({
        ...r, gp: r.revenue - r.cogs, gpPct: r.revenue > 0 ? ((r.revenue - r.cogs) / r.revenue) * 100 : 0,
      })).sort((a, b) => b.gp - a.gp);
      setRows(arr);
      setLoading(false);
    })();
  }, [open, monthStart, monthEnd]);

  const tot = rows.reduce((s, r) => ({ rev: s.rev + r.revenue, cogs: s.cogs + r.cogs, gp: s.gp + r.gp }), { rev: 0, cogs: 0, gp: 0 });
  const totPct = tot.rev > 0 ? (tot.gp / tot.rev) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gross Profit — This Month</DialogTitle>
          <DialogDescription>Per-product breakdown of revenue, cost of goods sold, and gross profit</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No sales data this month</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3 py-3 border-b">
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</p><p className="font-mono font-semibold">{fmt(tot.rev)}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">COGS</p><p className="font-mono font-semibold">{fmt(tot.cogs)}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gross Profit</p><p className="font-mono font-semibold text-primary">{fmt(tot.gp)}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">GP %</p><p className="font-mono font-semibold text-primary">{totPct.toFixed(1)}%</p></div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">GP</TableHead>
                  <TableHead className="text-right">GP %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{r.product}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.qty}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt(r.revenue)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt(r.cogs)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${r.gp >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(r.gp)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${r.gpPct >= 0 ? "text-primary" : "text-destructive"}`}>{r.gpPct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Upcoming Purchase Orders ──
interface PoRow { id: string; po_number: string; date: string; supplier: string; total: number; status: string; }

export function UpcomingOrdersDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void; }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PoRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: pos } = await supabase
        .from("purchase_proformas")
        .select("id, proforma_number, date, total, supplier_id, status")
        .in("status", ["draft", "ordered", "confirmed", "sent"])
        .order("date", { ascending: true });
      const supIds = Array.from(new Set((pos || []).map((p: any) => p.supplier_id).filter(Boolean)));
      const supMap: Record<string, string> = {};
      if (supIds.length) {
        const { data: sups } = await supabase.from("suppliers").select("id, name").in("id", supIds);
        (sups || []).forEach((s: any) => { supMap[s.id] = s.name; });
      }
      setRows((pos || []).map((p: any) => ({
        id: p.id, po_number: p.proforma_number, date: p.date,
        supplier: supMap[p.supplier_id] || "—", total: Number(p.total), status: p.status,
      })));
      setLoading(false);
    })();
  }, [open]);

  const total = rows.reduce((s, r) => s + r.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upcoming Purchase Orders</DialogTitle>
          <DialogDescription>Open purchase orders pending receipt or payment</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No upcoming orders</p>
        ) : (
          <>
            <div className="flex justify-between items-center text-xs text-muted-foreground pb-2 border-b">
              <span>{rows.length} order{rows.length !== 1 ? "s" : ""}</span>
              <span className="font-mono font-semibold text-foreground">Total: {fmt(total)}</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/60"
                    onClick={() => { onOpenChange(false); navigate(`/purchase-proforma?open=${encodeURIComponent(r.po_number)}`); }}
                  >
                    <TableCell className="font-mono text-xs">{r.po_number}</TableCell>
                    <TableCell className="text-xs">{r.date}</TableCell>
                    <TableCell className="text-sm">{r.supplier}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge></TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-sm">{fmt(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
