import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Package, Layers, ArrowDownUp, Truck, ShoppingCart, Tag, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveBatches, type ActiveBatch } from "@/lib/batches";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string | null;
  onEdit?: (productId: string) => void;
}

interface ProductFull {
  id: string; name: string; sku: string | null; category: string | null;
  unit: string | null; brand: string | null; manufacturer: string | null;
  pack_size: string | null; supplier_id: string | null;
  purchase_cost: number | null; cost_price: number | null;
  selling_price: number | null; mrp: number | null;
  stock_quantity: number | null; reorder_level: number | null; low_stock_level: number | null;
  is_active: boolean | null;
}

const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s); if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export function ProductDetailDrawer({ open, onOpenChange, productId, onEdit }: Props) {
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<ProductFull | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [batches, setBatches] = useState<ActiveBatch[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!open || !productId) return;
    setTab("overview");
    setLoading(true);

    (async () => {
      try {
        const [{ data: p }, b, { data: mv }, { data: pi }, { data: si }] = await Promise.all([
          supabase.from("products").select("*").eq("id", productId).maybeSingle(),
          getActiveBatches(productId),
          supabase.from("stock_movements")
            .select("id, movement_type, quantity, batch_number, date, notes, reference_type")
            .eq("product_id", productId).order("date", { ascending: false }).limit(100),
          supabase.from("purchase_invoices")
            .select("id, invoice_number, invoice_date, supplier_id, items:purchase_invoice_items!inner(product_id, quantity, rate, amount)")
            .eq("items.product_id", productId)
            .order("invoice_date", { ascending: false }).limit(50),
          supabase.from("sales_invoices")
            .select("id, invoice_number, invoice_date, customer_id, items:sales_invoice_items!inner(product_id, quantity, rate, amount)")
            .eq("items.product_id", productId)
            .order("invoice_date", { ascending: false }).limit(50),
        ]);

        setProduct((p as any) || null);
        setBatches(b);
        setMovements((mv as any[]) || []);
        setPurchases((pi as any[]) || []);
        setSales((si as any[]) || []);

        // Resolve supplier name
        if ((p as any)?.supplier_id) {
          const { data: sup } = await supabase.from("suppliers").select("name").eq("id", (p as any).supplier_id).maybeSingle();
          setSupplierName((sup as any)?.name || null);
        } else {
          setSupplierName(null);
        }

        // Price history — derived from recent purchase invoice item rates
        const ph = ((pi as any[]) || []).flatMap((inv: any) =>
          (inv.items || []).map((it: any) => ({
            date: inv.invoice_date, source: "Purchase " + inv.invoice_number,
            rate: it.rate,
          }))
        );
        setPriceHistory(ph);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, productId]);

  const landed = Number(product?.cost_price ?? 0);
  const purchase = Number(product?.purchase_cost ?? landed);
  const sale = Number(product?.selling_price ?? 0);
  const mrp = Number(product?.mrp ?? 0);
  const margin = landed > 0 && sale > 0 ? (((sale - landed) / landed) * 100).toFixed(1) + "%" : "—";

  const nearestExpiry = useMemo(() => {
    const withExpiry = batches.filter((b) => b.expiry_date);
    return withExpiry[0]?.expiry_date || null;
  }, [batches]);

  const typeBadge = (t: string) => {
    if (t.includes("in") || t === "opening" || t === "purchase") return <Badge className="bg-success/10 text-success border-0 capitalize">{t.replace("_", " ")}</Badge>;
    if (t.includes("out") || t === "sale" || t === "damage" || t === "expired") return <Badge variant="destructive" className="capitalize">{t.replace("_", " ")}</Badge>;
    return <Badge variant="secondary" className="capitalize">{t}</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="font-heading text-lg flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                {product?.name || "Loading…"}
              </SheetTitle>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                {product?.sku && <span className="font-mono">{product.sku}</span>}
                {product?.category && <span className="capitalize">{product.category}</span>}
                {product?.is_active === false && <Badge variant="outline" className="text-warning border-warning/40">Inactive</Badge>}
              </div>
            </div>
            {onEdit && productId && (
              <Button variant="outline" size="sm" onClick={() => onEdit(productId)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
              </Button>
            )}
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="mt-4">
            <TabsList className="w-full grid grid-cols-6 h-auto">
              <TabsTrigger value="overview" className="text-xs py-2">Overview</TabsTrigger>
              <TabsTrigger value="batches" className="text-xs py-2">Batches</TabsTrigger>
              <TabsTrigger value="movements" className="text-xs py-2">Movements</TabsTrigger>
              <TabsTrigger value="purchases" className="text-xs py-2">Purchases</TabsTrigger>
              <TabsTrigger value="sales" className="text-xs py-2">Sales</TabsTrigger>
              <TabsTrigger value="pricing" className="text-xs py-2">Pricing</TabsTrigger>
            </TabsList>

            {/* OVERVIEW */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Supplier" value={supplierName || "—"} />
                <Stat label="Brand" value={product?.brand || "—"} />
                <Stat label="Manufacturer" value={product?.manufacturer || "—"} />
                <Stat label="Pack size" value={product?.pack_size || "—"} />
                <Stat label="Unit" value={product?.unit || "—"} />
                <Stat label="Reorder level" value={fmt(product?.reorder_level ?? product?.low_stock_level)} mono />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Purchase cost" value={`PKR ${fmt(purchase)}`} mono />
                <Stat label="Landed cost" value={`PKR ${fmt(landed)}`} mono />
                <Stat label="Sale price" value={`PKR ${fmt(sale)}`} mono />
                <Stat label="MRP" value={mrp > 0 ? `PKR ${fmt(mrp)}` : "—"} mono />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Total stock" value={fmt(product?.stock_quantity)} mono accent />
                <Stat label="Active batches" value={fmt(batches.length)} mono />
                <Stat label="Nearest expiry" value={fmtDate(nearestExpiry)} />
                <Stat label="Markup %" value={margin} mono accent />
              </div>
            </TabsContent>

            {/* BATCHES */}
            <TabsContent value="batches" className="mt-4">
              {batches.length === 0 ? (
                <Empty icon={Layers} text="No active batches yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Mfg</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">On hand</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((b) => (
                      <TableRow key={b.batch_number}>
                        <TableCell className="font-mono text-xs">{b.batch_number}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(b.mfg_date)}</TableCell>
                        <TableCell className="text-xs">{fmtDate(b.expiry_date)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(b.on_hand)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={b.status === "expired" ? "destructive" : b.status === "expiring" ? "outline" : "secondary"} className="capitalize text-[10px]">
                            {b.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* MOVEMENTS */}
            <TabsContent value="movements" className="mt-4">
              {movements.length === 0 ? (
                <Empty icon={ArrowDownUp} text="No stock movements yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">{fmtDate(m.date)}</TableCell>
                        <TableCell>{typeBadge(m.movement_type)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(m.quantity)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{m.batch_number || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[280px]">{m.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* PURCHASES */}
            <TabsContent value="purchases" className="mt-4">
              {purchases.length === 0 ? (
                <Empty icon={Truck} text="No purchase history yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((inv: any) => {
                      const items = (inv.items || []).filter((it: any) => it.product_id === productId);
                      return items.map((it: any, idx: number) => (
                        <TableRow key={inv.id + "-" + idx}>
                          <TableCell className="text-xs">{fmtDate(inv.invoice_date)}</TableCell>
                          <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(it.quantity)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(it.rate)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmt(it.amount)}</TableCell>
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* SALES */}
            <TabsContent value="sales" className="mt-4">
              {sales.length === 0 ? (
                <Empty icon={ShoppingCart} text="No sales history yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((inv: any) => {
                      const items = (inv.items || []).filter((it: any) => it.product_id === productId);
                      return items.map((it: any, idx: number) => (
                        <TableRow key={inv.id + "-" + idx}>
                          <TableCell className="text-xs">{fmtDate(inv.invoice_date)}</TableCell>
                          <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(it.quantity)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(it.rate)}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmt(it.amount)}</TableCell>
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* PRICING */}
            <TabsContent value="pricing" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Purchase" value={`PKR ${fmt(purchase)}`} mono />
                <Stat label="Landed" value={`PKR ${fmt(landed)}`} mono />
                <Stat label="Sale" value={`PKR ${fmt(sale)}`} mono />
                <Stat label="MRP" value={mrp > 0 ? `PKR ${fmt(mrp)}` : "—"} mono />
              </div>
              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1"><Tag className="h-3 w-3" /> Recent purchase rates</h4>
                {priceHistory.length === 0 ? (
                  <Empty icon={Tag} text="No price history yet." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {priceHistory.slice(0, 20).map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{fmtDate(p.date)}</TableCell>
                          <TableCell className="text-xs font-mono">{p.source}</TableCell>
                          <TableCell className="text-right font-mono">PKR {fmt(p.rate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, mono, accent }: { label: string; value: any; mono?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono tabular-nums" : ""} ${accent ? "text-primary font-semibold" : ""} text-sm`}>{value}</div>
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="py-12 text-center text-muted-foreground text-sm">
      <Icon className="h-7 w-7 mx-auto mb-2 opacity-40" />
      {text}
    </div>
  );
}
