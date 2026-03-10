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
import { Plus, Search, Package, Trash2, Upload, ArrowDownUp, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";

const categories = ["tablet", "capsule", "syrup", "injection", "cream", "ointment", "drops", "sachet", "other"] as const;
const MOVE_TYPES = ["purchase", "purchase_in", "sale", "sale_out", "return_in", "return_out", "adjustment", "adjustment_in", "adjustment_out", "opening", "damage", "expired"];

interface Product {
  id: string; name: string; sku: string | null; category: string; drap_reg_number: string | null;
  pack_size: string | null; unit: string; cost_price: number; selling_price: number; gst_rate: number;
  stock_quantity: number; reorder_level: number; created_at: string;
}

interface StockMovement {
  id: string; product_id: string; movement_type: string; quantity: number;
  batch_number: string | null; reference_type: string | null; date: string; notes: string | null;
}

const emptyForm = {
  name: "", sku: "", category: "tablet" as string, drap_reg_number: "", pack_size: "", unit: "pcs",
  cost_price: "0", selling_price: "0", gst_rate: "17", stock_quantity: "0", reorder_level: "0",
};

export default function Products() {
  const navigate = useNavigate();
  const { settings } = useCompanySettings();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const productPagination = usePagination();
  const movementPagination = usePagination();
  const [editId, setEditId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("catalog");

  // Stock movement form
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveProductId, setMoveProductId] = useState("");
  const [moveType, setMoveType] = useState("adjustment");
  const [moveQty, setMoveQty] = useState("");
  const [moveBatch, setMoveBatch] = useState("");
  const [moveDate, setMoveDate] = useState(new Date().toISOString().split("T")[0]);
  const [moveNotes, setMoveNotes] = useState("");
  const [moveTypeFilter, setMoveTypeFilter] = useState("all");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [prodRes, moveRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("stock_movements").select("*").order("created_at", { ascending: false }),
    ]);
    if (prodRes.data) setProducts(prodRes.data);
    if (moveRes.data) setMovements(moveRes.data);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Product name required"); return; }
    const payload = {
      name: form.name, sku: form.sku || null, category: form.category,
      drap_reg_number: form.drap_reg_number || null, pack_size: form.pack_size || null, unit: form.unit,
      cost_price: Number(form.cost_price), selling_price: Number(form.selling_price),
      gst_rate: Number(form.gst_rate), stock_quantity: Number(form.stock_quantity), reorder_level: Number(form.reorder_level),
    };
    if (editId) {
      await supabase.from("products").update(payload).eq("id", editId);
      toast.success("Product updated");
    } else {
      await supabase.from("products").insert(payload);
      toast.success("Product created");
    }
    setOpen(false); setForm(emptyForm); setEditId(null); loadAll();
  };

  const handleEdit = (p: Product) => {
    setEditId(p.id);
    setForm({
      name: p.name, sku: p.sku || "", category: p.category, drap_reg_number: p.drap_reg_number || "",
      pack_size: p.pack_size || "", unit: p.unit, cost_price: String(p.cost_price), selling_price: String(p.selling_price),
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

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || "").toLowerCase().includes(search.toLowerCase())
  );

  const margin = (p: Product) => {
    if (Number(p.selling_price) === 0) return "—";
    return ((Number(p.selling_price) - Number(p.cost_price)) / Number(p.selling_price) * 100).toFixed(1) + "%";
  };

  const productNames = Object.fromEntries(products.map(p => [p.id, p.name]));

  // Stock overview calculations
  const totalStockValue = products.reduce((s, p) => s + Number(p.stock_quantity) * Number(p.cost_price), 0);
  const totalRetailValue = products.reduce((s, p) => s + Number(p.stock_quantity) * Number(p.selling_price), 0);
  const lowStockCount = products.filter(p => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= Number(p.reorder_level)).length;
  const outOfStockCount = products.filter(p => Number(p.stock_quantity) <= 0).length;

  const filteredMovements = movements.filter(m => {
    const matchSearch = (productNames[m.product_id] || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.batch_number || "").toLowerCase().includes(search.toLowerCase());
    if (moveTypeFilter !== "all") return matchSearch && m.movement_type === moveTypeFilter;
    return matchSearch;
  });

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

  const headerActions = (
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
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Product</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="col-span-2"><Label>Product Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} /></div>
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
              <div><Label>Cost Price (PKR)</Label><Input type="number" value={form.cost_price} onChange={e => setForm({...form, cost_price: e.target.value})} /></div>
              <div><Label>Selling Price (PKR)</Label><Input type="number" value={form.selling_price} onChange={e => setForm({...form, selling_price: e.target.value})} /></div>
              <div><Label>Stock Quantity</Label><Input type="number" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: e.target.value})} /></div>
              <div><Label>Reorder Level</Label><Input type="number" value={form.reorder_level} onChange={e => setForm({...form, reorder_level: e.target.value})} /></div>
            </div>
            <Button onClick={handleSave} className="w-full mt-4">{editId ? "Update" : "Create"} Product</Button>
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
                <div className="mb-4 relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search products..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Card className="glass-card">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead><TableHead>DRAP</TableHead>
                          <TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Margin</TableHead><TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.length === 0 ? (
                          <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground"><Package className="h-8 w-8 mx-auto mb-2 opacity-40" />No products yet.</TableCell></TableRow>
                        ) : filtered.map(p => (
                          <TableRow key={p.id} className="cursor-pointer hover:bg-accent/50" onClick={() => handleEdit(p)}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{p.sku || "—"}</TableCell>
                            <TableCell><span className="status-pill bg-violet-50 text-violet-700 capitalize">{p.category}</span></TableCell>
                            <TableCell className="text-xs">{p.drap_reg_number || "—"}</TableCell>
                            <TableCell className="text-right font-mono">{Number(p.cost_price).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{Number(p.selling_price).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono text-primary">{margin(p)}</TableCell>
                            <TableCell className="text-right">
                              <span className={Number(p.stock_quantity) <= Number(p.reorder_level) ? "text-destructive font-semibold" : ""}>{Number(p.stock_quantity).toLocaleString()}</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div onClick={e => e.stopPropagation()}>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Delete {p.name}?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this product.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(e) => handleDelete(p.id, e)}>Delete</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* STOCK OVERVIEW TAB */}
              <TabsContent value="stock">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <Card className="glass-card"><CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total Stock Value</p>
                    <p className="text-xl font-bold font-heading text-foreground">PKR {totalStockValue.toLocaleString()}</p>
                  </CardContent></Card>
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
                          <TableHead className="text-right">Cost Price</TableHead>
                          <TableHead className="text-right">Sell Price</TableHead>
                          <TableHead className="text-right">Stock Value</TableHead>
                          <TableHead className="text-right">Margin</TableHead>
                          <TableHead className="text-right">Reorder</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.length === 0 ? (
                          <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No products yet.</TableCell></TableRow>
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
                              <TableCell className="text-right font-mono">{cost.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-mono">{sell.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-mono font-semibold">{(qty * cost).toLocaleString()}</TableCell>
                              <TableCell className="text-right font-mono text-primary">{margin(p)}</TableCell>
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
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
    </AppLayout>
  );
}
