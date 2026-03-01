import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileText, Download, Trash2, Pencil, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { CheckCircle } from "lucide-react";

interface DeliveryNote {
  id: string; dn_number: string; date: string; reference_type: string;
  reference_id: string; customer_id: string | null; supplier_id: string | null;
  items: any; notes: string | null; status: string; created_at: string;
}

export default function DeliveryNotes() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();

  // Detail/Edit
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDN, setDetailDN] = useState<DeliveryNote | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<any[]>([]);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const { data } = await supabase.from("delivery_notes").select("*").order("created_at", { ascending: false });
    if (data) setNotes(data as any);
  };

  const printDN = (dn: DeliveryNote) => {
    const items = typeof dn.items === "string" ? JSON.parse(dn.items) : dn.items;
    generatePdf({
      title: "DELIVERY NOTE", documentNumber: dn.dn_number, date: dn.date,
      columns: [
        { header: "#", key: "idx" }, { header: "Product", key: "product_name" },
        { header: "Batch #", key: "batch_number" }, { header: "Expiry", key: "expiry_date" },
        { header: "Quantity", key: "quantity", align: "right" },
      ],
      rows: items.map((i: any, idx: number) => ({ ...i, idx: idx + 1 })),
      notes: dn.notes || undefined, settings,
      template: getTemplate("delivery_note"),
    });
  };

  const filtered = notes.filter(n => n.dn_number.toLowerCase().includes(search.toLowerCase()));
  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(n => n.id)));

  const handleDelete = async (ids: string[]) => {
    if (!window.confirm(`Delete ${ids.length} delivery note(s)?`)) return;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      await supabase.from("delivery_notes").delete().in("id", chunk);
    }
    toast.success(`${ids.length} deleted`);
    setSelected(new Set()); load();
  };

  const openDetail = (dn: DeliveryNote) => {
    setDetailDN(dn);
    setEditMode(false);
    setDetailOpen(true);
  };

  const enterEditMode = () => {
    if (!detailDN) return;
    setEditDate(detailDN.date);
    setEditNotes(detailDN.notes || "");
    const dnItems = typeof detailDN.items === "string" ? JSON.parse(detailDN.items) : detailDN.items;
    setEditItems(dnItems.map((i: any) => ({ ...i })));
    setEditMode(true);
  };

  const handleEditSave = async () => {
    if (!detailDN) return;
    await supabase.from("delivery_notes").update({
      date: editDate, notes: editNotes || null, items: editItems,
    }).eq("id", detailDN.id);
    toast.success("Delivery note updated");
    setDetailOpen(false); setEditMode(false); load();
  };

  const dnItems = (dn: DeliveryNote | null) => {
    if (!dn) return [];
    return typeof dn.items === "string" ? JSON.parse(dn.items) : dn.items;
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Delivery Notes</h1>
              <p className="text-sm text-muted-foreground">Track dispatched goods — no pricing, just batch/qty/expiry</p>
            </div>
          </header>

          <div className="p-6">
            <div className="mb-4 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search delivery notes..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                      <TableHead>DN #</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead>
                      <TableHead>Status</TableHead><TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />No delivery notes yet.
                      </TableCell></TableRow>
                    ) : filtered.map(dn => (
                      <TableRow key={dn.id} className="cursor-pointer" data-state={selected.has(dn.id) ? "selected" : undefined}>
                        <TableCell><Checkbox checked={selected.has(dn.id)} onCheckedChange={() => toggleSelect(dn.id)} /></TableCell>
                        <TableCell className="font-medium font-mono" onClick={() => openDetail(dn)}>{dn.dn_number}</TableCell>
                        <TableCell className="text-muted-foreground" onClick={() => openDetail(dn)}>{dn.date}</TableCell>
                        <TableCell className="capitalize" onClick={() => openDetail(dn)}>{dn.reference_type.replace("_", " ")}</TableCell>
                        <TableCell onClick={() => openDetail(dn)}><span className={`status-pill ${dn.status === "delivered" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>{dn.status}</span></TableCell>
                        <TableCell className="space-x-1">
                          <Button variant="outline" size="sm" onClick={() => printDN(dn)} className="text-xs">
                            <Download className="h-3 w-3 mr-1" /> PDF
                          </Button>
                          {dn.status === "issued" && (
                            <Button variant="outline" size="sm" onClick={async () => {
                              await supabase.from("delivery_notes").update({ status: "delivered" }).eq("id", dn.id);
                              toast.success("Marked as delivered"); load();
                            }} className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" /> Delivered
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete([dn.id])}>
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
              <Button size="sm" variant="secondary" onClick={() => handleDelete(Array.from(selected))}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            </div>
          )}

          {/* Detail/Edit Dialog */}
          <Dialog open={detailOpen} onOpenChange={o => { if (!o) { setDetailOpen(false); setEditMode(false); } }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{detailDN?.dn_number} — Detail</span>
                  {!editMode && <Button variant="outline" size="sm" onClick={enterEditMode}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>}
                </DialogTitle>
              </DialogHeader>

              {!editMode ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Date:</span> {detailDN?.date}</div>
                    <div><span className="text-muted-foreground">Type:</span> <span className="capitalize">{detailDN?.reference_type.replace("_", " ")}</span></div>
                    <div><span className="text-muted-foreground">Status:</span> <span className="status-pill bg-emerald-50 text-emerald-700">{detailDN?.status}</span></div>
                  </div>
                  {detailDN?.notes && <p className="text-sm text-muted-foreground mt-2">Notes: {detailDN.notes}</p>}
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>#</TableHead><TableHead>Product</TableHead><TableHead>Batch</TableHead>
                      <TableHead>Expiry</TableHead><TableHead className="text-right">Qty</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {dnItems(detailDN).map((i: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{i.product_name || "Item"}</TableCell>
                          <TableCell>{i.batch_number || "—"}</TableCell>
                          <TableCell>{i.expiry_date || "—"}</TableCell>
                          <TableCell className="text-right">{i.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date</Label><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
                    <div><Label>Notes</Label><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} /></div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Items</Label>
                      <Button variant="outline" size="sm" onClick={() => setEditItems([...editItems, { product_name: "", batch_number: "", expiry_date: "", quantity: 1 }])}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    </div>
                    {editItems.map((item: any, idx: number) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                        <div className="col-span-3"><Input className="text-xs" value={item.product_name} onChange={e => { const u = [...editItems]; u[idx].product_name = e.target.value; setEditItems(u); }} placeholder="Product" /></div>
                        <div className="col-span-3"><Input className="text-xs" value={item.batch_number} onChange={e => { const u = [...editItems]; u[idx].batch_number = e.target.value; setEditItems(u); }} placeholder="Batch" /></div>
                        <div className="col-span-3"><Input className="text-xs" type="date" value={item.expiry_date} onChange={e => { const u = [...editItems]; u[idx].expiry_date = e.target.value; setEditItems(u); }} /></div>
                        <div className="col-span-2"><Input className="text-xs" type="number" value={item.quantity} onChange={e => { const u = [...editItems]; u[idx].quantity = Number(e.target.value); setEditItems(u); }} /></div>
                        <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleEditSave} className="flex-1">Save Changes</Button>
                    <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </SidebarProvider>
  );
}
