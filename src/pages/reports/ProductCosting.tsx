import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Product { id: string; name: string; category: string; cost_price: number; selling_price: number; }
interface CostRecord { reference_id: string; reference_type: string; cost_type: string; amount: number; }

export default function ProductCosting() {
  const [products, setProducts] = useState<Product[]>([]);
  const [allCosts, setAllCosts] = useState<CostRecord[]>([]);
  const [productCostMap, setProductCostMap] = useState<Record<string, Record<string, number>>>({});
  const [catFilter, setCatFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"margin" | "name" | "landed">("margin");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [prodRes, costsRes, poItemsRes, printJobsRes] = await Promise.all([
      supabase.from("products").select("id, name, category, cost_price, selling_price"),
      supabase.from("additional_costs").select("reference_id, reference_type, cost_type, amount"),
      supabase.from("purchase_order_items").select("po_id, product_id, amount"),
      supabase.from("print_jobs").select("id, product_id, total_cost").eq("status", "settled"),
    ]);
    if (prodRes.data) setProducts(prodRes.data);
    if (costsRes.data) setAllCosts(costsRes.data as any);

    // Build product → cost breakdown map
    // Strategy: for PO-linked costs, distribute proportionally among PO items
    // For print-job-linked costs, assign directly to the product
    const costMap: Record<string, Record<string, number>> = {};

    const addCost = (pid: string, type: string, amount: number) => {
      if (!costMap[pid]) costMap[pid] = {};
      costMap[pid][type] = (costMap[pid][type] || 0) + amount;
    };

    if (costsRes.data && poItemsRes.data) {
      // Group PO items by PO ID
      const poItemsByPo: Record<string, { product_id: string; amount: number }[]> = {};
      poItemsRes.data.forEach((item: any) => {
        if (!poItemsByPo[item.po_id]) poItemsByPo[item.po_id] = [];
        poItemsByPo[item.po_id].push({ product_id: item.product_id, amount: Number(item.amount) });
      });

      costsRes.data.forEach((c: any) => {
        if (c.reference_type === "purchase_order") {
          // Distribute cost proportionally among PO items
          const poItems = poItemsByPo[c.reference_id];
          if (poItems && poItems.length > 0) {
            const totalPoValue = poItems.reduce((s, i) => s + i.amount, 0);
            poItems.forEach(item => {
              if (item.product_id && totalPoValue > 0) {
                const share = (item.amount / totalPoValue) * Number(c.amount);
                addCost(item.product_id, c.cost_type, share);
              }
            });
          }
        } else if (c.reference_type === "print_job" && printJobsRes.data) {
          // Find the product for this print job
          const pj = printJobsRes.data.find((j: any) => j.id === c.reference_id);
          if (pj?.product_id) addCost(pj.product_id, c.cost_type, Number(c.amount));
        }
        // standalone costs — not linked to a specific product, skip
      });
    }


    setProductCostMap(costMap);
  };

  const categories = [...new Set(products.map(p => p.category))];

  const COST_TYPE_LABELS: Record<string, string> = {
    packaging: "Packaging", printing: "Printing", freight: "Freight",
    clearing: "Clearing", insurance: "Insurance", storage: "Storage",
    registration: "DRAP", testing: "Testing", other: "Other",
    freight_in: "Freight In", freight_out: "Freight Out",
  };

  const filtered = products
    .filter(p => catFilter === "all" || p.category === catFilter)
    .map(p => {
      const cost = Number(p.cost_price);
      const sell = Number(p.selling_price);
      const landedCosts = productCostMap[p.id] || {};
      const totalLanded = Object.values(landedCosts).reduce((s, v) => s + v, 0);
      const trueCost = cost + totalLanded;
      const marginPct = sell > 0 ? ((sell - trueCost) / sell) * 100 : 0;
      const markupPct = trueCost > 0 ? ((sell - trueCost) / trueCost) * 100 : 0;
      const rawMarginPct = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
      return { ...p, cost, sell, totalLanded, trueCost, marginPct, markupPct, rawMarginPct, landedCosts };
    })
    .sort((a, b) => {
      if (sortBy === "margin") return a.marginPct - b.marginPct; // lowest margin first (needs attention)
      if (sortBy === "landed") return b.totalLanded - a.totalLanded;
      return a.name.localeCompare(b.name);
    });

  const totalLandedAll = filtered.reduce((s, p) => s + p.totalLanded, 0);
  const avgMargin = filtered.length > 0 ? filtered.reduce((s, p) => s + p.marginPct, 0) / filtered.length : 0;

  const headerActions = (
    <>
      <Select value={catFilter} onValueChange={setCatFilter}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All Categories</SelectItem>{categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={(v: "margin" | "name" | "landed") => setSortBy(v)}>
        <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="margin">Sort: Margin ↑</SelectItem>
          <SelectItem value="landed">Sort: Landed Cost</SelectItem>
          <SelectItem value="name">Sort: Name</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <AppLayout title="Product Costing" subtitle="True landed cost analysis including freight, printing, packaging & other costs" headerActions={headerActions}>
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="glass-card bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Avg True Margin</p>
              <p className={`text-lg font-bold font-mono ${avgMargin >= 15 ? "text-primary" : avgMargin >= 0 ? "text-foreground" : "text-destructive"}`}>{avgMargin.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Landed Costs</p>
              <p className="text-lg font-bold font-mono text-foreground">PKR {totalLandedAll.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Products Analyzed</p>
              <p className="text-lg font-bold font-mono text-foreground">{filtered.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card"><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Base Cost</TableHead>
                <TableHead className="text-right">Landed Costs</TableHead>
                <TableHead className="text-right">True Cost</TableHead>
                <TableHead className="text-right">Selling</TableHead>
                <TableHead className="text-right">True Margin</TableHead>
                <TableHead className="text-right">Raw Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No products.</TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id} className={p.marginPct < 0 ? "bg-destructive/5" : p.marginPct < 10 ? "bg-warning/5" : ""}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{p.name}</span>
                      {p.totalLanded > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(p.landedCosts).map(([type, amt]) => (
                            <Badge key={type} variant="secondary" className="text-[9px] px-1 py-0">
                              {COST_TYPE_LABELS[type] || type}: {Number(amt).toLocaleString()}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{p.category}</TableCell>
                  <TableCell className="text-right font-mono">{p.cost.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-mono ${p.totalLanded > 0 ? "text-warning font-medium" : "text-muted-foreground"}`}>
                    {p.totalLanded > 0 ? `+${p.totalLanded.toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">{p.trueCost.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{p.sell.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-mono font-bold ${p.marginPct >= 20 ? "text-primary" : p.marginPct >= 0 ? "text-foreground" : "text-destructive"}`}>
                    {p.marginPct.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground text-xs">{p.rawMarginPct.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </AppLayout>
  );
}
