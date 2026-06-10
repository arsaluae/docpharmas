import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, CheckCircle2, XCircle, Download, AlertTriangle, Boxes } from "lucide-react";

interface Product { id: string; name: string; product_code: string | null; category: string | null }
interface Customer { id: string; city: string | null; area: string | null }

type Basis = "sales" | "allocation";

export default function VacantAreas() {
  const [loading, setLoading] = useState(true);
  const [basis, setBasis] = useState<Basis>("sales");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [productSearch, setProductSearch] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  // Map product_id -> Set of cities where it has activity
  const [coverage, setCoverage] = useState<Map<string, Set<string>>>(new Map());

  useEffect(() => { load(); }, [basis]);

  const load = async () => {
    setLoading(true);
    const [custRes, prodRes] = await Promise.all([
      supabase.from("customers").select("id, city, area"),
      supabase.from("products").select("id, name, product_code, category"),
    ]);
    const custs = (custRes.data || []) as Customer[];
    const prods = (prodRes.data || []) as Product[];
    const custCity = new Map<string, string>(custs.map(c => [c.id, (c.city || "").trim()]));

    const cov = new Map<string, Set<string>>();
    if (basis === "sales") {
      // Pull all sales invoices (id, customer_id) + items (invoice_id, product_id) in 2 calls
      const { data: invs } = await supabase.from("sales_invoices").select("id, customer_id").not("status", "in", "(draft,voided,cancelled)");
      const invMap = new Map<string, string>(); // invoice_id -> customer_id
      (invs || []).forEach((i: any) => { if (i.customer_id) invMap.set(i.id, i.customer_id); });
      const invIds = Array.from(invMap.keys());
      if (invIds.length) {
        // Batch through chunks of 500
        for (let i = 0; i < invIds.length; i += 500) {
          const chunk = invIds.slice(i, i + 500);
          const { data: items } = await supabase
            .from("sales_invoice_items").select("invoice_id, product_id").in("invoice_id", chunk);
          (items || []).forEach((it: any) => {
            const cid = invMap.get(it.invoice_id);
            const city = cid ? custCity.get(cid) : "";
            if (!it.product_id || !city) return;
            if (!cov.has(it.product_id)) cov.set(it.product_id, new Set());
            cov.get(it.product_id)!.add(city);
          });
        }
      }
    } else {
      // allocation basis
      const { data: cps } = await supabase.from("customer_products").select("product_id, customer_id");
      (cps || []).forEach((cp: any) => {
        const city = custCity.get(cp.customer_id);
        if (!cp.product_id || !city) return;
        if (!cov.has(cp.product_id)) cov.set(cp.product_id, new Set());
        cov.get(cp.product_id)!.add(city);
      });
    }

    setProducts(prods);
    setCustomers(custs);
    setCoverage(cov);
    setLoading(false);
  };

  const allCities = useMemo(() => {
    const s = new Set<string>();
    customers.forEach(c => { if (c.city && c.city.trim()) s.add(c.city.trim()); });
    return Array.from(s).sort();
  }, [customers]);

  const cityList = cityFilter ? allCities.filter(c => c === cityFilter) : allCities;

  // BY PRODUCT view: for each product, which cities are vacant
  const byProduct = useMemo(() => {
    return products
      .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.product_code || "").toLowerCase().includes(productSearch.toLowerCase()))
      .map(p => {
        const covered = coverage.get(p.id) || new Set<string>();
        const vacant = cityList.filter(c => !covered.has(c));
        return { product: p, covered, vacant };
      })
      .sort((a, b) => b.vacant.length - a.vacant.length);
  }, [products, coverage, cityList, productSearch]);

  // BY CITY view: for each city, which products are missing
  const byCity = useMemo(() => {
    return cityList.map(city => {
      const missing = products.filter(p => !(coverage.get(p.id)?.has(city)));
      return { city, missing };
    }).sort((a, b) => b.missing.length - a.missing.length);
  }, [cityList, products, coverage]);

  // KPIs
  const totalPairs = allCities.length * products.length;
  const vacantPairs = byProduct.reduce((s, x) => s + x.vacant.length, 0);
  const topUnderserved = byCity.slice(0, 5);
  const weakestProducts = byProduct.slice(0, 5);

  const exportCSV = () => {
    const rows: string[] = ["Product Code,Product,City,Status"];
    byProduct.forEach(({ product, covered }) => {
      cityList.forEach(city => {
        rows.push(`"${product.product_code || ""}","${product.name.replace(/"/g,'""')}","${city}","${covered.has(city) ? "Covered" : "Vacant"}"`);
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vacant-areas-${basis}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <AppLayout title="Vacant Areas" subtitle="Find cities & products with no coverage — based on sales or allocations">
      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Cities</p>
            <p className="text-2xl font-bold font-mono">{allCities.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Products</p>
            <p className="text-2xl font-bold font-mono">{products.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total Pairs</p>
            <p className="text-2xl font-bold font-mono">{totalPairs.toLocaleString()}</p>
          </CardContent></Card>
          <Card className="border-destructive/30"><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-destructive font-bold flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Vacant Pairs</p>
            <p className="text-2xl font-bold font-mono text-destructive">{vacantPairs.toLocaleString()}</p>
          </CardContent></Card>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Coverage based on:</span>
            <Select value={basis} onValueChange={(v: Basis) => setBasis(v)}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Actual Sales</SelectItem>
                <SelectItem value="allocation">Allocations</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={cityFilter || "__all"} onValueChange={(v) => setCityFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Filter city" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All cities</SelectItem>
              {allCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search product…" value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
        </div>

        <Tabs defaultValue="by-product">
          <TabsList>
            <TabsTrigger value="by-product">By Product</TabsTrigger>
            <TabsTrigger value="by-city">By City</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="by-product" className="space-y-3 mt-4">
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> :
              byProduct.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> :
              byProduct.map(({ product, covered, vacant }) => (
                <Card key={product.id}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium flex flex-wrap items-center gap-2">
                      {product.product_code && <span className="font-mono text-muted-foreground">{product.product_code}</span>}
                      {product.name}
                      <Badge variant="secondary">{covered.size}/{cityList.length} covered</Badge>
                      {vacant.length > 0 && <Badge variant="destructive">{vacant.length} vacant</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {cityList.map(city => {
                        const ok = covered.has(city);
                        return (
                          <div key={city} className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border ${ok ? "bg-primary/10 text-primary border-primary/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                            {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{city}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </TabsContent>

          <TabsContent value="by-city" className="space-y-3 mt-4">
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> :
              byCity.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> :
              byCity.map(({ city, missing }) => (
                <Card key={city}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium flex flex-wrap items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-primary" /> {city}
                      <Badge variant="secondary">{products.length - missing.length}/{products.length} sold</Badge>
                      {missing.length > 0 && <Badge variant="destructive">{missing.length} missing</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-0">
                    {missing.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Full catalog covered here.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {missing
                          .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))
                          .slice(0, 80).map(p => (
                          <span key={p.id} className="text-[11px] px-2 py-0.5 rounded-md border bg-muted/40 text-foreground/80 flex items-center gap-1">
                            <Boxes className="h-3 w-3" />{p.product_code ? `${p.product_code} · ` : ""}{p.name}
                          </span>
                        ))}
                        {missing.length > 80 && <span className="text-[10px] text-muted-foreground self-center">+{missing.length - 80} more…</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
          </TabsContent>

          <TabsContent value="summary" className="mt-4 grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Top 5 Underserved Cities</CardTitle></CardHeader>
              <CardContent className="px-4 pb-3 pt-0 space-y-2">
                {topUnderserved.map(c => (
                  <div key={c.city} className="flex items-center justify-between text-sm">
                    <span>{c.city}</span>
                    <Badge variant="destructive">{c.missing.length} products missing</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Top 5 Products With Weakest Reach</CardTitle></CardHeader>
              <CardContent className="px-4 pb-3 pt-0 space-y-2">
                {weakestProducts.map(p => (
                  <div key={p.product.id} className="flex items-center justify-between text-sm">
                    <span>{p.product.name}</span>
                    <Badge variant="destructive">{p.vacant.length} cities vacant</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
