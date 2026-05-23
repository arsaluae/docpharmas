import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface LedgerEntry { date: string; type: string; reference: string; debit: number; credit: number; balance: number; }

export default function SupplierLedger() {
 const { id } = useParams<{ id: string }>();
 const [supplier, setSupplier] = useState<any>(null);
 const [entries, setEntries] = useState<LedgerEntry[]>([]);

 useEffect(() => { if (id) loadLedger(id); }, [id]);

 const loadLedger = async (supplierId: string) => {
 const [{ data: sup }, { data: invoices }, { data: payments }, { data: returns }, { data: costs }] = await Promise.all([
 supabase.from("suppliers").select("*").eq("id", supplierId).single(),
 supabase.from("purchase_invoices").select("*").eq("supplier_id", supplierId),
 supabase.from("payments").select("*").eq("party_id", supplierId).eq("party_type", "supplier"),
 supabase.from("purchase_returns").select("*").eq("supplier_id", supplierId),
 supabase.from("additional_costs").select("*").eq("vendor_id", supplierId),
 ]);
 if (sup) setSupplier(sup);

 const raw: Omit<LedgerEntry, "balance">[] = [];
 if (sup) raw.push({ date: sup.created_at.split("T")[0], type: "Opening Balance", reference: "—", debit: 0, credit: Number(sup.opening_balance) });
 (invoices || []).forEach(inv => raw.push({ date: inv.date, type: "Purchase Bill", reference: inv.bill_number, debit: 0, credit: Number(inv.total) }));
 (payments || []).forEach(p => raw.push({ date: p.date, type: "Payment Made", reference: p.payment_number, debit: Number(p.amount), credit: 0 }));
 (returns || []).forEach(r => raw.push({ date: r.date, type: "Purchase Return", reference: r.return_number, debit: Number(r.total), credit: 0 }));
 (costs || []).forEach(c => raw.push({ date: c.date, type: `Add. Cost (${c.cost_type})`, reference: c.description || "—", debit: 0, credit: Number(c.amount) }));

 raw.sort((a, b) => a.date.localeCompare(b.date));
 let bal = 0;
 setEntries(raw.map(e => { bal += e.credit - e.debit; return { ...e, balance: bal }; }));
 };

 const totalPurchases = entries.filter(e => e.type === "Purchase Bill").reduce((s, e) => s + e.credit, 0);
 const totalPaid = entries.filter(e => e.type === "Payment Made").reduce((s, e) => s + e.debit, 0);
 const outstanding = entries.length > 0 ? entries[entries.length - 1].balance : 0;

 const shareViaWhatsApp = () => {
 if (!supplier?.phone) { toast.error("No phone number on record for this supplier"); return; }
 const msg = `📊 *Ledger Summary — ${supplier.name}*\n\n` +
 `Total Purchases: PKR ${totalPurchases.toLocaleString()}\n` +
 `Total Paid: PKR ${totalPaid.toLocaleString()}\n` +
 `*Outstanding Balance: PKR ${outstanding.toLocaleString()}*\n\n` +
 `As of ${new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}`;
 const num = supplier.phone.replace(/[^0-9]/g, "");
 window.open(`https://api.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(msg)}`, "_blank");
 };

 const headerActions = (
 <div className="flex items-center gap-2">
 <Button variant="outline" size="sm" className="text-xs gap-1.5 text-success border-border hover:bg-success/5" onClick={shareViaWhatsApp}>
 <MessageCircle className="h-3.5 w-3.5" /> Share via WhatsApp
 </Button>
 <Button variant="ghost" size="icon" asChild><Link to="/suppliers"><ArrowLeft className="h-4 w-4" /></Link></Button>
 </div>
 );

 return (
 <AppLayout title={`${supplier?.name || "Supplier"} — Ledger`} subtitle={supplier?.company || ""} headerActions={headerActions}>
 <div className="space-y-4">
 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
 {[
 { label: "Total Purchases", value: totalPurchases, color: "text-primary" },
 { label: "Total Paid", value: totalPaid, color: "text-primary" },
 { label: "Outstanding", value: outstanding, color: outstanding > 0 ? "text-destructive" : "text-primary" },
 ].map(c => (
 <Card key={c.label} className="glass-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{c.label}</p><p className={`text-lg font-bold font-mono ${c.color}`}>{c.value.toLocaleString()}</p></CardContent></Card>
 ))}
 </div>
 <Card className="glass-card"><CardContent className="p-0">
 <Table>
 <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
 <TableBody>
 {entries.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No transactions.</TableCell></TableRow> :
 entries.map((e, i) => (
 <TableRow key={i}>
 <TableCell>{e.date}</TableCell><TableCell>{e.type}</TableCell><TableCell className="text-xs text-muted-foreground">{e.reference}</TableCell>
 <TableCell className="text-right font-mono">{e.debit ? e.debit.toLocaleString() : "—"}</TableCell>
 <TableCell className="text-right font-mono">{e.credit ? e.credit.toLocaleString() : "—"}</TableCell>
 <TableCell className="text-right font-mono font-semibold">{e.balance.toLocaleString()}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </CardContent></Card>
 </div>
 </AppLayout>
 );
}
