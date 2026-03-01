import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ClipboardList, CheckCircle, Download, PackageCheck, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";

interface PO {
  id: string; po_number: string; supplier_id: string | null; date: string; expected_delivery: string | null;
  subtotal: number; gst: number; total: number; status: string; proforma_id: string | null; created_at: string;
  suppliers?: { name: string } | null;
  purchase_proformas?: { proforma_number: string } | null;
}

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PO[]>([]);
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);
  const [confirmItems, setConfirmItems] = useState<any[]>([]);
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  // Auto-print PO PDF from URL param
  useEffect(() => {
    const printId = searchParams.get("print");
    if (printId && orders.length > 0) {
      const po = orders.find(o => o.id === printId);
      if (po) {
        (async () => {
          const { data: poItems } = await supabase.from("purchase_order_items").select("*, products(name)").eq("po_id", po.id);
          generatePdf({
            title: "PURCHASE ORDER", documentNumber: po.po_number, date: po.date,
            partyLabel: "Supplier", partyName: (po.suppliers as any)?.name || "—",
            columns: [
              { header: "#", key: "idx" }, { header: "Product", key: "name" },
              { header: "Qty", key: "quantity", align: "right" }, { header: "Rate", key: "rate", align: "right" },
              { header: "Amount", key: "amount", align: "right" },
            ],
            rows: (poItems || []).map((i: any, idx: number) => ({
              idx: idx + 1, name: i.products?.name || i.description || "Item",
              quantity: i.quantity, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString(),
            })),
            totals: [
              { label: "Subtotal", value: `PKR ${Number(po.subtotal).toLocaleString()}` },
              { label: "GST", value: `PKR ${Number(po.gst).toLocaleString()}` },
              { label: "Total", value: `PKR ${Number(po.total).toLocaleString()}` },
            ],
            settings,
            template: getTemplate("purchase_order"),
          });
          setSearchParams({}, { replace: true });
        })();
      }
    }
  }, [orders, searchParams]);

  const load = async () => {
    const { data } = await supabase.from("purchase_orders").select("*, suppliers(name), purchase_proformas(proforma_number)").order("created_at", { ascending: false });
    if (data) setOrders(data as any);
  };

  const openConfirm = async (po: PO) => {
    setSelectedPO(po);
    const { data } = await supabase.from("purchase_order_items").select("*, products(name)").eq("po_id", po.id);
    if (data) {
      setConfirmItems(data.map((i: any) => ({ ...i, quantity_confirmed: i.quantity_confirmed || i.quantity })));
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedPO) return;
    let newSubtotal = 0;
    for (const item of confirmItems) {
      const amt = Number(item.quantity_confirmed) * Number(item.rate);
      newSubtotal += amt;
      await supabase.from("purchase_order_items").update({
        quantity_confirmed: Number(item.quantity_confirmed),
        rate: Number(item.rate),
        amount: amt,
      }).eq("id", item.id);
    }
    const gstRate = settings?.gst_enabled ? Number(settings.default_gst_rate) / 100 : 0;
    const newGst = newSubtotal * gstRate;
    const newTotal = newSubtotal + newGst;
    await supabase.from("purchase_orders").update({ status: "confirmed", subtotal: newSubtotal, gst: newGst, total: newTotal }).eq("id", selectedPO.id);
    toast.success("Quantities & rates confirmed — you can now create a GRN");
    setConfirmOpen(false); load();
  };

  const filtered = orders.filter(o => o.po_number.toLowerCase().includes(search.toLowerCase()));

  const statusColor = (s: string) => {
    if (s === "received") return "bg-emerald-50 text-emerald-700";
    if (s === "confirmed") return "bg-primary/10 text-primary";
    if (s === "sent") return "bg-amber-50 text-amber-700";
    if (s === "cancelled") return "bg-destructive/10 text-destructive";
    return "bg-muted text-muted-foreground";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Purchase Orders</h1>
              <p className="text-sm text-muted-foreground">POs are auto-created from approved Purchase Proformas. Confirm quantities, then create GRN.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/purchase-proforma")}>
              <ArrowRight className="h-4 w-4 mr-1" /> Go to Proformas
            </Button>
          </header>

          <div className="p-6">
            {/* Flow indicator */}
            <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border border-border">
              <span className="font-semibold text-primary">① Proforma</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-semibold text-primary">② Purchase Order</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-semibold text-muted-foreground">③ GRN</span>
              <span className="ml-auto italic">All POs originate from an approved Purchase Proforma</span>
            </div>

            <div className="mb-4 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search POs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO #</TableHead><TableHead>From Proforma</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
                      <TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>No purchase orders yet.</p>
                        <p className="text-xs mt-1">Create a Purchase Proforma first, then approve it to auto-generate a PO.</p>
                      </TableCell></TableRow>
                    ) : filtered.map(po => (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium font-mono">{po.po_number}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{(po.purchase_proformas as any)?.proforma_number || "—"}</TableCell>
                        <TableCell>{(po.suppliers as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{po.date}</TableCell>
                        <TableCell><span className={`status-pill ${statusColor(po.status)}`}>{po.status}</span></TableCell>
                        <TableCell className="text-right font-mono font-medium">{Number(po.total).toLocaleString()}</TableCell>
                        <TableCell className="space-x-1">
                          {po.status === "draft" && (
                            <Button variant="outline" size="sm" onClick={() => openConfirm(po)} className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" /> Confirm Qty
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={async () => {
                            const { data: poItems } = await supabase.from("purchase_order_items").select("*, products(name)").eq("po_id", po.id);
                            generatePdf({
                              title: "PURCHASE ORDER", documentNumber: po.po_number, date: po.date,
                              partyLabel: "Supplier", partyName: (po.suppliers as any)?.name || "—",
                              columns: [
                                { header: "#", key: "idx" }, { header: "Product", key: "name" },
                                { header: "Qty", key: "quantity", align: "right" }, { header: "Rate", key: "rate", align: "right" },
                                { header: "Amount", key: "amount", align: "right" },
                              ],
                              rows: (poItems || []).map((i: any, idx: number) => ({
                                idx: idx + 1, name: i.products?.name || i.description || "Item",
                                quantity: i.quantity, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString(),
                              })),
                              totals: [
                                { label: "Subtotal", value: `PKR ${Number(po.subtotal).toLocaleString()}` },
                                { label: "GST", value: `PKR ${Number(po.gst).toLocaleString()}` },
                                { label: "Total", value: `PKR ${Number(po.total).toLocaleString()}` },
                              ],
                              settings,
                              template: getTemplate("purchase_order"),
                            });
                          }} className="text-xs"><Download className="h-3 w-3 mr-1" />PDF</Button>
                          {po.status === "confirmed" && (
                            <Button variant="outline" size="sm" onClick={() => navigate(`/grn?po=${po.id}`)} className="text-xs">
                              <PackageCheck className="h-3 w-3 mr-1" /> Create GRN
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Confirm quantities dialog */}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Factory Quantity Confirmation</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground mb-3">Update confirmed quantities and rates from supplier (may differ from proforma).</p>
              {confirmItems.map((item, idx) => (
                <div key={item.id} className="space-y-1 mb-3 p-3 border border-border rounded-lg">
                  <span className="text-sm font-medium">{(item.products as any)?.name || item.description || "Item"}</span>
                  <div className="text-xs text-muted-foreground">Originally ordered: {item.quantity} × {Number(item.rate).toLocaleString()}</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <Label className="text-xs">Confirmed Qty</Label>
                      <Input type="number" className="text-xs" value={item.quantity_confirmed}
                        onChange={e => {
                          const u = [...confirmItems]; u[idx].quantity_confirmed = e.target.value; setConfirmItems(u);
                        }} />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Confirmed Rate</Label>
                      <Input type="number" className="text-xs" value={item.rate}
                        onChange={e => {
                          const u = [...confirmItems]; u[idx].rate = e.target.value; setConfirmItems(u);
                        }} />
                    </div>
                    <div className="text-right text-xs font-mono pt-4">
                      {(Number(item.quantity_confirmed) * Number(item.rate)).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={handleConfirm} className="w-full mt-3">Confirm Quantities</Button>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </SidebarProvider>
  );
}
