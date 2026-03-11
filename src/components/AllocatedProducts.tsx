import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Package, Check } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";

interface AllocatedProduct {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string | null;
  category: string;
  rate: number;
}

interface AllocatedProductsProps {
  partyId: string;
  partyType: "customer" | "supplier";
}

export function AllocatedProducts({ partyId, partyType }: AllocatedProductsProps) {
  const [allocated, setAllocated] = useState<AllocatedProduct[]>([]);
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; product_code: string | null; category: string }[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [newRate, setNewRate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");

  useEffect(() => {
    loadAllocated();
    loadAllProducts();
  }, [partyId]);

  const loadAllocated = async () => {
    let rows: any[] = [];
    if (partyType === "customer") {
      const { data } = await supabase.from("customer_products").select("id, product_id, rate").eq("customer_id", partyId).order("created_at");
      rows = data || [];
    } else {
      const { data } = await supabase.from("supplier_products").select("id, product_id, rate").eq("supplier_id", partyId).order("created_at");
      rows = data || [];
    }
    if (rows.length === 0) { setAllocated([]); return; }
    const productIds = rows.map((r: any) => r.product_id);
    const { data: prods } = await supabase.from("products").select("id, name, product_code, category").in("id", productIds);
    const prodMap = new Map((prods || []).map(p => [p.id, p]));
    
    setAllocated(
      rows.map((d: any) => {
        const p = prodMap.get(d.product_id);
        return {
          id: d.id,
          product_id: d.product_id,
          product_name: p?.name || "Unknown",
          product_code: p?.product_code || null,
          category: p?.category || "",
          rate: d.rate || 0,
        };
      })
    );
  };

  const loadAllProducts = async () => {
    const { data } = await supabase.from("products").select("id, name, product_code, category").order("name");
    setAllProducts(data || []);
  };

  const availableProducts = allProducts.filter(
    (p) => !allocated.some((a) => a.product_id === p.id)
  );

  const handleAdd = async () => {
    if (!selectedProductId) return;
    const rateVal = parseFloat(newRate) || 0;
    let error: any = null;
    if (partyType === "customer") {
      const res = await supabase.from("customer_products").insert({ product_id: selectedProductId, customer_id: partyId, rate: rateVal });
      error = res.error;
    } else {
      const res = await supabase.from("supplier_products").insert({ product_id: selectedProductId, supplier_id: partyId, rate: rateVal });
      error = res.error;
    }
    if (error) {
      if (error.code === "23505") toast.error("Product already allocated");
      else toast.error("Failed to add: " + error.message);
      return;
    }
    toast.success("Product allocated");
    setSelectedProductId("");
    setNewRate("");
    setShowAdd(false);
    loadAllocated();
  };

  const handleRemove = async (id: string) => {
    if (partyType === "customer") {
      await supabase.from("customer_products").delete().eq("id", id);
    } else {
      await supabase.from("supplier_products").delete().eq("id", id);
    }
    toast.success("Product removed");
    loadAllocated();
  };

  const handleSaveRate = async (id: string) => {
    const rateVal = parseFloat(editRate) || 0;
    const table = partyType === "customer" ? "customer_products" : "supplier_products";
    if (partyType === "customer") {
      await supabase.from("customer_products").update({ rate: rateVal }).eq("id", id);
    } else {
      await supabase.from("supplier_products").update({ rate: rateVal }).eq("id", id);
    }
    toast.success("Rate updated");
    setEditingId(null);
    loadAllocated();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4" /> Allocated Products
        </h4>
        {!showAdd && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30 mb-3">
          <SearchableSelect
            options={availableProducts.map((p) => ({
              value: p.id,
              label: `${p.product_code ? p.product_code + " — " : ""}${p.name}`,
            }))}
            value={selectedProductId}
            onChange={setSelectedProductId}
            placeholder="Search & select product..."
            searchPlaceholder="Type product name or code..."
            emptyMessage="No unallocated products found."
          />
          <Input
            type="number"
            placeholder="Rate (price)"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            min={0}
            step="0.01"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!selectedProductId} className="flex-1">
              Allocate Product
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setSelectedProductId(""); setNewRate(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {allocated.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocated.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs font-mono text-muted-foreground">{a.product_code || "—"}</TableCell>
                <TableCell className="text-sm font-medium">{a.product_name}</TableCell>
                <TableCell>
                  {editingId === a.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        className="h-7 w-24 text-xs"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        min={0}
                        step="0.01"
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleSaveRate(a.id)}
                      />
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSaveRate(a.id)}>
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span
                      className="text-sm cursor-pointer hover:text-primary"
                      onClick={() => { setEditingId(a.id); setEditRate(String(a.rate)); }}
                    >
                      {a.rate > 0 ? a.rate.toLocaleString() : "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemove(a.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          No products allocated yet. All products will be available.
        </p>
      )}
    </div>
  );
}
