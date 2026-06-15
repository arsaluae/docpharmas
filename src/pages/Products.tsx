import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Search, Package, Trash2, Upload, ArrowDownUp, Banknote, AlertTriangle, TrendingUp, Layers, Power } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ProductBatchProfileDialog } from "@/components/ProductBatchProfileDialog";
// Opening Stock is now a dedicated workspace at /opening-stock (multi-product, multi-batch document).
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useTenant } from "@/hooks/useTenant";
import { useRoles } from "@/hooks/useRoles";
import { isSalesAgentRole } from "@/lib/rbac";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { escIlike, searchProductIds } from "@/lib/search-helpers";

const categories = ["tablet", "capsule", "syrup", "injection", "cream", "ointment", "drops", "sachet", "other"] as const;
const MOVE_TYPES = ["purchase", "purchase_in", "sale", "sale_out", "return_in", "return_out", "adjustment", "adjustment_in", "adjustment_out", "opening", "damage", "expired"];

interface Product {
 id: string; name: string; sku: string | null; category: string; drap_reg_number: string | null;
 pack_size: string | null; unit: string; cost_price: number; purchase_cost?: number; selling_price: number; gst_rate: number;
 stock_quantity: number; reorder_level: number; created_at: string; is_active?: boolean; mrp?: number | null;
}

interface StockMovement {
 id: string; product_id: string; movement_type: string; quantity: number;
 batch_number: string | null; reference_type: string | null; date: string; notes: string | null;
}

const emptyForm = {
 name: "", sku: "", category: "tablet" as string, drap_reg_number: "", pack_size: "", unit: "pcs",
 purchase_cost: "0", selling_price: "0", mrp: "0", gst_rate: "17", stock_quantity: "0", reorder_level: "0",
};

export default function Products() {
 const navigate = useNavigate();
 const { settings } = useCompanySettings();
 const { tenantRole, isAdmin } = useTenant();
 const { role } = useRoles();
 const hideCost = isSalesAgentRole(role);
 const readOnly = tenantRole === "staff" && !isAdmin;
 const [products, setProducts] = useState<Product[]>([]);
 const [movements, setMovements] = useState<StockMovement[]>([]);
 const [search, setSearch] = useState("");
 const [form, setForm] = useState(emptyForm);
 const [open, setOpen] = useState(false);
 const productPagination = usePagination();
 const movementPagination = usePagination();
 const [editId, setEditId] = useState<string | null>(null);
 const [activeTab, setActiveTab] = useState("catalog");
 const [profileProduct, setProfileProduct] = useState<Product | null>(null);

 // Stock movement form
 const [moveOpen, setMoveOpen] = useState(false);
 const [moveProductId, setMoveProductId] = useState("");
 const [moveType, setMoveType] = useState("adjustment");
 const [moveQty, setMoveQty] = useState("");
 const [moveBatch, setMoveBatch] = useState("");
 const [moveDate, setMoveDate] = useState(new Date().toISOString().split("T")[0]);
 const [moveNotes, setMoveNotes] = useState("");
 const [moveTypeFilter, setMoveTypeFilter] = useState("all");
 const [showInactive, setShowInactive] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);
  useEffect(() => { productPagination.setPage(0); movementPagination.setPage(0); /* reset to first page when search changes */ }, [debouncedSearch]);
  useEffect(() => { loadAll(); }, [productPagination.page, movementPagination.page, moveTypeFilter, showInactive, debouncedSearch]);

  const loadAll = async () => {
  const q = debouncedSearch.trim();
  const safe = escIlike(q);

  // Stock movements query — server-side filter on batch_number / notes,
  // plus product_id ∈ (matching products) so searching by product name finds the right rows.
  let moveQuery = supabase.from("stock_movements").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (moveTypeFilter !== "all") moveQuery = moveQuery.eq("movement_type", moveTypeFilter);
  if (q) {
    const prodIds = await searchProductIds(q);
    const idClause = prodIds.length > 0 ? `,product_id.in.(${prodIds.join(",")})` : "";
    moveQuery = moveQuery.or(`batch_number.ilike.%${safe}%,notes.ilike.%${safe}%${idClause}`);
  }
  moveQuery = moveQuery.range(movementPagination.from, movementPagination.to);

  // Sales agents read from the cost-free catalog view (sa_deny_products blocks direct reads).
  let prodQuery: any = hideCost
    ? supabase.from("sales_product_catalog_view").select("*", { count: "exact" }).order("product_name", { ascending: true })
    : supabase.from("products").select("*", { count: "exact" }).order("created_at", { ascending: false });
  if (!hideCost && !showInactive) prodQuery = prodQuery.eq("is_active", true);
  if (q) {
    prodQuery = hideCost
      ? prodQuery.or(`product_name.ilike.%${safe}%,sku.ilike.%${safe}%,product_code.ilike.%${safe}%,generic_name.ilike.%${safe}%,brand.ilike.%${safe}%`)
      : prodQuery.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%,product_code.ilike.%${safe}%,generic_name.ilike.%${safe}%,brand.ilike.%${safe}%`);
  }
  const [prodRes, moveRes] = await Promise.all([
  prodQuery.range(productPagination.from, productPagination.to),
  moveQuery,
  ]);
 if (prodRes.data) {
   // Normalize view rows → Product-shaped objects (no cost data exposed)
   const rows = hideCost
     ? (prodRes.data as any[]).map((r) => ({
         id: r.product_id, name: r.product_name ?? r.name, sku: r.sku, product_code: r.product_code,
         category: r.category, pack_size: r.pack_size, unit: r.unit,
         cost_price: 0, selling_price: r.selling_price ?? r.sale_price ?? 0, mrp: r.mrp ?? 0,
         gst_rate: r.gst_rate ?? 0, stock_quantity: r.available_qty ?? 0,
         reorder_level: r.reorder_level ?? 0, is_active: true,
         drap_reg_number: null, generic_name: r.generic_name, brand: r.brand,
         supplier_name: r.supplier_name, batch_count: r.batch_count, nearest_expiry: r.nearest_expiry,
       }))
     : prodRes.data;
   setProducts(rows as any);
 }
 if (prodRes.count !== null) productPagination.setTotalCount(prodRes.count);
 if (moveRes.data) setMovements(moveRes.data);
 if (moveRes.count !== null) movementPagination.setTotalCount(moveRes.count);
 };

 const toggleActive = async (p: Product, e: React.MouseEvent) => {
 e.stopPropagation();
 const { error } = await supabase.from("products").update({ is_active: !p.is_active } as any).eq("id", p.id);
 if (error) { toast.error("Failed: " + error.message); return; }
 toast.success(p.is_active ? "Product deactivated" : "Product reactivated");
 loadAll();
 };

  const handleSave = async () => {
  if (!form.name.trim()) { toast.error("Product name required"); return; }
  // Stock quantity is intentionally NOT in update payload — all stock changes must
  // flow through stock_movements so triggers, audit, and negative-stock guard fire.
    const basePayload: any = {
    is_active: true,
    name: form.name, sku: form.sku || null, category: form.category,
    drap_reg_number: form.drap_reg_number || null, pack_size: form.pack_size || null, unit: form.unit,
    purchase_cost: Number(form.purchase_cost), selling_price: Number(form.selling_price),
    mrp: Number(form.mrp) || 0,
    gst_rate: Number(form.gst_rate), reorder_level: Number(form.reorder_level),
    };
   let savedId = editId;
   if (editId) {
     // Don't touch cost_price (landed cache) on plain edit — only purchase_cost changes here.
     const { error } = await supabase.from("products").update(basePayload).eq("id", editId);
     if (error) { toast.error("Failed: " + error.message); return; }
   } else {
     // Auto-generate SKU if missing
     let sku = (form.sku || "").trim();
     if (!sku) {
       const { data: gen } = await supabase.rpc("generate_sku" as any);
       sku = (gen as string) || null as any;
     }
     // Seed landed cache = purchase cost until landed-cost engine runs.
     const insertPayload = { ...basePayload, sku, cost_price: Number(form.purchase_cost), stock_quantity: 0 };
     const { data: created, error: createErr } = await supabase
       .from("products")
       .insert(insertPayload)
       .select("id")
       .single();
     if (createErr) { toast.error("Failed: " + createErr.message); return; }
     savedId = created?.id || null;
   }
    // Opening stock is now managed from /opening-stock (dedicated workspace).
   toast.success(editId ? "Product updated" : "Product created");
   setOpen(false); setForm(emptyForm); setEditId(null); loadAll();
   };

 const handleEdit = (p: Product) => {
 setEditId(p.id);
 setForm({
 name: p.name, sku: p.sku || "", category: p.category, drap_reg_number: p.drap_reg_number || "",
 pack_size: p.pack_size || "", unit: p.unit, purchase_cost: String((p as any).purchase_cost ?? p.cost_price), selling_price: String(p.selling_price),
 mrp: String(p.mrp ?? 0),
 gst_rate: String(p.gst_rate), stock_quantity: String(p.stock_quantity), reorder_level: String(p.reorder_level),
 });
 setOpen(true);
 };

 const handleDelete = async (id: string, e: React.MouseEvent) => {
 e.stopPropagation();
 const { error } = await supabase.from("products").delete().eq("id", id);
 if (error) { toast.error("Cannot delete — may have linked records"); return; }
 toast.success("Product deleted"); loadAll();
 };

 const handleSaveMovement = async () => {
 if (!moveProductId || !moveQty || Number(moveQty) <= 0) { toast.error("Product and quantity required"); return; }
 await supabase.from("stock_movements").insert({
 product_id: moveProductId, movement_type: moveType, quantity: Number(moveQty),
 batch_number: moveBatch || null, date: moveDate, notes: moveNotes || null,
 });
 toast.success("Stock movement recorded");
 setMoveOpen(false); setMoveProductId(""); setMoveType("adjustment"); setMoveQty(""); setMoveBatch(""); setMoveNotes("");
 loadAll();
 };

  // Server-side search is now applied in loadAll(), so the rendered list is already filtered.
  const filtered = products;

 // Landed cost = products.cost_price (kept in sync by product_landed_costs trigger).
 // Falls back to purchase_cost when no landed entry exists yet.
 const landedOf = (p: Product) => {
   const purchase = Number((p as any).purchase_cost ?? p.cost_price ?? 0);
   const cached = Number(p.cost_price ?? 0);
   return cached > 0 ? cached : purchase;
 };
  // Markup on cost: (Sale − Landed) ÷ Landed × 100. Pharma distribution standard.
  const margin = (p: Product) => {
    const sale = Number(p.selling_price);
    const landed = landedOf(p);
    if (landed <= 0 || sale <= 0) return "—";
    return (((sale - landed) / landed) * 100).toFixed(2) + "%";
  };
 const landedMissing = (p: Product) => {
   const purchase = Number((p as any).purchase_cost ?? 0);
   const landed = Number(p.cost_price ?? 0);
   return purchase > 0 && Math.abs(landed - purchase) < 0.001;
 };

 const productNames = Object.fromEntries(products.map(p => [p.id, p.name]));

 // Stock overview calculations
 const totalStockValue = products.reduce((s, p) => s + Number(p.stock_quantity) * Number(p.cost_price), 0);
 const totalRetailValue = products.reduce((s, p) => s + Number(p.stock_quantity) * Number(p.selling_price), 0);
 const lowStockCount = products.filter(p => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= Number(p.reorder_level)).length;
 const outOfStockCount = products.filter(p => Number(p.stock_quantity) <= 0).length;

  // Server-side search already filters movements.
  const filteredMovements = movements;

 const typeBadge = (t: string) => {
 if (t.includes("in")) return <Badge variant="default" className="bg-primary/10 text-primary border-0">{t.replace("_", " ")}</Badge>;
 if (t.includes("out")) return <Badge variant="destructive">{t.replace("_", " ")}</Badge>;
 return <Badge variant="secondary">{t}</Badge>;
 };

 const stockStatus = (p: Product) => {
 if (Number(p.stock_quantity) <= 0) return <Badge variant="destructive">Out</Badge>;
 if (Number(p.stock_quantity) <= Number(p.reorder_level)) return <Badge className="bg-warning/10 text-warning border-0">Low</Badge>;
 return <Badge className="bg-primary/10 text-primary border-0">OK</Badge>;
 };

 const headerActions = readOnly ? (
 <span className="text-xs uppercase tracking-wider px-2 py-1 rounded-full border border-border text-muted-foreground">Read-only</span>
 ) : (
 <>
 <Button variant="outline" size="sm" onClick={() => navigate("/import?tab=products")}><Upload className="h-4 w-4 mr-1" /> Import</Button>
 
 {activeTab === "movements" ? (
 <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
 <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record Movement</Button></DialogTrigger>
 <DialogContent>
 <DialogHeader><DialogTitle>Record Stock Movement</DialogTitle></DialogHeader>
 <div className="grid grid-cols-2 gap-3 mt-2">
 <div className="col-span-2">
 <Label>Product *</Label>
 <Select value={moveProductId} onValueChange={setMoveProductId}>
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
 <div><Label>Quantity *</Label><Input type="number" value={moveQty} onChange={e => setMoveQty(e.target.value)} /></div>
 <div><Label>Batch #</Label><Input value={moveBatch} onChange={e => setMoveBatch(e.target.value)} /></div>
 <div><Label>Date</Label><Input type="date" value={moveDate} onChange={e => setMoveDate(e.target.value)} /></div>
 <div className="col-span-2"><Label>Notes</Label><Input value={moveNotes} onChange={e => setMoveNotes(e.target.value)} /></div>
 </div>
 <Button onClick={handleSaveMovement} className="w-full mt-4">Save</Button>
 </DialogContent>
 </Dialog>
 ) : (
 <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
 <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Product</Button></DialogTrigger>
  <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
  <DialogHeader><DialogTitle className="font-heading">{editId ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">
    {/* LEFT — identity & pricing */}
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2"><Label>Product Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} autoFocus /></div>
      <div>
        <Label>SKU {!editId && <span className="text-[10px] text-muted-foreground">(auto if blank)</span>}</Label>
        <Input
          value={form.sku}
          readOnly={!editId && !isAdmin}
          onChange={e => setForm({...form, sku: e.target.value})}
          placeholder={editId ? "" : "PRD-0001"}
        />
      </div>
      <div>
        <Label>Category</Label>
        <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>DRAP Reg. No.</Label><Input value={form.drap_reg_number} onChange={e => setForm({...form, drap_reg_number: e.target.value})} /></div>
      <div><Label>Pack Size</Label><Input value={form.pack_size} onChange={e => setForm({...form, pack_size: e.target.value})} placeholder="e.g. 10x10" /></div>
      <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} /></div>
      {settings?.gst_enabled && <div><Label>GST Rate (%)</Label><Input type="number" value={form.gst_rate} onChange={e => setForm({...form, gst_rate: e.target.value})} /></div>}
      {!hideCost && <div className="col-span-2"><Label>Purchase Cost (PKR)</Label><Input type="number" value={form.purchase_cost} onChange={e => setForm({...form, purchase_cost: e.target.value})} /><p className="text-[10px] text-muted-foreground mt-1">Supplier base. Landed cost is managed in the batch/landed-cost drawer.</p></div>}
      <div><Label>Net Price (PKR) *</Label><Input type="number" value={form.selling_price} onChange={e => setForm({...form, selling_price: e.target.value})} placeholder="Hits all ledgers" /></div>
      <div><Label>MRP (PKR)</Label><Input type="number" value={form.mrp} onChange={e => setForm({...form, mrp: e.target.value})} placeholder="Display only" /></div>
      <div><Label>Reorder Level</Label><Input type="number" value={form.reorder_level} onChange={e => setForm({...form, reorder_level: e.target.value})} /></div>
    </div>

    {/* RIGHT — opening stock / batches */}
    <div className="border-l-0 lg:border-l border-border lg:pl-6">
      <OpeningStockPanel ref={openingPanelRef} productId={editId} />
    </div>
  </div>
  <div className="flex gap-2 justify-end mt-5">
    <Button variant="outline" onClick={() => { setOpen(false); setEditId(null); setForm(emptyForm); }}>Cancel</Button>
    <Button onClick={handleSave}>{editId ? "Save Changes" : "Create Product"}</Button>
  </div>
  </DialogContent>
 </Dialog>
 )}
 </>
 );

 return (
 <AppLayout title="Products & Stock" subtitle="Catalog, stock overview & movements" headerActions={headerActions}>
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList className="mb-4">
 <TabsTrigger value="catalog">Catalog</TabsTrigger>
 <TabsTrigger value="stock">Stock Overview</TabsTrigger>
 <TabsTrigger value="movements">Movements</TabsTrigger>
 </TabsList>

 {/* CATALOG TAB */}
 <TabsContent value="catalog">
 <div className="mb-4 flex items-center gap-3">
 <div className="relative max-w-sm flex-1 search-pill">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input placeholder="Search products..." className="pl-10 rounded-full border-0 shadow-none bg-transparent" value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
 <Switch checked={showInactive} onCheckedChange={setShowInactive} /> Show inactive
 </label>
 </div>
 <Card className="glass-card">
 <CardContent className="p-0">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead>
 {!hideCost && <TableHead className="text-right">Purchase</TableHead>}
 {!hideCost && <TableHead className="text-right">Landed</TableHead>}
 <TableHead className="text-right">Net Price</TableHead><TableHead className="text-right">MRP</TableHead>
 {!hideCost && <TableHead className="text-right" title="(Sale − Landed) ÷ Landed × 100">Markup %</TableHead>}
 <TableHead className="text-right">Stock</TableHead>
 <TableHead className="text-center">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filtered.length === 0 ? (
 <TableRow><TableCell colSpan={hideCost ? 7 : 10} className="text-center py-12 text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-2 opacity-40" />No products yet.</TableCell></TableRow>
 ) : filtered.map(p => (
 <TableRow key={p.id} className={`${readOnly ? "" : "cursor-pointer"} table-row-hover ${p.is_active === false ? "opacity-50" : ""}`} onClick={() => { if (!readOnly) handleEdit(p); }}>
 <TableCell className="text-xs font-mono">{p.sku || (p as any).product_code || "—"}</TableCell>
 <TableCell className="font-medium">{p.name}</TableCell>
 <TableCell><span className="status-pill bg-primary/10 text-primary capitalize">{p.category}</span></TableCell>
 {!hideCost && <TableCell className="text-right font-mono tabular-nums">{Number((p as any).purchase_cost ?? p.cost_price).toLocaleString()}</TableCell>}
 {!hideCost && <TableCell className="text-right font-mono tabular-nums">{landedOf(p).toLocaleString()}</TableCell>}
 <TableCell className="text-right font-mono tabular-nums">{Number(p.selling_price).toLocaleString()}</TableCell>
 <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{Number(p.mrp || 0) > 0 ? Number(p.mrp).toLocaleString() : "—"}</TableCell>
 {!hideCost && (
   <TableCell className="text-right font-mono tabular-nums">
     <span className="text-primary">{margin(p)}</span>
     {landedMissing(p) && <Badge variant="outline" className="ml-1 text-[9px] py-0 px-1 text-warning border-warning/40">no landed</Badge>}
   </TableCell>
 )}
 <TableCell className="text-right">
 <span className={Number(p.stock_quantity) <= Number(p.reorder_level) ? "text-destructive font-semibold" : ""}>{Number(p.stock_quantity).toLocaleString()}</span>
 </TableCell>
 <TableCell className="text-center">
 <div onClick={e => e.stopPropagation()} className="flex items-center justify-center gap-1">
 <Button
 variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary"
 title="Batch profile & landed cost"
 onClick={() => setProfileProduct(p)}
 >
 <Layers className="h-3.5 w-3.5" />
 </Button>
  {!readOnly && (
  <>
  <Button variant="ghost" size="icon" className={`h-7 w-7 ${p.is_active === false ? "text-success" : "text-warning"}`} onClick={(e) => toggleActive(p, e)} title={p.is_active === false ? "Reactivate" : "Deactivate"}><Power className="h-3.5 w-3.5" /></Button>
  <AlertDialog>
  <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
  <AlertDialogContent>
  <AlertDialogHeader><AlertDialogTitle>Delete {p.name}?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this product.</AlertDialogDescription></AlertDialogHeader>
  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(e) => handleDelete(p.id, e)}>Delete</AlertDialogAction></AlertDialogFooter>
  </AlertDialogContent>
  </AlertDialog>
  </>
  )}
 </div>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 <PaginationControls
 page={productPagination.page} totalPages={productPagination.totalPages} totalCount={productPagination.totalCount}
 hasNext={productPagination.hasNext} hasPrev={productPagination.hasPrev}
 onNext={productPagination.nextPage} onPrev={productPagination.prevPage} pageSize={productPagination.pageSize}
 />
 </CardContent>
 </Card>
 </TabsContent>

 {/* STOCK OVERVIEW TAB */}
 <TabsContent value="stock">
 <div className={`grid grid-cols-2 ${hideCost ? "md:grid-cols-3" : "md:grid-cols-4"} gap-4 mb-4`}>
 {!hideCost && (
 <Card className="glass-card"><CardContent className="p-4">
 <p className="text-xs text-muted-foreground">Total Stock Value</p>
 <p className="text-xl font-bold font-heading text-foreground">PKR {totalStockValue.toLocaleString()}</p>
 </CardContent></Card>
 )}
 <Card className="glass-card"><CardContent className="p-4">
 <p className="text-xs text-muted-foreground">Total Retail Value</p>
 <p className="text-xl font-bold font-heading text-foreground">PKR {totalRetailValue.toLocaleString()}</p>
 </CardContent></Card>
 <Card className="glass-card"><CardContent className="p-4">
 <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-warning" /> Low Stock</p>
 <p className="text-xl font-bold font-heading text-warning">{lowStockCount}</p>
 </CardContent></Card>
 <Card className="glass-card"><CardContent className="p-4">
 <p className="text-xs text-muted-foreground">Out of Stock</p>
 <p className="text-xl font-bold font-heading text-destructive">{outOfStockCount}</p>
 </CardContent></Card>
 </div>

 <Card className="glass-card">
 <CardContent className="p-0">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Product</TableHead>
 <TableHead className="text-right">Stock</TableHead>
 {!hideCost && <TableHead className="text-right">Cost Price</TableHead>}
 <TableHead className="text-right">Sell Price</TableHead>
 {!hideCost && <TableHead className="text-right">Stock Value</TableHead>}
 {!hideCost && <TableHead className="text-right" title="(Sale − Landed) ÷ Landed × 100">Markup %</TableHead>}
 <TableHead className="text-right">Reorder</TableHead>
 <TableHead className="text-center">Status</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {products.length === 0 ? (
 <TableRow><TableCell colSpan={hideCost ? 5 : 8} className="text-center py-12 text-muted-foreground">No products yet.</TableCell></TableRow>
 ) : products.map(p => {
 const qty = Number(p.stock_quantity);
 const cost = Number(p.cost_price);
 const sell = Number(p.selling_price);
 const isOut = qty <= 0;
 const isLow = qty > 0 && qty <= Number(p.reorder_level);
 return (
 <TableRow key={p.id} className={isOut ? "bg-destructive/5" : isLow ? "bg-warning/5" : ""}>
 <TableCell className="font-medium">{p.name}</TableCell>
 <TableCell className="text-right font-mono">{qty.toLocaleString()}</TableCell>
 {!hideCost && <TableCell className="text-right font-mono">{cost.toLocaleString()}</TableCell>}
 <TableCell className="text-right font-mono">{sell.toLocaleString()}</TableCell>
 {!hideCost && <TableCell className="text-right font-mono font-semibold">{(qty * cost).toLocaleString()}</TableCell>}
 {!hideCost && <TableCell className="text-right font-mono text-primary">{margin(p)}</TableCell>}
 <TableCell className="text-right font-mono text-muted-foreground">{Number(p.reorder_level)}</TableCell>
 <TableCell className="text-center">{stockStatus(p)}</TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </TabsContent>

 {/* MOVEMENTS TAB */}
 <TabsContent value="movements">
 <div className="flex items-center gap-4 mb-4">
 <div className="relative max-w-sm flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input placeholder="Search by product or batch..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 <Select value={moveTypeFilter} onValueChange={setMoveTypeFilter}>
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
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredMovements.length === 0 ? (
 <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
 <ArrowDownUp className="h-8 w-8 mx-auto mb-2 opacity-40" />No stock movements.
 </TableCell></TableRow>
 ) : filteredMovements.map(m => (
 <TableRow key={m.id}>
 <TableCell className="font-medium">{productNames[m.product_id] || "—"}</TableCell>
 <TableCell>{typeBadge(m.movement_type)}</TableCell>
 <TableCell className="font-mono">{Number(m.quantity)}</TableCell>
 <TableCell className="text-muted-foreground">{m.batch_number || "—"}</TableCell>
 <TableCell className="text-muted-foreground">{m.date}</TableCell>
 <TableCell className="text-muted-foreground text-xs">{m.notes || "—"}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 <PaginationControls
 page={movementPagination.page} totalPages={movementPagination.totalPages} totalCount={movementPagination.totalCount}
 hasNext={movementPagination.hasNext} hasPrev={movementPagination.hasPrev}
 onNext={movementPagination.nextPage} onPrev={movementPagination.prevPage} pageSize={movementPagination.pageSize}
 />
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 <ProductBatchProfileDialog
 open={!!profileProduct}
 onOpenChange={(o) => { if (!o) setProfileProduct(null); }}
 productId={profileProduct?.id || null}
 productName={profileProduct?.name}
 productCode={profileProduct?.sku || (profileProduct as any)?.product_code}
 purchaseCost={Number((profileProduct as any)?.purchase_cost ?? profileProduct?.cost_price ?? 0)}
 salePrice={Number(profileProduct?.selling_price || 0)}
 currentLandedCost={Number(profileProduct?.cost_price || 0)}
 onSaved={loadAll}
 />
 </AppLayout>
 );
}
