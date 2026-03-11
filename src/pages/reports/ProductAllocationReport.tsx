import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

interface AllocationRow {
  product_id: string;
  product_name: string;
  product_code: string | null;
  party_id: string;
  party_name: string;
  party_type: "customer" | "supplier";
  rate: number;
  city: string | null;
}

export default function ProductAllocationReport() {
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [cpRes, spRes, prodRes, custRes, suppRes] = await Promise.all([
      supabase.from("customer_products").select("product_id, customer_id, rate"),
      supabase.from("supplier_products").select("product_id, supplier_id, rate"),
      supabase.from("products").select("id, name, product_code"),
      supabase.from("customers").select("id, name, city"),
      supabase.from("suppliers").select("id, name, city"),
    ]);

    const prodMap = new Map((prodRes.data || []).map(p => [p.id, p]));
    const custMap = new Map((custRes.data || []).map(c => [c.id, c]));
    const suppMap = new Map((suppRes.data || []).map(s => [s.id, s]));

    const allRows: AllocationRow[] = [];

    (cpRes.data || []).forEach(cp => {
      const prod = prodMap.get(cp.product_id);
      const cust = custMap.get(cp.customer_id);
      if (prod && cust) {
        allRows.push({
          product_id: cp.product_id,
          product_name: prod.name,
          product_code: prod.product_code,
          party_id: cp.customer_id,
          party_name: cust.name,
          party_type: "customer",
          rate: cp.rate || 0,
          city: cust.city,
        });
      }
    });

    (spRes.data || []).forEach(sp => {
      const prod = prodMap.get(sp.product_id);
      const supp = suppMap.get(sp.supplier_id);
      if (prod && supp) {
        allRows.push({
          product_id: sp.product_id,
          product_name: prod.name,
          product_code: prod.product_code,
          party_id: sp.supplier_id,
          party_name: supp.name,
          party_type: "supplier",
          rate: sp.rate || 0,
          city: supp.city,
        });
      }
    });

    setRows(allRows);
    setLoading(false);
  };

  const filtered = rows.filter(r =>
    !search || r.product_name.toLowerCase().includes(search.toLowerCase()) ||
    r.party_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.product_code || "").toLowerCase().includes(search.toLowerCase())
  );

  // Group by product
  const byProduct = new Map<string, AllocationRow[]>();
  filtered.forEach(r => {
    if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, []);
    byProduct.get(r.product_id)!.push(r);
  });

  // Group by party
  const byParty = new Map<string, AllocationRow[]>();
  filtered.forEach(r => {
    const key = `${r.party_type}-${r.party_id}`;
    if (!byParty.has(key)) byParty.set(key, []);
    byParty.get(key)!.push(r);
  });

  return (
    <AppLayout title="Product Allocation Report" subtitle="Which products are allocated to which parties">
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product, customer or supplier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs defaultValue="by-product">
          <TabsList>
            <TabsTrigger value="by-product">By Product</TabsTrigger>
            <TabsTrigger value="by-party">By Customer / Supplier</TabsTrigger>
          </TabsList>

          <TabsContent value="by-product" className="space-y-3 mt-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : byProduct.size === 0 ? (
              <p className="text-sm text-muted-foreground">No allocations found.</p>
            ) : (
              Array.from(byProduct.entries()).map(([productId, items]) => (
                <Card key={productId}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">
                      {items[0].product_code && <span className="font-mono text-muted-foreground mr-2">{items[0].product_code}</span>}
                      {items[0].product_name}
                      <Badge variant="secondary" className="ml-2">{items.length} parties</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Party</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{item.party_name}</TableCell>
                            <TableCell>
                              <Badge variant={item.party_type === "customer" ? "default" : "outline"} className="text-xs capitalize">
                                {item.party_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.city || "—"}</TableCell>
                            <TableCell className="text-right text-sm">{item.rate > 0 ? item.rate.toLocaleString() : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="by-party" className="space-y-3 mt-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : byParty.size === 0 ? (
              <p className="text-sm text-muted-foreground">No allocations found.</p>
            ) : (
              Array.from(byParty.entries()).map(([key, items]) => (
                <Card key={key}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      {items[0].party_name}
                      <Badge variant={items[0].party_type === "customer" ? "default" : "outline"} className="text-xs capitalize">
                        {items[0].party_type}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{items[0].city || ""}</span>
                      <Badge variant="secondary" className="ml-auto">{items.length} products</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono text-muted-foreground">{item.product_code || "—"}</TableCell>
                            <TableCell className="text-sm">{item.product_name}</TableCell>
                            <TableCell className="text-right text-sm">{item.rate > 0 ? item.rate.toLocaleString() : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
