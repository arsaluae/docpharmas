import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MapPin, CheckCircle2, XCircle } from "lucide-react";

interface ProductCity {
  product_id: string;
  product_name: string;
  product_code: string | null;
  coveredCities: Set<string>;
}

export default function VacantAreas() {
  const [allCities, setAllCities] = useState<string[]>([]);
  const [productCities, setProductCities] = useState<ProductCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [custRes, cpRes, prodRes] = await Promise.all([
      supabase.from("customers").select("id, city"),
      supabase.from("customer_products").select("product_id, customer_id"),
      supabase.from("products").select("id, name, product_code"),
    ]);

    const customers = custRes.data || [];
    const custMap = new Map(customers.map(c => [c.id, c.city]));

    // Distinct non-null cities
    const cities = [...new Set(customers.map(c => c.city).filter(Boolean) as string[])].sort();
    setAllCities(cities);

    const prodMap = new Map((prodRes.data || []).map(p => [p.id, p]));

    // Build coverage per product
    const coverageMap = new Map<string, Set<string>>();
    (cpRes.data || []).forEach(cp => {
      const city = custMap.get(cp.customer_id);
      if (!city) return;
      if (!coverageMap.has(cp.product_id)) coverageMap.set(cp.product_id, new Set());
      coverageMap.get(cp.product_id)!.add(city);
    });

    // Only show products that have at least one allocation
    const result: ProductCity[] = [];
    coverageMap.forEach((covered, productId) => {
      const prod = prodMap.get(productId);
      if (prod) {
        result.push({
          product_id: productId,
          product_name: prod.name,
          product_code: prod.product_code,
          coveredCities: covered,
        });
      }
    });

    result.sort((a, b) => a.product_name.localeCompare(b.product_name));
    setProductCities(result);
    setLoading(false);
  };

  const filtered = productCities.filter(p =>
    !search ||
    p.product_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.product_code || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Vacant Area Analysis" subtitle="Identify cities without product coverage">
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : allCities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cities found in customer records.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No product allocations found.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {allCities.length} cities found across customers
            </p>

            {filtered.map(product => {
              const vacantCities = allCities.filter(c => !product.coveredCities.has(c));
              return (
                <Card key={product.product_id}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      {product.product_code && <span className="font-mono text-muted-foreground">{product.product_code}</span>}
                      {product.product_name}
                      <Badge variant="secondary" className="ml-2">
                        {product.coveredCities.size}/{allCities.length} covered
                      </Badge>
                      {vacantCities.length > 0 && (
                        <Badge variant="destructive" className="ml-1">
                          {vacantCities.length} vacant
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-0">
                    <div className="flex flex-wrap gap-2">
                      {allCities.map(city => {
                        const covered = product.coveredCities.has(city);
                        return (
                          <div
                            key={city}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${
                              covered
                                ? "bg-primary/10 text-primary border-primary/20"
                                : "bg-destructive/10 text-destructive border-destructive/20"
                            }`}
                          >
                            {covered ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {city}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
