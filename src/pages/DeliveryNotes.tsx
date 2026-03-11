import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileText, Download, Trash2, Pencil, Plus, CheckCircle, Truck, MessageCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdfHtml } from "@/lib/pdf-generator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";

interface DeliveryNote {
  id: string; dn_number: string; date: string; reference_type: string;
  reference_id: string; customer_id: string | null; supplier_id: string | null;
  items: any; notes: string | null; status: string; created_at: string;
}

export default function DeliveryNotes() {
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [search, setSearch] = useState("");
  const pagination = usePagination();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();
  const [pdfHtml, setPdfHtml] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailDN, setDetailDN] = useState<DeliveryNote | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<any[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  useEffect(() => { load(); }, [pagination.page]);

  const load = async () => {
    const { data, count } = await supabase.from("delivery_notes").select("*, customers(name), suppliers(name)", { count: "exact" }).order("created_at", { ascending: false }).range(pagination.from, pagination.to);
    if (data) setNotes(data as any);
    if (count !== null) pagination.setTotalCount(count);
  };

  const printDN = (dn: DeliveryNote) => {
    const items = typeof dn.items === "string" ? JSON.parse(dn.items) : dn.items;
    const customerName = (dn as any).customers?.name || undefined;
    const html = generatePdfHtml({
      title: "DELIVERY NOTE", documentNumber: dn.dn_number, date: dn.date,
      partyLabel: dn.customer_id ? "Customer" : dn.supplier_id ? "Supplier" : undefined,
      partyName: customerName,
      columns: [
        { header: "#", key: "idx" }, { header: "Product", key: "product_name" },
        { header: "Batch #", key: "batch_number" }, { header: "Expiry", key: "expiry_date" },
        { header: "Quantity", key: "quantity", align: "right" },
      ],
      rows: items.map((i: any, idx: number) => ({ ...i, idx: idx + 1 })),
      notes: dn.notes || undefined, settings,
      template: getTemplate("delivery_note"),
    });
    setPdfHtml(html); setPdfTitle(`Delivery Note — ${dn.dn_number}`); setPdfOpen(true);
  };

  const filtered = notes.filter(n => n.dn_number.toLowerCase().includes(search.toLowerCase()));
  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(n => n.id)));

  const handleDelete = (ids: string[]) => { setDeleteIds(ids); setDeleteConfirmOpen(true); };
  const confirmDelete = async () => {
    for (let i = 0; i < deleteIds.length; i += 200) {
      await supabase.from("delivery_notes").delete().in("id", deleteIds.slice(i, i + 200));
    }
    toast.success(`${deleteIds.length} deleted`);
    setSelected(new Set()); setDeleteConfirmOpen(false); setDeleteIds([]); load();
  };

  const openDetail = (dn: DeliveryNote) => { setDetailDN(dn); setEditMode(false); setDetailOpen(true); };

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
    await supabase.from("delivery_notes").update({ date: editDate, notes: editNotes || null, items: editItems }).eq("id", detailDN.id);
    toast.success("Delivery note updated");
    setDetailOpen(false); setEditMode(false); load();
  };

  const dnItems = (dn: DeliveryNote | null) => {
    if (!dn) return [];
    return typeof dn.items === "string" ? JSON.parse(dn.items) : dn.items;
  };

  const issuedCount = notes.filter(n => n.status === "issued").length;
  const deliveredCount = notes.filter(n => n.status === "delivered").length;

  return (
    <AppLayout title="Delivery Notes" subtitle="Track dispatched goods — batch, qty & expiry">
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border border-border bg-gradient-to-br from-amber-500/10 to-amber-600/5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Issued</p>
            <p className="text-2xl font-bold font-heading text-amber-600 mt-1">{issuedCount}</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-gradient-to-br from-emerald-500/10 to-emerald-600/5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Delivered</p>
            <p className="text-2xl font-bold font-heading text-emerald-600 mt-1">{deliveredCount}</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-gradient-to-br from-primary/10 to-primary/5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Total</p>
            <p className="text-2xl font-bold font-heading text-primary mt-1">{notes.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search delivery notes..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <Card className="glass-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                   <TableHead>DN #</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Type</TableHead>
                   <TableHead>Status</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>No delivery notes yet.</p>
                    <p className="text-xs mt-1">Submit a Sales Order to auto-generate delivery notes.</p>
                  </TableCell></TableRow>
                ) : filtered.map(dn => (
                  <TableRow key={dn.id} className="cursor-pointer group" data-state={selected.has(dn.id) ? "selected" : undefined}>
                    <TableCell><Checkbox checked={selected.has(dn.id)} onCheckedChange={() => toggleSelect(dn.id)} /></TableCell>
                    <TableCell className="font-medium font-mono" onClick={() => openDetail(dn)}>{dn.dn_number}</TableCell>
                    <TableCell className="text-muted-foreground" onClick={() => openDetail(dn)}>{dn.date}</TableCell>
                    <TableCell className="text-muted-foreground" onClick={() => openDetail(dn)}>{(dn as any).customers?.name || (dn as any).suppliers?.name || "—"}</TableCell>
                    <TableCell className="capitalize" onClick={() => openDetail(dn)}>{dn.reference_type.replace("_", " ")}</TableCell>
                    <TableCell onClick={() => openDetail(dn)}>
                      <Badge variant="outline" className={`text-[10px] font-semibold ${dn.status === "delivered" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" : "bg-amber-500/15 text-amber-600 border-amber-500/20"}`}>
                        {dn.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" onClick={() => printDN(dn)} className="text-xs h-7 gap-1">
                          <Download className="h-3 w-3" /> PDF
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                          const { buildDeliveryNoteMessage, openWhatsApp, uploadSharedDocument } = await import("@/lib/whatsapp-share");
                          const items = typeof dn.items === "string" ? JSON.parse(dn.items) : dn.items;
                          const customerName = (dn as any).customers?.name || "Customer";
                          // Get customer phone
                          let phone = "";
                          if (dn.customer_id) {
                            const { data } = await supabase.from("customers").select("phone").eq("id", dn.customer_id).single();
                            phone = data?.phone || "";
                          }
                          // Generate PDF link
                          let pdfLink: string | undefined;
                          try {
                            const html = generatePdfHtml({
                              title: "DELIVERY NOTE", documentNumber: dn.dn_number, date: dn.date,
                              partyLabel: "Customer", partyName: customerName,
                              columns: [
                                { header: "#", key: "idx" }, { header: "Product", key: "product_name" },
                                { header: "Batch", key: "batch_number" }, { header: "Expiry", key: "expiry_date" },
                                { header: "Qty", key: "quantity", align: "right" as const },
                              ],
                              rows: items.map((i: any, idx: number) => ({ ...i, idx: idx + 1 })),
                              notes: dn.notes || undefined, settings, template: getTemplate("delivery_note"),
                            });
                            pdfLink = await uploadSharedDocument(html, dn.dn_number) || undefined;
                          } catch (e) { console.error("PDF link error:", e); }
                          const message = buildDeliveryNoteMessage({
                            dnNumber: dn.dn_number,
                            companyName: settings?.company_name || "DocPharmas",
                            customerName, customerPhone: phone, date: dn.date,
                            items: items.map((i: any) => ({ product_name: i.product_name || "Item", batch_number: i.batch_number, expiry_date: i.expiry_date, quantity: i.quantity })),
                            pdfLink,
                          });
                          openWhatsApp(phone, message);
                        }} title="Share via WhatsApp">
                          <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                        {dn.status === "issued" && (
                          <Button size="sm" onClick={async () => {
                            await supabase.from("delivery_notes").update({ status: "delivered" }).eq("id", dn.id);
                            toast.success("Marked as delivered"); load();
                          }} className="text-xs h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Truck className="h-3 w-3" /> Delivered
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete([dn.id])}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls
              page={pagination.page} totalPages={pagination.totalPages} totalCount={pagination.totalCount}
              hasNext={pagination.hasNext} hasPrev={pagination.hasPrev}
              onNext={pagination.nextPage} onPrev={pagination.prevPage} pageSize={pagination.pageSize}
            />
          </CardContent>
        </Card>
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-50">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="secondary" onClick={() => handleDelete(Array.from(selected))}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      )}

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete {deleteIds.length} delivery note(s)?</p>
          <div className="flex gap-2 mt-4">
            <Button variant="destructive" onClick={confirmDelete} className="flex-1">Delete</Button>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="flex-1">Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

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
                <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className="text-xs">{detailDN?.status}</Badge></div>
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
      <PdfPreviewDialog open={pdfOpen} onOpenChange={setPdfOpen} html={pdfHtml} title={pdfTitle} />
    </AppLayout>
  );
}
