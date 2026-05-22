import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAllRows } from "@/lib/batch-fetch";
import { MapPin, Search, Users, TrendingUp, Package } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Customer { id: string; city: string | null; }
interface Invoice { id: string; customer_id: string | null; subtotal: number; date: string; }
interface InvoiceItem { invoice_id: string; product_id: string | null; quantity: number; amount: number; }
interface Product { id: string; name: string; }

export default function CitywiseSales() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    setLoading(true);
    const [c, inv, it, p] = await Promise.all([
      fetchAllRows("customers", "id, city"),
      fetchAllRows("sales_invoices", "id, customer_id, subtotal, date"),
      fetchAllRows("sales_invoice_items", "invoice_id, product_id, quantity, amount"),
      fetchAllRows("products", "id, name"),
    ]);
    setCustomers(c); setInvoices(inv); setItems(it); setProducts(p);
    setLoading(false);
  })(); }, []);

  const rows = useMemo(() => {
    const custCity = new Map<string, string>();
    customers.forEach(c => custCity.set(c.id, (c.city || "Unspecified").trim() || "Unspecified"));
    const prodName = new Map<string, string>();
    products.forEach(p => prodName.set(p.id, p.name));

    const invCity = new Map<string, string>();
    invoices.forEach(i => invCity.set(i.id, i.customer_id ? (custCity.get(i.customer_id) || "Unspecified") : "Unspecified"));

    // city -> aggregate
    const map = new Map<string, { city: string; revenue: number; orders: number; customerIds: Set<string>; productQty: Map<string, number> }>();
    invoices.forEach(i => {
      const city = invCity.get(i.id) || "Unspecified";
      const cur = map.get(city) || { city, revenue: 0, orders: 0, customerIds: new Set<string>(), productQty: new Map() };
      cur.revenue += Number(i.subtotal || 0);
      cur.orders += 1;
      if (i.customer_id) cur.customerIds.add(i.customer_id);
      map.set(city, cur);
    });
    items.forEach(it => {
      const city = invCity.get(it.invoice_id) || "Unspecified";
      const cur = map.get(city);
      if (!cur || !it.product_id) return;
      cur.productQty.set(it.product_id, (cur.productQty.get(it.product_id) || 0) + Number(it.quantity || 0));
    });

    return Array.from(map.values()).map(r => {
      let topProd = "—"; let topQty = 0;
      r.productQty.forEach((q, pid) => { if (q > topQty) { topQty = q; topProd = prodName.get(pid) || "—"; } });
      return { city: r.city, revenue: r.revenue, orders: r.orders, customers: r.customerIds.size, avgOrder: r.orders ? r.revenue / r.orders : 0, topProduct: topProd };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [customers, invoices, items, products]);

  const filtered = rows.filter(r => r.city.toLowerCase().includes(search.toLowerCase()));
  const totals = filtered.reduce((s, r) => ({ revenue: s.revenue + r.revenue, orders: s.orders + r.orders, customers: s.customers + r.customers }), { revenue: 0, orders: 0, customers: 0 });
  const top10 = rows.slice(0, 10).map(r => ({ name: r.city, revenue: Math.round(r.revenue) }));

  return (
    <AppLayout title="City-wise Sales" subtitle="Geographic revenue, orders & top products per city">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><MapPin className="h-4 w-4 text-primary" /></div><div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Cities</p><p className="text-lg font-bold font-mono">{rows.length}</p></div></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-emerald-600" /></div><div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Revenue</p><p className="text-lg font-bold font-mono">PKR {Math.round(totals.revenue).toLocaleString()}</p></div></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center"><Package className="h-4 w-4 text-amber-600" /></div><div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Orders</p><p className="text-lg font-bold font-mono">{totals.orders}</p></div></CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center"><Users className="h-4 w-4 text-blue-600" /></div><div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Customers</p><p className="text-lg font-bold font-mono">{totals.customers}</p></div></CardContent></Card>
      </div>

      <Card className="glass-card mb-5"><CardContent className="p-5">
        <h3 className="text-sm font-semibold mb-3">Top 10 Cities by Revenue</h3>
        <div className="h-72">
          <ResponsiveContainer><BarChart data={top10}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={70} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart></ResponsiveContainer>
        </div>
      </CardContent></Card>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search city..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card className="glass-card"><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>City</TableHead>
            <TableHead className="text-right">Customers</TableHead>
            <TableHead className="text-right">Orders</TableHead>
            <TableHead className="text-right">Revenue (PKR)</TableHead>
            <TableHead className="text-right">Avg Order</TableHead>
            <TableHead>Top Product</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />No data.</TableCell></TableRow>
              : filtered.map(r => (
                <TableRow key={r.city}>
                  <TableCell className="font-medium">{r.city}</TableCell>
                  <TableCell className="text-right font-mono">{r.customers}</TableCell>
                  <TableCell className="text-right font-mono">{r.orders}</TableCell>
                  <TableCell className="text-right font-mono">{Math.round(r.revenue).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{Math.round(r.avgOrder).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{r.topProduct}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </AppLayout>
  );
}
