import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Product {
  id: string; name: string; category: string; cost_price: number; selling_price: number;
}

export default function ProductCosting() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [catFilter, setCatFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"margin" | "name">("margin");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const { data } = await supabase.from("products").select("id, name, category, cost_price, selling_price");
    if (data) setProducts(data);
  };

  const categories = [...new Set(products.map(p => p.category))];

  const filtered = products
    .filter(p => catFilter === "all" || p.category === catFilter)
    .map(p => {
      const cost = Number(p.cost_price);
      const sell = Number(p.selling_price);
      const marginPct = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
      const markupPct = cost > 0 ? ((sell - cost) / cost) * 100 : 0;
      return { ...p, cost, sell, marginPct, markupPct };
    })
    .sort((a, b) => sortBy === "margin" ? b.marginPct - a.marginPct : a.name.localeCompare(b.name));

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-bold text-foreground font-heading flex-1">Product Costing</h1>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: "margin" | "name") => setSortBy(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="margin">Sort: Margin</SelectItem>
                <SelectItem value="name">Sort: Name</SelectItem>
              </SelectContent>
            </Select>
          </header>
          <div className="p-6">
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead><TableHead>Category</TableHead>
                      <TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Selling</TableHead>
                      <TableHead className="text-right">Margin %</TableHead><TableHead className="text-right">Markup %</TableHead>
                    </TableRow>
                  </TableHeader>
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
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
