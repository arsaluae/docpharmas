import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Receipt, Download, Trash2, ArrowRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";

interface PurchaseInvoice {
  id: string; bill_number: string; supplier_id: string | null; grn_id: string | null; date: string;
  due_date: string | null; subtotal: number; gst: number; wht_amount: number; total: number;
  status: string; created_at: string;
  suppliers?: { name: string } | null;
}

export default function PurchaseInvoicesPage() {
  const navigate = useNavigate();
  const [bills, setBills] = useState<PurchaseInvoice[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { settings } = useCompanySettings();

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const { data } = await supabase.from("purchase_invoices").select("*, suppliers(name)").order("created_at", { ascending: false });
    if (data) setBills(data as any);
  };

  const filtered = bills.filter(b => b.bill_number.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(b => b.id)));

  const handleBulkDelete = (ids: string[]) => {
    setDeleteIds(ids);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    for (let i = 0; i < deleteIds.length; i += 200) {
      const chunk = deleteIds.slice(i, i + 200);
      await supabase.from("purchase_invoices").delete().in("id", chunk);
    }
    toast.success(`${deleteIds.length} deleted`);
    setSelected(new Set());
    setDeleteConfirmOpen(false);
    setDeleteIds([]);
    load();
  };

  const statusColor = (s: string) => {
    if (s === "paid") return "bg-emerald-50 text-emerald-700";
    if (s === "partial") return "bg-amber-50 text-amber-700";
    return "bg-destructive/10 text-destructive";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Purchase Bills</h1>
              <p className="text-sm text-muted-foreground">Auto-generated from GRN completion{settings?.wht_enabled ? ' with WHT deduction' : ''}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/grn")}>
              <ArrowRight className="h-4 w-4 mr-1" /> Go to GRN
            </Button>
          </header>

          <div className="p-6">
            {/* Flow indicator */}
            <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border border-border">
              <span className="font-semibold text-muted-foreground">① Proforma</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-semibold text-muted-foreground">② Purchase Order</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-semibold text-muted-foreground">③ GRN</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-semibold text-primary">④ Purchase Bill</span>
              <span className="ml-auto italic">Bills are auto-created when a GRN is completed</span>
            </div>

            <div className="mb-4 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search bills..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                      <TableHead>Bill #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>{settings?.wht_enabled && <TableHead className="text-right">WHT</TableHead>}
                      <TableHead className="text-right">Net Total</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                       <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
                       <p>No purchase bills yet.</p>
                       <p className="text-xs mt-1">Complete a GRN to auto-generate a purchase bill.</p>
                      </TableCell></TableRow>
                    ) : filtered.map(b => (
                      <TableRow key={b.id} data-state={selected.has(b.id) ? "selected" : undefined}>
                        <TableCell><Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggleSelect(b.id)} /></TableCell>
                        <TableCell className="font-medium font-mono">{b.bill_number}</TableCell>
                        <TableCell>{(b.suppliers as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{b.date}</TableCell>
                        <TableCell className="text-right font-mono">{Number(b.subtotal).toLocaleString()}</TableCell>
                        {settings?.wht_enabled && <TableCell className="text-right font-mono text-amber-700">-{Number(b.wht_amount).toLocaleString()}</TableCell>}
                        <TableCell className="text-right font-mono font-medium">{Number(b.total).toLocaleString()}</TableCell>
                        <TableCell><span className={`status-pill ${statusColor(b.status)}`}>{b.status}</span></TableCell>
                        <TableCell className="space-x-1">
                          <Button variant="outline" size="sm" onClick={() => {
                            generatePdf({
                              title: "PURCHASE BILL", documentNumber: b.bill_number, date: b.date,
                              partyLabel: "Supplier", partyName: (b.suppliers as any)?.name || "—",
                              columns: [
                                { header: "Subtotal", key: "subtotal", align: "right" },
                                { header: "GST", key: "gst", align: "right" },
                                { header: "WHT", key: "wht", align: "right" },
                                { header: "Net Total", key: "total", align: "right" },
                              ],
                              rows: [{ subtotal: Number(b.subtotal).toLocaleString(), gst: Number(b.gst).toLocaleString(), wht: `-${Number(b.wht_amount).toLocaleString()}`, total: Number(b.total).toLocaleString() }],
                              settings,
                            });
                          }} className="text-xs"><Download className="h-3 w-3 mr-1" />PDF</Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleBulkDelete([b.id])}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          {selected.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-6 py-3 rounded-full shadow-lg flex items-center gap-3 z-50">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <Button size="sm" variant="secondary" onClick={() => handleBulkDelete(Array.from(selected))}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Are you sure you want to delete {deleteIds.length} purchase bill(s)? This cannot be undone.</p>
              <div className="flex gap-2 mt-4">
                <Button variant="destructive" onClick={confirmDelete} className="flex-1">Delete</Button>
                <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="flex-1">Cancel</Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </SidebarProvider>
  );
}
