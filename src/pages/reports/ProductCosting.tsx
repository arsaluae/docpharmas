import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Product { id: string; name: string; category: string; cost_price: number; selling_price: number; }

export default function ProductCosting() {
  const [products, setProducts] = useState<Product[]>([]);
  const [catFilter, setCatFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"margin" | "name">("margin");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await supabase.from("products").select("id, name, category, cost_price, selling_price");
    if (data) setProducts(data);
  };

  const categories = [...new Set(products.map(p => p.category))];
  const filtered = products
    .filter(p => catFilter === "all" || p.category === catFilter)
    .map(p => { const cost = Number(p.cost_price); const sell = Number(p.selling_price); const marginPct = sell > 0 ? ((sell - cost) / sell) * 100 : 0; const markupPct = cost > 0 ? ((sell - cost) / cost) * 100 : 0; return { ...p, cost, sell, marginPct, markupPct }; })
    .sort((a, b) => sortBy === "margin" ? b.marginPct - a.marginPct : a.name.localeCompare(b.name));

  const headerActions = (
    <>
      <Select value={catFilter} onValueChange={setCatFilter}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">All</SelectItem>{categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={(v: "margin" | "name") => setSortBy(v)}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="margin">Sort: Margin</SelectItem><SelectItem value="name">Sort: Name</SelectItem></SelectContent>
      </Select>
    </>
  );

  return (
    <AppLayout title="Product Costing" headerActions={headerActions}>
      <Card className="glass-card"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Selling</TableHead><TableHead className="text-right">Margin %</TableHead><TableHead className="text-right">Markup %</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No products.</TableCell></TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{p.category}</TableCell>
                <TableCell className="text-right font-mono">{p.cost.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono">{p.sell.toLocaleString()}</TableCell>
                <TableCell className={`text-right font-mono font-medium ${p.marginPct >= 20 ? "text-primary" : p.marginPct >= 0 ? "text-foreground" : "text-destructive"}`}>{p.marginPct.toFixed(1)}%</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{p.markupPct.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </AppLayout>
  );
}
