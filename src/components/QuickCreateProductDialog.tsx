import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the newly created product (id + name + cost_price) once saved. */
  onCreated?: (product: { id: string; name: string; cost_price: number }) => void;
  defaultName?: string;
}

/**
 * Minimal product creation, used inline from the Purchase Order dialogs so the
 * user doesn't have to leave the flow to add a missing product.
 */
export function QuickCreateProductDialog({ open, onOpenChange, onCreated, defaultName }: Props) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [packSize, setPackSize] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [costPrice, setCostPrice] = useState("0");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName || "");
      setSku(""); setPackSize(""); setUnit("pcs");
      setCostPrice("0"); setSellingPrice("0");
    }
  }, [open, defaultName]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Product name is required"); return; }
    setSaving(true);
    try {
      const { data: code } = await supabase.rpc("generate_document_number", { p_document_type: "product" });
      const payload: any = {
        name: name.trim(),
        sku: sku.trim() || null,
        category: "tablet",
        pack_size: packSize.trim() || null,
        unit: unit.trim() || "pcs",
        cost_price: Number(costPrice) || 0,
        selling_price: Number(sellingPrice) || 0,
        gst_rate: 17,
        reorder_level: 0,
        stock_quantity: 0,
        product_code: code || null,
      };
      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select("id, name, cost_price")
        .single();
      if (error || !data) { toast.error("Failed: " + (error?.message || "unknown")); setSaving(false); return; }
      toast.success(`Product "${data.name}" created`);
      onCreated?.({ id: data.id, name: data.name, cost_price: Number(data.cost_price) });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Plus className="h-4 w-4" /> Quick Add Product
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Product Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Panadol 500mg" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">SKU</Label>
              <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Pack Size</Label>
              <Input value={packSize} onChange={e => setPackSize(e.target.value)} placeholder="e.g. 10x10" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Unit</Label>
              <Input value={unit} onChange={e => setUnit(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Cost (PKR)</Label>
              <Input type="number" value={costPrice} onChange={e => setCostPrice(e.target.value)} />
            </div>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <Label className="text-xs font-semibold text-primary">MRP (PKR) *</Label>
            <Input type="number" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} className="mt-1 tabular-nums" placeholder="0" />
            <p className="text-[10px] text-muted-foreground mt-1">Printed on every sales invoice & delivery note.</p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Tip: you can complete additional fields (DRAP, GST, reorder level) later from the Products page.
          </p>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Product
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
