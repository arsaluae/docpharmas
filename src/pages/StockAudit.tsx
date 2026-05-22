import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Search, AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { fetchAllRows } from "@/lib/batch-fetch";

const IN_TYPES = new Set(["purchase", "purchase_in", "return_in", "adjustment_in", "opening"]);
const OUT_TYPES = new Set(["sale", "sale_out", "return_out", "adjustment_out", "damage", "expired"]);

interface Row {
  id: string;
  name: string;
  sku: string | null;
  live: number;
  derived: number;
  variance: number;
}

export default function StockAudit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyVariance, setOnlyVariance] = useState(true);
  const [fixing, setFixing] = useState(false);
  const { isAdmin } = useUserRole();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [products, movements] = await Promise.all([
      fetchAllRows("products", "id, name, sku, stock_quantity"),
      fetchAllRows("stock_movements", "product_id, quantity, movement_type"),
    ]);
    const derivedMap: Record<string, number> = {};
    movements.forEach((m: any) => {
      if (!m.product_id) return;
      const q = Number(m.quantity);
      if (IN_TYPES.has(m.movement_type)) derivedMap[m.product_id] = (derivedMap[m.product_id] || 0) + q;
      else if (OUT_TYPES.has(m.movement_type)) derivedMap[m.product_id] = (derivedMap[m.product_id] || 0) - q;
    });
    const list: Row[] = products.map((p: any) => {
      const live = Number(p.stock_quantity);
      const derived = derivedMap[p.id] || 0;
      return { id: p.id, name: p.name, sku: p.sku, live, derived, variance: live - derived };
    });
    list.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    setRows(list);
    setLoading(false);
  };

  const filtered = rows.filter(r => {
    if (onlyVariance && Math.abs(r.variance) < 0.001) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !(r.sku || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalVar = rows.filter(r => Math.abs(r.variance) >= 0.001).length;
  const exactMatch = rows.length - totalVar;

  const fixRow = async (r: Row) => {
    if (!isAdmin) { toast.error("Admin only"); return; }
    setFixing(true);
    const { error } = await supabase.from("products").update({ stock_quantity: r.derived }).eq("id", r.id);
    if (error) { toast.error("Failed to fix"); setFixing(false); return; }
    await supabase.from("stock_audit_log").insert({
      product_id: r.id, old_quantity: r.live, new_quantity: r.derived,
      variance: r.variance, reason: "Manual recalculation from stock_movements",
    });
    toast.success(`${r.name} reconciled (${r.live} → ${r.derived})`);
    setFixing(false); load();
  };

  return (
    <AppLayout title="Stock Audit" subtitle="Cross-check live product stock vs derived stock from movements">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center"><ShieldCheck className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Products Checked</p><p className="text-lg font-bold font-mono">{rows.length}</p></div>
          </CardContent></Card>
          <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
            <div><p className="text-xs text-muted-foreground">Reconciled</p><p className="text-lg font-bold font-mono text-emerald-600">{exactMatch}</p></div>
          </CardContent></Card>
          <Card className={`glass-card ${totalVar > 0 ? "border-destructive/30" : ""}`}><CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/15 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">Variances</p><p className="text-lg font-bold font-mono text-destructive">{totalVar}</p></div>
          </CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="only-var" checked={onlyVariance} onCheckedChange={setOnlyVariance} />
            <Label htmlFor="only-var" className="text-sm">Only show variances</Label>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />} Refresh
          </Button>
        </div>

        <Card className="glass-card"><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead><TableHead>SKU</TableHead>
                <TableHead className="text-right">Live Stock</TableHead>
                <TableHead className="text-right">Derived (from movements)</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Fix</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 mx-auto animate-spin" /></TableCell></TableRow>
                : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground"><CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />{onlyVariance ? "All stock reconciled — no variances." : "No products."}</TableCell></TableRow>
                : filtered.map(r => (
                  <TableRow key={r.id} className={Math.abs(r.variance) >= 0.001 ? "bg-destructive/5" : ""}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{r.sku || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{r.live.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{r.derived.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${Math.abs(r.variance) >= 0.001 ? "text-destructive" : "text-emerald-600"}`}>
                      {r.variance > 0 ? "+" : ""}{r.variance.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {Math.abs(r.variance) < 0.001
                        ? <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">OK</Badge>
                        : <Badge variant="destructive">Mismatch</Badge>}
                    </TableCell>
                    <TableCell className="text-center">
                      {Math.abs(r.variance) >= 0.001 && (
                        <Button size="sm" variant="outline" disabled={!isAdmin || fixing} onClick={() => fixRow(r)} className="h-7 text-xs">
                          Reconcile
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent></Card>
        {!isAdmin && <p className="text-xs text-muted-foreground">Reconciliation is admin-only. Contact your administrator to fix variances.</p>}
      </div>
    </AppLayout>
  );
}
