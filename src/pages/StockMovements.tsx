import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, ArrowDownUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { useTenant } from "@/hooks/useTenant";
import { logAudit } from "@/lib/audit";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { escIlike, searchProductIds } from "@/lib/search-helpers";

const ADJUSTMENT_TYPES = new Set(["adjustment", "adjustment_in", "adjustment_out"]);

const MOVE_TYPES = ["purchase", "purchase_in", "sale", "sale_out", "return_in", "return_out", "adjustment", "adjustment_in", "adjustment_out", "opening", "damage", "expired"];

interface Product { id: string; name: string; stock_quantity: number; }
interface StockMovement {
  id: string; product_id: string; movement_type: string; quantity: number;
  batch_number: string | null; reference_type: string | null; date: string; notes: string | null;
}

export default function StockMovements() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const pagination = usePagination();

  const [productId, setProductId] = useState("");
  const [moveType, setMoveType] = useState("adjustment");
  const [quantity, setQuantity] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const debouncedSearch = useDebouncedValue(search, 300);
  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { pagination.setPage(0); }, [debouncedSearch, typeFilter]);
  useEffect(() => { load(); }, [pagination.page, typeFilter, debouncedSearch]);

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("id, name, stock_quantity");
    if (data) {
      setProducts(data);
      const names: Record<string, string> = {};
      data.forEach(p => { names[p.id] = p.name; });
      setProductNames(names);
    }
  };

  const load = async () => {
    let query = supabase.from("stock_movements").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (typeFilter !== "all") query = query.eq("movement_type", typeFilter);
    const q = debouncedSearch.trim();
    if (q) {
      const safe = escIlike(q);
      const prodIds = await searchProductIds(q);
      const idClause = prodIds.length > 0 ? `,product_id.in.(${prodIds.join(",")})` : "";
      query = query.or(`batch_number.ilike.%${safe}%,notes.ilike.%${safe}%${idClause}`);
    }
    query = query.range(pagination.from, pagination.to);
    const { data, count } = await query;
    if (data) setMovements(data);
    if (count !== null) pagination.setTotalCount(count);
  };

  const handleSave = async () => {
    if (!productId || !quantity || Number(quantity) <= 0) { toast.error("Product and quantity required"); return; }
    const isAdjustment = ADJUSTMENT_TYPES.has(moveType);
    if (isAdjustment && (!notes || notes.trim().length < 3)) {
      toast.error("A reason (min 3 characters) is required for stock adjustments.");
      return;
    }
    const { data: inserted, error } = await supabase.from("stock_movements").insert({
      product_id: productId, movement_type: moveType, quantity: Number(quantity),
      batch_number: batchNumber || null, date, notes: notes || null,
    }).select("id").single();
    if (error) {
      if (error.message?.includes("Insufficient stock")) {
        const name = productNames[productId] || "product";
        toast.error(`Insufficient stock for ${name} (requested ${quantity}).`);
      } else if (error.message?.includes("requires a reason")) {
        toast.error("A reason (min 3 characters) is required for stock adjustments.");
      } else {
        toast.error("Failed to record movement: " + error.message);
      }
      return;
    }
    if (isAdjustment && inserted?.id) {
      void logAudit({
        action: "stock_adjusted",
        entity_type: "stock_movement",
        entity_id: inserted.id,
        changes: {
          product: productNames[productId] || productId,
          movement_type: moveType,
          quantity: Number(quantity),
          batch_number: batchNumber || null,
          reason: notes,
          date,
        },
      });
    }
    toast.success("Stock movement recorded");
    setOpen(false); setProductId(""); setMoveType("adjustment"); setQuantity(""); setBatchNumber(""); setNotes("");
    load(); loadProducts();
  };

  // Server-side search already filters movements across all pages.
  const filtered = movements;

  const typeBadge = (t: string) => {
    if (t.includes("in")) return <Badge variant="default" className="bg-primary/10 text-primary border-0">{t.replace("_", " ")}</Badge>;
    if (t.includes("out")) return <Badge variant="destructive">{t.replace("_", " ")}</Badge>;
    return <Badge variant="secondary">{t}</Badge>;
  };

  const { tenantRole, isAdmin } = useTenant();
  const readOnly = tenantRole === "staff" && !isAdmin;
  const canDeleteOpening = !readOnly;

  const handleDeleteOpening = async (m: StockMovement) => {
    const { error } = await supabase.from("stock_movements").delete().eq("id", m.id);
    if (error) { toast.error("Delete failed: " + error.message); return; }
    void logAudit({
      action: "stock_adjusted",
      entity_type: "stock_movement",
      entity_id: m.id,
      entity_number: m.batch_number || "opening",
      changes: { deleted: true, product: productNames[m.product_id], quantity: m.quantity, type: m.movement_type },
    });
    toast.success("Opening stock row deleted");
    load(); loadProducts();
  };

  const headerActions = readOnly ? (
    <span className="text-xs uppercase tracking-wider px-2 py-1 rounded-full border border-border text-muted-foreground">Read-only</span>
  ) : (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record Movement</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Stock Movement</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="col-span-2">
            <Label>Product *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
              <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {p.stock_quantity})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={moveType} onValueChange={setMoveType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MOVE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Quantity *</Label><Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
          <div><Label>Batch #</Label><Input value={batchNumber} onChange={e => setBatchNumber(e.target.value)} /></div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="col-span-2">
            <Label>
              Reason / Notes {ADJUSTMENT_TYPES.has(moveType) && <span className="text-destructive">*</span>}
            </Label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={ADJUSTMENT_TYPES.has(moveType) ? "Required — explain why stock is being adjusted" : "Optional"}
            />
            {ADJUSTMENT_TYPES.has(moveType) && (
              <p className="text-xs text-muted-foreground mt-1">
                Adjustments are audited. A reason of at least 3 characters is required.
              </p>
            )}
          </div>
        </div>
        <Button onClick={handleSave} className="w-full mt-4">Save</Button>
      </DialogContent>
    </Dialog>
  );

  return (
    <AppLayout title="Stock Movements" subtitle="Track inventory adjustments with batch numbers" headerActions={headerActions}>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by product or batch..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); pagination.resetPage(); }}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {MOVE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead><TableHead>Type</TableHead><TableHead>Qty</TableHead>
                      <TableHead>Batch</TableHead><TableHead>Date</TableHead><TableHead>Notes</TableHead>
                      {canDeleteOpening && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={canDeleteOpening ? 7 : 6} className="text-center py-12 text-muted-foreground">
                        <ArrowDownUp className="h-8 w-8 mx-auto mb-2 opacity-40" />No stock movements.
                      </TableCell></TableRow>
                    ) : filtered.map(m => {
                      const isOpening = m.movement_type === "opening" || m.movement_type === "opening_stock";
                      return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{productNames[m.product_id] || "—"}</TableCell>
                        <TableCell>{typeBadge(m.movement_type)}</TableCell>
                        <TableCell className="font-mono">{Number(m.quantity)}</TableCell>
                        <TableCell className="text-muted-foreground">{m.batch_number || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.date}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{m.notes || "—"}</TableCell>
                        {canDeleteOpening && (
                          <TableCell className="text-right">
                            {isOpening ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete opening row">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this opening stock row?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Removes {Number(m.quantity).toLocaleString()} units of {productNames[m.product_id] || "this product"}
                                      {m.batch_number ? ` (batch ${m.batch_number})` : ""}. Stock count updates automatically. Audited.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteOpening(m)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );})}
                  </TableBody>
                </Table>
                <PaginationControls
                  page={pagination.page} totalPages={pagination.totalPages} totalCount={pagination.totalCount}
                  hasNext={pagination.hasNext} hasPrev={pagination.hasPrev}
                  onNext={pagination.nextPage} onPrev={pagination.prevPage} pageSize={pagination.pageSize}
                />
              </CardContent>
            </Card>
    </AppLayout>
  );
}
