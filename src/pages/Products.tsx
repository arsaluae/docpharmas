import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Package, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

const categories = ["tablet", "capsule", "syrup", "injection", "cream", "ointment", "drops", "sachet", "other"] as const;

interface Product {
  id: string; name: string; sku: string | null; category: string; drap_reg_number: string | null;
  pack_size: string | null; unit: string; cost_price: number; selling_price: number; gst_rate: number;
  stock_quantity: number; reorder_level: number; created_at: string;
}

const emptyForm = {
  name: "", sku: "", category: "tablet" as string, drap_reg_number: "", pack_size: "", unit: "pcs",
  cost_price: "0", selling_price: "0", gst_rate: "17", stock_quantity: "0", reorder_level: "0",
};

export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };
    check(); loadProducts();
  }, [navigate]);

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (data) setProducts(data);
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
    setOpen(false); setForm(emptyForm); setEditId(null); loadProducts();
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
    toast.success("Product deleted");
    loadProducts();
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || "").toLowerCase().includes(search.toLowerCase())
  );

  const margin = (p: Product) => {
    if (Number(p.selling_price) === 0) return "—";
    return ((Number(p.selling_price) - Number(p.cost_price)) / Number(p.selling_price) * 100).toFixed(1) + "%";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Products</h1>
              <p className="text-sm text-muted-foreground">Product catalog with DRAP registration & costing</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/import?tab=products")}><Upload className="h-4 w-4 mr-1" /> Import CSV</Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
              </DialogTrigger>
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
                  <div><Label>GST Rate (%)</Label><Input type="number" value={form.gst_rate} onChange={e => setForm({...form, gst_rate: e.target.value})} /></div>
                  <div><Label>Cost Price (PKR)</Label><Input type="number" value={form.cost_price} onChange={e => setForm({...form, cost_price: e.target.value})} /></div>
                  <div><Label>Selling Price (PKR)</Label><Input type="number" value={form.selling_price} onChange={e => setForm({...form, selling_price: e.target.value})} /></div>
                  <div><Label>Stock Quantity</Label><Input type="number" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: e.target.value})} /></div>
                  <div><Label>Reorder Level</Label><Input type="number" value={form.reorder_level} onChange={e => setForm({...form, reorder_level: e.target.value})} /></div>
                </div>
                <Button onClick={handleSave} className="w-full mt-4">{editId ? "Update" : "Create"} Product</Button>
              </DialogContent>
            </Dialog>
          </header>
          <div className="p-6">
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
                        <TableCell className="text-right font-mono text-emerald-600">{margin(p)}</TableCell>
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
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
