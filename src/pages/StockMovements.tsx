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
import { Plus, Search, ArrowDownUp } from "lucide-react";
import { toast } from "sonner";

const MOVE_TYPES = ["purchase_in", "sale_out", "return_in", "return_out", "adjustment"];

interface Product { id: string; name: string; stock_quantity: number; }
interface StockMovement {
  id: string; product_id: string; movement_type: string; quantity: number;
  batch_number: string | null; reference_type: string | null; date: string; notes: string | null;
}

export default function StockMovements() {
  const navigate = useNavigate();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);

  const [productId, setProductId] = useState("");
  const [moveType, setMoveType] = useState("adjustment");
  const [quantity, setQuantity] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const [mv, prod] = await Promise.all([
      supabase.from("stock_movements").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, stock_quantity"),
    ]);
    if (mv.data) setMovements(mv.data);
    if (prod.data) {
      setProducts(prod.data);
      const names: Record<string, string> = {};
      prod.data.forEach(p => { names[p.id] = p.name; });
      setProductNames(names);
    }
  };

  const handleSave = async () => {
    if (!productId || !quantity || Number(quantity) <= 0) { toast.error("Product and quantity required"); return; }
    await supabase.from("stock_movements").insert({
      product_id: productId, movement_type: moveType, quantity: Number(quantity),
      batch_number: batchNumber || null, date, notes: notes || null,
    });
    toast.success("Stock movement recorded");
    setOpen(false); setProductId(""); setMoveType("adjustment"); setQuantity(""); setBatchNumber(""); setNotes("");
    load();
  };

  const filtered = movements.filter(m => {
    const matchSearch = (productNames[m.product_id] || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.batch_number || "").toLowerCase().includes(search.toLowerCase());
    if (typeFilter !== "all") return matchSearch && m.movement_type === typeFilter;
    return matchSearch;
  });

  const typeBadge = (t: string) => {
    if (t.includes("in")) return <Badge variant="default" className="bg-primary/10 text-primary border-0">{t.replace("_", " ")}</Badge>;
    if (t.includes("out")) return <Badge variant="destructive">{t.replace("_", " ")}</Badge>;
    return <Badge variant="secondary">{t}</Badge>;
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Stock Movements</h1>
              <p className="text-sm text-muted-foreground">Track inventory adjustments with batch numbers</p>
            </div>
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
                  <div className="col-span-2"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
                </div>
                <Button onClick={handleSave} className="w-full mt-4">Save</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by product or batch..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
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
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <ArrowDownUp className="h-8 w-8 mx-auto mb-2 opacity-40" />No stock movements.
                      </TableCell></TableRow>
                    ) : filtered.map(m => (
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
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
