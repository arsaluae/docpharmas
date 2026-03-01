import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";

interface WHTRow { supplier: string; total_wht: number; }
interface DrapReg {
  id: string; product_id: string; registration_number: string; status: string;
  registration_date: string | null; expiry_date: string | null; renewal_fee: number; notes: string | null;
}
interface Product { id: string; name: string; }

export default function TaxCompliance() {
  const navigate = useNavigate();
  const { settings } = useCompanySettings();
  const [gstOutput, setGstOutput] = useState(0);
  const [gstInput, setGstInput] = useState(0);
  const [whtRows, setWhtRows] = useState<WHTRow[]>([]);
  const [drapRegs, setDrapRegs] = useState<DrapReg[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [drapOpen, setDrapOpen] = useState(false);

  const [dProductId, setDProductId] = useState("");
  const [dRegNumber, setDRegNumber] = useState("");
  const [dRegDate, setDRegDate] = useState("");
  const [dExpDate, setDExpDate] = useState("");
  const [dFee, setDFee] = useState("");
  const [dNotes, setDNotes] = useState("");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const [sales, purchases, sups, drap, prods] = await Promise.all([
      supabase.from("sales_invoices").select("gst_amount"),
      supabase.from("purchase_invoices").select("gst, wht_amount, supplier_id"),
      supabase.from("suppliers").select("id, name"),
      supabase.from("drap_registrations").select("*").order("expiry_date", { ascending: true }),
      supabase.from("products").select("id, name"),
    ]);

    setGstOutput((sales.data || []).reduce((s, i) => s + Number(i.gst_amount), 0));
    setGstInput((purchases.data || []).reduce((s, i) => s + Number(i.gst), 0));

    const supNames: Record<string, string> = {};
    (sups.data || []).forEach(s => { supNames[s.id] = s.name; });
    const prodNames: Record<string, string> = {};
    (prods.data || []).forEach(p => { prodNames[p.id] = p.name; });
    setProductNames(prodNames);
    setProducts(prods.data || []);

    // WHT grouped by supplier
    const whtMap: Record<string, number> = {};
    (purchases.data || []).forEach(p => {
      if (Number(p.wht_amount) > 0) {
        const name = supNames[p.supplier_id || ""] || "Unknown";
        whtMap[name] = (whtMap[name] || 0) + Number(p.wht_amount);
      }
    });
    setWhtRows(Object.entries(whtMap).map(([supplier, total_wht]) => ({ supplier, total_wht })));
    setDrapRegs(drap.data || []);
  };

  const saveDrap = async () => {
    if (!dProductId || !dRegNumber) { toast.error("Product and reg number required"); return; }
    await supabase.from("drap_registrations").insert({
      product_id: dProductId, registration_number: dRegNumber,
      registration_date: dRegDate || null, expiry_date: dExpDate || null,
      renewal_fee: Number(dFee) || 0, notes: dNotes || null,
    });
    toast.success("DRAP registration added");
    setDrapOpen(false); setDProductId(""); setDRegNumber(""); setDRegDate(""); setDExpDate(""); setDFee(""); setDNotes("");
    load();
  };

  const drapStatus = (reg: DrapReg) => {
    if (!reg.expiry_date) return "active";
    const exp = new Date(reg.expiry_date);
    const now = new Date();
    const diff = (exp.getTime() - now.getTime()) / 86400000;
    if (diff < 0) return "expired";
    if (diff < 90) return "expiring";
    return "active";
  };

  const statusBadge = (s: string) => {
    if (s === "active") return <Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>;
    if (s === "expiring") return <Badge className="bg-yellow-100 text-yellow-700 border-0">Expiring Soon</Badge>;
    return <Badge variant="destructive">Expired</Badge>;
  };

  const netGst = gstOutput - gstInput;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-bold text-foreground font-heading">Tax & DRAP Compliance</h1>
          </header>
          <div className="p-6">
            <Tabs defaultValue={settings?.gst_enabled ? "gst" : "drap"}>
              <TabsList>
                {settings?.gst_enabled && <TabsTrigger value="gst">GST Summary</TabsTrigger>}
                {settings?.wht_enabled && <TabsTrigger value="wht">WHT Certificates</TabsTrigger>}
                <TabsTrigger value="drap">DRAP Tracker</TabsTrigger>
              </TabsList>

              <TabsContent value="gst" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card className="glass-card"><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Output Tax (Sales)</CardTitle></CardHeader>
                    <CardContent><p className="text-xl font-bold font-mono">PKR {gstOutput.toLocaleString()}</p></CardContent></Card>
                  <Card className="glass-card"><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Input Tax (Purchases)</CardTitle></CardHeader>
                    <CardContent><p className="text-xl font-bold font-mono">PKR {gstInput.toLocaleString()}</p></CardContent></Card>
                  <Card className={`glass-card border-2 ${netGst >= 0 ? "border-destructive/30" : "border-emerald-500/30"}`}>
                    <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Net {netGst >= 0 ? "Payable" : "Refundable"}</CardTitle></CardHeader>
                    <CardContent><p className={`text-xl font-bold font-mono ${netGst >= 0 ? "text-destructive" : "text-emerald-600"}`}>PKR {Math.abs(netGst).toLocaleString()}</p></CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="wht" className="mt-4">
                <Card className="glass-card">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Total WHT Deducted</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {whtRows.length === 0 ? (
                          <TableRow><TableCell colSpan={2} className="text-center py-12 text-muted-foreground">No WHT deductions recorded.</TableCell></TableRow>
                        ) : whtRows.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>{r.supplier}</TableCell>
                            <TableCell className="text-right font-mono font-medium">PKR {r.total_wht.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="drap" className="mt-4 space-y-4">
                <div className="flex justify-end">
                  <Dialog open={drapOpen} onOpenChange={setDrapOpen}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Registration</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add DRAP Registration</DialogTitle></DialogHeader>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="col-span-2">
                          <Label>Product *</Label>
                          <Select value={dProductId} onValueChange={setDProductId}>
                            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label>Reg Number *</Label><Input value={dRegNumber} onChange={e => setDRegNumber(e.target.value)} /></div>
                        <div><Label>Renewal Fee</Label><Input type="number" value={dFee} onChange={e => setDFee(e.target.value)} /></div>
                        <div><Label>Reg Date</Label><Input type="date" value={dRegDate} onChange={e => setDRegDate(e.target.value)} /></div>
                        <div><Label>Expiry Date</Label><Input type="date" value={dExpDate} onChange={e => setDExpDate(e.target.value)} /></div>
                        <div className="col-span-2"><Label>Notes</Label><Input value={dNotes} onChange={e => setDNotes(e.target.value)} /></div>
                      </div>
                      <Button onClick={saveDrap} className="w-full mt-4">Save</Button>
                    </DialogContent>
                  </Dialog>
                </div>
                <Card className="glass-card">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead><TableHead>Reg #</TableHead><TableHead>Reg Date</TableHead>
                          <TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Fee</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drapRegs.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No DRAP registrations.</TableCell></TableRow>
                        ) : drapRegs.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{productNames[r.product_id] || "—"}</TableCell>
                            <TableCell className="font-mono">{r.registration_number}</TableCell>
                            <TableCell className="text-muted-foreground">{r.registration_date || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{r.expiry_date || "—"}</TableCell>
                            <TableCell>{statusBadge(drapStatus(r))}</TableCell>
                            <TableCell className="text-right font-mono">PKR {Number(r.renewal_fee).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
