import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Truck, Package, MapPin } from "lucide-react";
import { useFreightProviders } from "@/hooks/useFreightProviders";

interface DnRow {
 id: string;
 dn_number: string;
 date: string;
 customer_id: string | null;
 freight_provider_id: string | null;
 delivery_type_label: string | null;
 items: any;
 customers?: { name: string; city: string | null } | null;
}

export default function Couriers() {
 const now = new Date();
 const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
 const [rows, setRows] = useState<DnRow[]>([]);
 const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
 const { providers } = useFreightProviders(false);

 const monthLabel = (() => {
 const [y, m] = month.split("-");
 return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-PK", { month: "long", year: "numeric" });
 })();
 const prev = () => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m - 2); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
 const next = () => { const [y, m] = month.split("-").map(Number); const d = new Date(y, m); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };

 useEffect(() => {
 (async () => {
 const start = `${month}-01`;
 const [y, m] = month.split("-").map(Number);
 const endDate = new Date(y, m, 0); // last day of month
 const end = `${y}-${String(m).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
 const { data } = await supabase
 .from("delivery_notes")
 .select("id, dn_number, date, customer_id, freight_provider_id, delivery_type_label, items, customers(name, city)")
 .gte("date", start).lte("date", end).order("date", { ascending: false });
 setRows((data as any) || []);
 })();
 }, [month]);

 const totalPcs = (items: any): number => {
 const list = typeof items === "string" ? JSON.parse(items) : items;
 if (!Array.isArray(list)) return 0;
 return list.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
 };

 // Aggregate per provider
 const stats = useMemo(() => {
 const map: Record<string, { count: number; pcs: number; label: string; id: string | null }> = {};
 const unassignedKey = "__unassigned";
 providers.forEach(p => { map[p.id] = { count: 0, pcs: 0, label: p.name, id: p.id }; });
 map[unassignedKey] = { count: 0, pcs: 0, label: "Unassigned", id: null };
 rows.forEach(r => {
 const key = r.freight_provider_id || unassignedKey;
 if (!map[key]) map[key] = { count: 0, pcs: 0, label: r.delivery_type_label || "Unknown", id: r.freight_provider_id };
 map[key].count += 1;
 map[key].pcs += totalPcs(r.items);
 });
 return Object.entries(map).map(([k, v]) => ({ key: k, ...v }));
 }, [rows, providers]);

 const drillRows = useMemo(() => {
 if (!selectedProvider) return [];
 const target = selectedProvider === "__unassigned" ? null : selectedProvider;
 return rows.filter(r => (r.freight_provider_id || null) === target);
 }, [rows, selectedProvider]);

 return (
 <AppLayout title="Couriers" subtitle="Monthly freight dispatch tracking — NCCS, ADDA, Self & more">
 <div className="space-y-5">
 {/* Month selector */}
 <div className="flex items-center gap-2">
 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
 <span className="text-sm font-semibold min-w-[140px] text-center font-heading">{monthLabel}</span>
 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
 </div>

 {/* KPI grid */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
 {stats.filter(s => s.count > 0 || s.key !== "__unassigned").map(s => (
 <button key={s.key} onClick={() => setSelectedProvider(s.key)}
 className={`group relative text-left p-4 rounded-md border bg-card/60 transition-all ${selectedProvider === s.key ? "border-primary/60 ring-2 ring-primary/30" : "border-border/50"}`}>
 <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-md" />
 <div className="relative">
 <div className="flex items-center gap-2 mb-2">
 <div className="h-8 w-8 rounded-lg bg-card flex items-center justify-center">
 <Truck className="h-4 w-4 text-white" />
 </div>
 <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.label}</span>
 </div>
 <div className="flex items-baseline gap-2 mt-2">
 <span className="text-2xl font-bold font-heading">{s.pcs.toLocaleString()}</span>
 <span className="text-[10px] text-muted-foreground font-semibold">pcs</span>
 </div>
 <p className="text-[11px] text-muted-foreground mt-1">{s.count} dispatch{s.count === 1 ? "" : "es"}</p>
 </div>
 </button>
 ))}
 </div>

 {/* Drill-in table */}
 {selectedProvider && (
 <Card className="glass-card">
 <CardContent className="p-0">
 <div className="px-4 py-3 border-b border-border flex items-center justify-between">
 <h3 className="text-sm font-semibold font-heading">
 {stats.find(s => s.key === selectedProvider)?.label} — {drillRows.length} dispatch{drillRows.length === 1 ? "" : "es"}
 </h3>
 <Button variant="ghost" size="sm" onClick={() => setSelectedProvider(null)}>Close</Button>
 </div>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>DN #</TableHead>
 <TableHead>Date</TableHead>
 <TableHead>Customer</TableHead>
 <TableHead><MapPin className="h-3 w-3 inline mr-1" />City</TableHead>
 <TableHead className="text-right"><Package className="h-3 w-3 inline mr-1" />Pcs</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {drillRows.length === 0 ? (
 <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No dispatches</TableCell></TableRow>
 ) : drillRows.map(r => (
 <TableRow key={r.id}>
 <TableCell className="font-mono font-semibold text-sm">{r.dn_number}</TableCell>
 <TableCell className="text-sm text-muted-foreground">{r.date}</TableCell>
 <TableCell className="text-sm">{r.customers?.name || "—"}</TableCell>
 <TableCell className="text-sm">{r.customers?.city || "—"}</TableCell>
 <TableCell className="text-right font-mono font-semibold">{totalPcs(r.items).toLocaleString()}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 )}
 </div>
 </AppLayout>
 );
}
