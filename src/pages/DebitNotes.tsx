import { useEffect, useState } from "react";
import { logAudit } from "@/lib/audit";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { escIlike, searchCustomerIds, searchSupplierIds } from "@/lib/search-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, FileText, Trash2, Users, Truck, Link2 } from "lucide-react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ApplyNoteDialog } from "@/components/ApplyCreditNoteDialog";
import { BulkActionBar, useBulkSelection, RowCheckbox } from "@/components/BulkActionBar";
import { Checkbox } from "@/components/ui/checkbox";


interface Party { id: string; name: string; company?: string | null; }
interface DebitNote {
  id: string; debit_note_number: string; party_type: string; party_id: string;
  date: string; amount: number; reason: string | null; reference: string | null;
  notes: string | null; status: string; created_at: string; applied_amount?: number;
}

export default function DebitNotes() {
  const [notes, setNotes] = useState<DebitNote[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [applyNote, setApplyNote] = useState<DebitNote | null>(null);
  const pagination = usePagination();
  const bulk = useBulkSelection();

  const deleteOne = async (id: string) => {
    await supabase.from("debit_note_applications").delete().eq("debit_note_id", id);
    const { error } = await supabase.from("debit_notes").delete().eq("id", id);
    if (error) throw error;
  };


  const [partyType, setPartyType] = useState("supplier");
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [partyNames, setPartyNames] = useState<Record<string, string>>({});

  const debouncedSearch = useDebouncedValue(search, 300);
  useEffect(() => { pagination.setPage(0); }, [debouncedSearch, activeTab]);
  useEffect(() => { load(); }, [pagination.page, activeTab, debouncedSearch]);

  const load = async () => {
    let query = supabase.from("debit_notes").select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (activeTab === "customer") query = query.eq("party_type", "customer");
    if (activeTab === "supplier") query = query.eq("party_type", "supplier");
    const q = debouncedSearch.trim();
    if (q) {
      const safe = escIlike(q);
      const partyIds = activeTab === "supplier"
        ? await searchSupplierIds(q)
        : activeTab === "customer"
        ? await searchCustomerIds(q)
        : [...(await searchCustomerIds(q)), ...(await searchSupplierIds(q))];
      const idClause = partyIds.length > 0 ? `,party_id.in.(${partyIds.join(",")})` : "";
      query = query.or(`debit_note_number.ilike.%${safe}%,reason.ilike.%${safe}%,reference.ilike.%${safe}%${idClause}`);
    }
    query = query.range(pagination.from, pagination.to);

    const [res, custs, supps] = await Promise.all([
      query,
      supabase.from("customers").select("id, name, company"),
      supabase.from("suppliers").select("id, name, company"),
    ]);

    if (res.data) setNotes(res.data as DebitNote[]);
    if (res.count !== null && res.count !== undefined) pagination.setTotalCount(res.count);
    if (custs.data) setCustomers(custs.data);
    if (supps.data) setSuppliers(supps.data);

    const nameMap: Record<string, string> = {};
    custs.data?.forEach(c => { nameMap[c.id] = c.company || c.name; });
    supps.data?.forEach(s => { nameMap[s.id] = s.company || s.name; });
    setPartyNames(nameMap);
  };

  const handleSave = async () => {
    if (!partyId) { toast.error("Select a party"); return; }
    if (!amount || Number(amount) <= 0) { toast.error("Amount is required"); return; }

    const { data: dnNumber } = await supabase.rpc("generate_document_number", { p_document_type: "debit_note" });
    if (!dnNumber) { toast.error("Failed to generate debit note number"); return; }

    const { error } = await supabase.from("debit_notes").insert({
      debit_note_number: dnNumber, party_type: partyType, party_id: partyId,
      date, amount: Number(amount), reason: reason || null,
      reference: reference || null, notes: formNotes || null,
    });

    if (error) { toast.error("Failed to save: " + error.message); return; }
    logAudit({ action: "debit_note_issued", entity_type: "debit_note", entity_number: dnNumber, changes: { party_type: partyType, party_id: partyId, amount: Number(amount), reason } });
    toast.success(`Debit Note ${dnNumber} created`);
    resetForm(); load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("debit_notes").delete().eq("id", deleteId);
    if (error) toast.error("Failed to delete"); else toast.success("Debit note deleted & balance reversed");
    setDeleteId(null); load();
  };

  const resetForm = () => {
    setOpen(false); setPartyType("supplier"); setPartyId("");
    setAmount(""); setReason(""); setReference(""); setFormNotes("");
  };

  const currentParties = partyType === "customer" ? customers : suppliers;
  const partyOptions = currentParties.map(p => ({ value: p.id, label: p.company || p.name }));

  // Server-side search already filters across all pages.
  const filtered = notes;
  const totalAmount = filtered.reduce((s, n) => s + Number(n.amount), 0);

  const headerActions = (
    <Dialog open={open} onOpenChange={o => { if (!o) resetForm(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Issue Debit Note</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue Debit Note</DialogTitle>
          <DialogDescription>Reduce a supplier balance for returns or recoverable claims.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Party Type</Label>
              <Select value={partyType} onValueChange={v => { setPartyType(v); setPartyId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier">Supplier (Reduce Payable)</SelectItem>
                  <SelectItem value="customer">Customer (Increase Receivable)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="col-span-2">
              <Label>{partyType === "customer" ? "Customer" : "Supplier"} *</Label>
              <SearchableSelect options={partyOptions} value={partyId} onChange={setPartyId} placeholder={`Select ${partyType}...`} />
            </div>
            <div><Label>Amount (PKR) *</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div><Label>Reference</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Return # or Bill #" /></div>
            <div className="col-span-2"><Label>Reason</Label><Input value={reason} onChange={e => setReason(e.target.value)} /></div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} /></div>
          </div>
        </div>
        <Button onClick={handleSave} className="w-full mt-2">Save Debit Note</Button>
      </DialogContent>
    </Dialog>
  );

  return (
    <AppLayout title="Debit Notes" headerActions={headerActions}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 stagger-children">
          <div className="summary-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><FileText className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Total Debit Notes</p>
              <p className="text-lg font-bold font-mono tabular-nums text-foreground">{notes.length}</p>
            </div>
          </div>
          <div className="summary-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center"><Truck className="h-5 w-5 text-destructive" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Supplier Notes</p>
              <p className="text-lg font-bold font-mono tabular-nums text-foreground">
                PKR {notes.filter(n => n.party_type === 'supplier').reduce((s, n) => s + Number(n.amount), 0).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="summary-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center"><Users className="h-5 w-5 text-accent-foreground" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Customer Notes</p>
              <p className="text-lg font-bold font-mono tabular-nums text-foreground">
                PKR {notes.filter(n => n.party_type === 'customer').reduce((s, n) => s + Number(n.amount), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="supplier">To Suppliers</TabsTrigger>
            <TabsTrigger value="customer">From Customers</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-4">
          <div className="relative max-w-sm flex-1 search-pill">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search debit notes..." className="pl-10 rounded-full border-0 shadow-none bg-transparent" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <p className="text-sm text-muted-foreground whitespace-nowrap">Total: PKR {totalAmount.toLocaleString()} ({filtered.length})</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"><Checkbox checked={filtered.length > 0 && bulk.selected.length === filtered.length} onCheckedChange={() => bulk.toggleAll(filtered.map(f => f.id))} /></TableHead>
                  <TableHead>DN #</TableHead><TableHead>Type</TableHead><TableHead>Party</TableHead>
                  <TableHead>Reason</TableHead><TableHead>Reference</TableHead><TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-center w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />No debit notes yet.</TableCell></TableRow>

                ) : filtered.map(dn => {
                  const applied = Number(dn.applied_amount || 0);
                  const remaining = Number(dn.amount) - applied;
                  const canApply = dn.party_type === "supplier" && remaining > 0.001;
                  return (
                  <TableRow key={dn.id} data-state={bulk.isSelected(dn.id) ? "selected" : undefined}>
                    <TableCell><RowCheckbox checked={bulk.isSelected(dn.id)} onCheckedChange={() => bulk.toggle(dn.id)} /></TableCell>
                    <TableCell className="font-medium font-mono">{dn.debit_note_number}</TableCell>

                    <TableCell><Badge variant={dn.party_type === "supplier" ? "default" : "secondary"} className="capitalize">{dn.party_type === "supplier" ? "To Supplier" : "From Customer"}</Badge></TableCell>
                    <TableCell className="font-medium">{partyNames[dn.party_id] || "—"}</TableCell>
                    <TableCell className="text-muted-foreground max-w-48 truncate">{dn.reason || "—"}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">{dn.reference || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{dn.date}</TableCell>
                    <TableCell className="text-right font-mono font-medium text-primary">PKR {Number(dn.amount).toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-mono ${remaining <= 0.001 ? "text-muted-foreground line-through" : "text-success font-semibold"}`}>PKR {remaining.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canApply && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setApplyNote(dn)} title="Apply to purchase invoice">
                            <Link2 className="h-3 w-3 mr-1" /> Apply
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(dn.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
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

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Debit Note?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this debit note and reverse the balance adjustment.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {applyNote && (
        <ApplyNoteDialog
          open={!!applyNote} onOpenChange={(o) => { if (!o) setApplyNote(null); }}
          kind="debit" noteId={applyNote.id} noteNumber={applyNote.debit_note_number}
          partyId={applyNote.party_id} noteAmount={Number(applyNote.amount)}
          appliedAlready={Number(applyNote.applied_amount || 0)}
          onApplied={() => { setApplyNote(null); load(); }}
        />
      )}
      <BulkActionBar selectedIds={bulk.selected} onClear={bulk.clear} entityLabel="debit note" onDeleteOne={deleteOne} onDone={load} />
    </AppLayout>
  );
}

