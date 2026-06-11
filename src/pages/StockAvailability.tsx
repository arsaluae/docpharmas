import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Package, AlertTriangle } from "lucide-react";

type Stock = {
  product_id: string;
  product_code: string | null;
  name: string;
  category: string | null;
  brand: string | null;
  unit: string | null;
  pack_size: string | null;
  selling_price: number | null;
  mrp: number | null;
  available_qty: number;
  reorder_level: number | null;
  stock_status: "out" | "low" | "ok";
};

type Batch = {
  product_id: string;
  product_code: string | null;
  product_name: string;
  batch_number: string | null;
  expiry_date: string | null;
  available_qty: number;
  expiry_status: "none" | "expired" | "critical" | "warning" | "ok";
  selling_price: number | null;
};

const expiryBadge = (s: Batch["expiry_status"]) => {
  switch (s) {
    case "expired":  return <Badge variant="destructive" className="text-[10px]">Expired</Badge>;
    case "critical": return <Badge className="text-[10px] bg-destructive/15 text-destructive border-destructive/30" variant="outline">≤ 30 days</Badge>;
    case "warning":  return <Badge className="text-[10px] bg-amber-500/15 text-amber-600 border-amber-500/30" variant="outline">≤ 90 days</Badge>;
    default:         return <span className="text-[11px] text-muted-foreground">—</span>;
  }
};

const stockBadge = (s: Stock["stock_status"]) => {
  if (s === "out") return <Badge variant="destructive" className="text-[10px]">Out</Badge>;
  if (s === "low") return <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">Low</Badge>;
  return <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">OK</Badge>;
};

export default function StockAvailability() {
  const [rows, setRows] = useState<Stock[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    setLoading(true);
    const [{ data: stockData }, { data: batchData }] = await Promise.all([
      supabase.from("agent_stock_availability" as any).select("*").order("name"),
      supabase.from("agent_batch_availability" as any).select("*").gt("available_qty", 0).order("expiry_date", { ascending: true }),
    ]);
    setRows((stockData as any[]) ?? []);
    setBatches((batchData as any[]) ?? []);
    setLoading(false);
  })(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.name.toLowerCase().includes(q)
      || (r.product_code ?? "").toLowerCase().includes(q)
      || (r.brand ?? "").toLowerCase().includes(q)
      || (r.category ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const filteredBatches = useMemo(() => {
    const ids = new Set(filtered.map(r => r.product_id));
    return batches.filter(b => ids.has(b.product_id));
  }, [filtered, batches]);

  const lowCount = rows.filter(r => r.stock_status !== "ok").length;
  const expiringCount = batches.filter(b => b.expiry_status === "critical" || b.expiry_status === "expired").length;

  return (
    <AppLayout title="Stock Availability" subtitle="Check what you can sell — batch, expiry, price">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Package className="h-5 w-5 text-primary"/></div>
            <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Products</div>
              <div className="text-lg font-bold tabular-nums">{rows.length}</div></div>
          </CardContent></Card>
          <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-amber-600"/></div>
            <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Low / Out of Stock</div>
              <div className="text-lg font-bold tabular-nums">{lowCount}</div></div>
          </CardContent></Card>
          <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-destructive"/></div>
            <div><div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Expired / Expiring ≤30d</div>
              <div className="text-lg font-bold tabular-nums">{expiringCount}</div></div>
          </CardContent></Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search product, code, brand..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card className="glass-card"><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Brand / Category</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Sale Price</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No products match.</TableCell></TableRow>
              ) : filtered.map(r => (
                <TableRow key={r.product_id}>
                  <TableCell className="font-mono text-xs">{r.product_code ?? "—"}</TableCell>
                  <TableCell className="font-medium">{r.name}{r.pack_size ? <span className="text-muted-foreground"> · {r.pack_size}</span> : null}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{[r.brand, r.category].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{Number(r.available_qty || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r.selling_price ? `PKR ${Number(r.selling_price).toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{r.mrp ? `PKR ${Number(r.mrp).toLocaleString()}` : "—"}</TableCell>
                  <TableCell>{stockBadge(r.stock_status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>

        {filteredBatches.length > 0 && (
          <>
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground pt-2">Batch Availability</div>
            <Card className="glass-card"><CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.map((b, i) => (
                    <TableRow key={`${b.product_id}-${b.batch_number}-${i}`}>
                      <TableCell className="font-mono text-xs">{b.product_code ?? "—"}</TableCell>
                      <TableCell className="font-medium">{b.product_name}</TableCell>
                      <TableCell className="font-mono text-xs">{b.batch_number ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{b.expiry_date ? new Date(b.expiry_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{Number(b.available_qty).toLocaleString()}</TableCell>
                      <TableCell>{expiryBadge(b.expiry_status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
