import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download, MapPin, Search } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Inv { id: string; customer_id: string | null; total: number; date: string }
interface Cust { id: string; city: string | null; area: string | null; name: string }
interface Item { invoice_id: string; product_id: string | null; quantity: number; amount: number }
interface Prod { id: string; name: string }

export default function AreaWiseSales() {
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Array<{ area: string; city: string; revenue: number; orders: number; customers: number; topProduct: string }>>([]);
  const [allCities, setAllCities] = useState<string[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [invRes, custRes, prodRes] = await Promise.all([
      supabase.from("sales_invoices").select("id, customer_id, total, date").not("status", "in", "(draft,voided,cancelled)"),
      supabase.from("customers").select("id, city, area, name"),
      supabase.from("products").select("id, name"),
    ]);
    const invs = (invRes.data || []) as Inv[];
    const custs = (custRes.data || []) as Cust[];
    const prods = (prodRes.data || []) as Prod[];

    const custMap = new Map(custs.map(c => [c.id, c]));
    const prodMap = new Map(prods.map(p => [p.id, p.name]));

    // Items (chunked)
    const invIds = invs.map(i => i.id);
    const items: Item[] = [];
    for (let i = 0; i < invIds.length; i += 500) {
      const { data } = await supabase.from("sales_invoice_items")
        .select("invoice_id, product_id, quantity, amount").in("invoice_id", invIds.slice(i, i + 500));
      items.push(...((data || []) as Item[]));
    }
    const invToCust = new Map(invs.map(i => [i.id, i.customer_id || ""]));

    // area+city -> aggregate
    const agg = new Map<string, { area: string; city: string; revenue: number; orderIds: Set<string>; customerIds: Set<string>; productQty: Map<string, number> }>();

    invs.forEach(inv => {
      const c = inv.customer_id ? custMap.get(inv.customer_id) : null;
      const area = (c?.area || "(Unspecified)").trim() || "(Unspecified)";
      const city = (c?.city || "(Unspecified)").trim() || "(Unspecified)";
      const key = `${city}::${area}`;
      if (!agg.has(key)) agg.set(key, { area, city, revenue: 0, orderIds: new Set(), customerIds: new Set(), productQty: new Map() });
      const a = agg.get(key)!;
      a.revenue += Number(inv.total || 0);
      a.orderIds.add(inv.id);
      if (inv.customer_id) a.customerIds.add(inv.customer_id);
    });

    items.forEach(it => {
      const cid = invToCust.get(it.invoice_id);
      const c = cid ? custMap.get(cid) : null;
      const area = (c?.area || "(Unspecified)").trim() || "(Unspecified)";
      const city = (c?.city || "(Unspecified)").trim() || "(Unspecified)";
      const key = `${city}::${area}`;
      const a = agg.get(key);
      if (!a || !it.product_id) return;
      a.productQty.set(it.product_id, (a.productQty.get(it.product_id) || 0) + Number(it.quantity || 0));
    });

    const out = Array.from(agg.values()).map(a => {
      let topProduct = "—"; let topQty = -1;
      a.productQty.forEach((qty, pid) => { if (qty > topQty) { topQty = qty; topProduct = prodMap.get(pid) || "—"; } });
      return { area: a.area, city: a.city, revenue: a.revenue, orders: a.orderIds.size, customers: a.customerIds.size, topProduct };
    }).sort((x, y) => y.revenue - x.revenue);

    setData(out);
    setAllCities(Array.from(new Set(custs.map(c => (c.city || "").trim()).filter(Boolean))).sort());
    setLoading(false);
  };

  const filtered = useMemo(() => data.filter(r =>
    (!cityFilter || r.city === cityFilter) &&
    (!search || r.area.toLowerCase().includes(search.toLowerCase()) || r.city.toLowerCase().includes(search.toLowerCase()))
  ), [data, cityFilter, search]);

  const chartData = filtered.slice(0, 10).map(r => ({ name: `${r.area} (${r.city})`.slice(0, 24), revenue: Math.round(r.revenue) }));

  const exportCSV = () => {
    const rows = ["City,Area,Revenue,Orders,Customers,Top Product"];
    filtered.forEach(r => rows.push(`"${r.city}","${r.area}",${r.revenue.toFixed(2)},${r.orders},${r.customers},"${r.topProduct.replace(/"/g,'""')}"`));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `area-wise-sales-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const totalRev = filtered.reduce((s, r) => s + r.revenue, 0);

  return (
    <AppLayout title="Area-wise Sales" subtitle="Revenue, orders & top product per area (with city)">
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total Revenue</p>
            <p className="text-xl font-bold font-mono">PKR {Math.round(totalRev).toLocaleString()}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Areas</p>
            <p className="text-xl font-bold font-mono">{filtered.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Cities Active</p>
            <p className="text-xl font-bold font-mono">{new Set(filtered.map(r => r.city)).size}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Orders</p>
            <p className="text-xl font-bold font-mono">{filtered.reduce((s, r) => s + r.orders, 0).toLocaleString()}</p>
          </CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={cityFilter || "__all"} onValueChange={(v) => setCityFilter(v === "__all" ? "" : v)}>
            <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Filter city" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All cities</SelectItem>
              {allCities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search area or city…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
        </div>

        <Card>
          <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Top 10 Areas by Revenue</CardTitle></CardHeader>
          <CardContent className="px-2 pb-3 pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>City</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead className="text-right">Revenue (PKR)</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead>Top Product</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground"><MapPin className="h-6 w-6 mx-auto mb-2 opacity-40" />No sales data yet.</TableCell></TableRow>
                ) : filtered.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.city}</TableCell>
                    <TableCell className="font-medium">{r.area}</TableCell>
                    <TableCell className="text-right font-mono">{Math.round(r.revenue).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{r.orders}</TableCell>
                    <TableCell className="text-right font-mono">{r.customers}</TableCell>
                    <TableCell className="text-muted-foreground">{r.topProduct}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
