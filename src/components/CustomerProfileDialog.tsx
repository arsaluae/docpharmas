import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, X, Edit, Users, TrendingUp, DollarSign, Package, ShieldCheck, ExternalLink } from "lucide-react";
import { AllocatedProducts } from "@/components/AllocatedProducts";
import { Link } from "react-router-dom";
import { toast } from "sonner";


interface CustomerProfileDialogProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 customerId: string | null;
 customerName: string;
}

interface Distributor {
 id: string; name: string; address: string | null; license_number: string | null;
 license_expiry: string | null; phone: string | null; notes: string | null;
}

interface TopItem { product_name: string; total_qty: number; total_amount: number; }
interface MonthlySale { month: string; total: number; }

const emptyDistForm = { name: "", address: "", license_number: "", license_expiry: "", phone: "", notes: "" };

export function CustomerProfileDialog({ open, onOpenChange, customerId, customerName }: CustomerProfileDialogProps) {
 const [totalSales, setTotalSales] = useState(0);
 const [balance, setBalance] = useState(0);
 const [topItems, setTopItems] = useState<TopItem[]>([]);
 const [monthlySales, setMonthlySales] = useState<MonthlySale[]>([]);
 const [distributors, setDistributors] = useState<Distributor[]>([]);
 const [warrantyInvoices, setWarrantyInvoices] = useState<{ id: string; warranty_number: string; date: string; total: number; pharmacy_name: string }[]>([]);
 const [showDistForm, setShowDistForm] = useState(false);
 const [editDistId, setEditDistId] = useState<string | null>(null);
 const [distForm, setDistForm] = useState(emptyDistForm);


 useEffect(() => {
 if (open && customerId) loadProfile();
 }, [open, customerId]);

 const loadProfile = async () => {
 if (!customerId) return;

 const { data: custData } = await supabase.from("customers").select("balance").eq("id", customerId).single();
 if (custData) setBalance(Number(custData.balance));

 const { data: salesData } = await supabase.from("sales_invoices").select("total").eq("customer_id", customerId);
 if (salesData) setTotalSales(salesData.reduce((s, i) => s + Number(i.total), 0));

 const { data: invoices } = await supabase.from("sales_invoices").select("id").eq("customer_id", customerId);
 if (invoices && invoices.length > 0) {
 const invoiceIds = invoices.map(i => i.id);
 const { data: itemsData } = await supabase.from("sales_invoice_items")
 .select("product_id, quantity, amount")
 .in("invoice_id", invoiceIds);
 
 if (itemsData) {
 const productIds = [...new Set(itemsData.filter(i => i.product_id).map(i => i.product_id!))];
 const { data: products } = await supabase.from("products").select("id, name").in("id", productIds);
 const productMap = new Map(products?.map(p => [p.id, p.name]) || []);

 const grouped = new Map<string, { name: string; qty: number; amt: number }>();
 itemsData.forEach(item => {
 if (!item.product_id) return;
 const existing = grouped.get(item.product_id) || { name: productMap.get(item.product_id) || "Unknown", qty: 0, amt: 0 };
 existing.qty += Number(item.quantity);
 existing.amt += Number(item.amount);
 grouped.set(item.product_id, existing);
 });

 const top5 = Array.from(grouped.values())
 .sort((a, b) => b.amt - a.amt)
 .slice(0, 5)
 .map(g => ({ product_name: g.name, total_qty: g.qty, total_amount: g.amt }));
 setTopItems(top5);
 }

 const { data: monthlyData } = await supabase.from("sales_invoices")
 .select("date, total")
 .eq("customer_id", customerId)
 .order("date", { ascending: false });
 
 if (monthlyData) {
 const monthMap = new Map<string, number>();
 monthlyData.forEach(inv => {
 const month = inv.date.substring(0, 7);
 monthMap.set(month, (monthMap.get(month) || 0) + Number(inv.total));
 });
 const months = Array.from(monthMap.entries())
 .sort((a, b) => b[0].localeCompare(a[0]))
 .slice(0, 6)
 .map(([month, total]) => ({ month, total }));
 setMonthlySales(months);
 }
 } else {
 setTopItems([]);
 setMonthlySales([]);
 }

 await loadDistributors();
 await loadWarrantyInvoices();
 };

 const loadWarrantyInvoices = async () => {
 if (!customerId) return;
 const { data } = await supabase.from("warranty_invoices")
 .select("id, warranty_number, date, total, pharmacy_name")
 .eq("customer_id", customerId)
 .order("date", { ascending: false })
 .limit(20);
 setWarrantyInvoices((data || []) as any);
 };


 const loadDistributors = async () => {
 if (!customerId) return;
 const { data } = await supabase.from("customer_distributors")
 .select("*")
 .eq("customer_id", customerId)
 .order("name") as { data: Distributor[] | null };
 setDistributors(data || []);
 };

 const handleSaveDistributor = async () => {
 if (!distForm.name.trim()) { toast.error("Name is required"); return; }
 const payload = {
 customer_id: customerId!,
 name: distForm.name,
 address: distForm.address || null,
 license_number: distForm.license_number || null,
 license_expiry: distForm.license_expiry || null,
 phone: distForm.phone || null,
 notes: distForm.notes || null,
 };
 if (editDistId) {
 const { error } = await supabase.from("customer_distributors").update(payload).eq("id", editDistId);
 if (error) { toast.error("Failed to update: " + error.message); return; }
 toast.success("Distributor updated");
 } else {
 const { error } = await supabase.from("customer_distributors").insert(payload);
 if (error) { toast.error("Failed to add: " + error.message); return; }
 toast.success("Distributor added");
 }
 setShowDistForm(false); setEditDistId(null); setDistForm(emptyDistForm);
 loadDistributors();
 };

 const handleEditDist = (d: Distributor) => {
 setEditDistId(d.id);
 setDistForm({ name: d.name, address: d.address || "", license_number: d.license_number || "", license_expiry: d.license_expiry || "", phone: d.phone || "", notes: d.notes || "" });
 setShowDistForm(true);
 };

 const handleDeleteDist = async (id: string) => {
 await supabase.from("customer_distributors").delete().eq("id", id);
 toast.success("Distributor deleted");
 loadDistributors();
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> {customerName}</DialogTitle>
 <DialogDescription>Customer profile, sales summary, allocated products & distributors</DialogDescription>
 </DialogHeader>

 {/* Stats cards */}
 <div className="grid grid-cols-2 gap-3">
 <div className="p-3 rounded-lg border border-border bg-card">
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><DollarSign className="h-3 w-3" /> Total Sales</div>
 <p className="text-lg font-bold font-mono">PKR {totalSales.toLocaleString()}</p>
 </div>
 <div className="p-3 rounded-lg border border-border bg-card">
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingUp className="h-3 w-3" /> Amount Due</div>
 <p className="text-lg font-bold font-mono">PKR {balance.toLocaleString()}</p>
 </div>
 </div>

 {/* Top selling items */}
 {topItems.length > 0 && (
 <div>
 <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Package className="h-4 w-4" /> Top Selling Items</h4>
 <Table>
 <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
 <TableBody>
 {topItems.map((item, i) => (
 <TableRow key={i}>
 <TableCell className="text-sm">{item.product_name}</TableCell>
 <TableCell className="text-right font-mono text-sm">{item.total_qty}</TableCell>
 <TableCell className="text-right font-mono text-sm">{item.total_amount.toLocaleString()}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 )}

 {/* Sales by month */}
 {monthlySales.length > 0 && (
 <div>
 <h4 className="text-sm font-semibold mb-2">Sales by Month</h4>
 <div className="space-y-1">
 {monthlySales.map(m => (
 <div key={m.month} className="flex justify-between items-center py-1.5 px-2 rounded text-sm hover:bg-muted/50">
 <span className="text-muted-foreground">{m.month}</span>
 <span className="font-mono font-medium">PKR {m.total.toLocaleString()}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Allocated Products */}
 {customerId && <AllocatedProducts partyId={customerId} partyType="customer" />}

 {/* Warranty Invoices history */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <h4 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Warranty Invoices ({warrantyInvoices.length})</h4>
 <Link to="/warranty-invoices" className="text-xs text-primary hover:underline flex items-center gap-1" onClick={() => onOpenChange(false)}>
 View all <ExternalLink className="h-3 w-3" />
 </Link>
 </div>
 {warrantyInvoices.length > 0 ? (
 <div className="border rounded-lg overflow-hidden">
 <Table>
 <TableHeader><TableRow><TableHead className="text-xs">WI #</TableHead><TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Pharmacy</TableHead><TableHead className="text-right text-xs">Total</TableHead></TableRow></TableHeader>
 <TableBody>
 {warrantyInvoices.map(w => (
 <TableRow key={w.id} className="cursor-pointer hover:bg-accent/50" onClick={() => { onOpenChange(false); window.location.href = `/warranty-invoices?highlight=${w.id}`; }}>
 <TableCell className="font-mono text-xs">{w.warranty_number}</TableCell>
 <TableCell className="text-xs">{w.date}</TableCell>
 <TableCell className="text-xs">{w.pharmacy_name}</TableCell>
 <TableCell className="text-right font-mono text-xs">{Number(w.total).toLocaleString()}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </div>
 ) : (
 <p className="text-xs text-muted-foreground text-center py-3">No warranty invoices issued yet.</p>
 )}
 </div>

 {/* Distributors */}
 <div>
 <div className="flex items-center justify-between mb-2">

 <h4 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Distributors / Pharmacies</h4>
 {!showDistForm && (
 <Button size="sm" variant="outline" onClick={() => { setShowDistForm(true); setEditDistId(null); setDistForm(emptyDistForm); }}>
 <Plus className="h-3 w-3 mr-1" /> Add
 </Button>
 )}
 </div>

 {showDistForm && (
 <div className="border rounded-lg p-3 space-y-3 bg-muted/30 mb-3">
 <div className="flex justify-between items-center">
 <p className="text-sm font-medium">{editDistId ? "Edit" : "New"} Distributor</p>
 <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setShowDistForm(false); setEditDistId(null); }}><X className="h-3 w-3" /></Button>
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div><Label className="text-xs">Name *</Label><Input className="text-xs" value={distForm.name} onChange={e => setDistForm({...distForm, name: e.target.value})} /></div>
 <div><Label className="text-xs">License #</Label><Input className="text-xs" value={distForm.license_number} onChange={e => setDistForm({...distForm, license_number: e.target.value})} /></div>
 <div><Label className="text-xs">License Expiry</Label><Input type="date" className="text-xs" value={distForm.license_expiry} onChange={e => setDistForm({...distForm, license_expiry: e.target.value})} /></div>
 <div><Label className="text-xs">Phone</Label><Input className="text-xs" value={distForm.phone} onChange={e => setDistForm({...distForm, phone: e.target.value})} /></div>
 <div className="col-span-2"><Label className="text-xs">Address</Label><Input className="text-xs" value={distForm.address} onChange={e => setDistForm({...distForm, address: e.target.value})} /></div>
 </div>
 <Button size="sm" onClick={handleSaveDistributor} className="w-full">{editDistId ? "Update" : "Add"} Distributor</Button>
 </div>
 )}

 {distributors.length > 0 ? (
 <Table>
 <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>License #</TableHead><TableHead>Expiry</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
 <TableBody>
 {distributors.map(d => (
 <TableRow key={d.id}>
 <TableCell className="text-sm font-medium">{d.name}</TableCell>
 <TableCell className="text-xs font-mono">{d.license_number || "—"}</TableCell>
 <TableCell className="text-xs">{d.license_expiry || "—"}</TableCell>
 <TableCell>
 <div className="flex gap-1">
 <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditDist(d)}><Edit className="h-3 w-3" /></Button>
 <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteDist(d.id)}><Trash2 className="h-3 w-3" /></Button>
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 ) : (
 <p className="text-xs text-muted-foreground text-center py-4">No distributors added yet.</p>
 )}
 </div>
 </DialogContent>
 </Dialog>
 );
}
