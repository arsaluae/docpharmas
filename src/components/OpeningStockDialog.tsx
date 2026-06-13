import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Plus, Trash2, Loader2, PackagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

interface ProductLite { id: string; name: string; sku: string | null; }

interface BatchRow {
  batch_number: string;
  mfg_date: string;
  expiry_date: string;
  quantity: string;
  purchase_cost: string;
  mrp: string;
  sale_price: string;
  location: string;
  supplier_id: string;
  notes: string;
}

const emptyRow = (): BatchRow => ({
  batch_number: "", mfg_date: "", expiry_date: "", quantity: "",
  purchase_cost: "0", mrp: "0", sale_price: "0",
  location: "Main", supplier_id: "", notes: "",
});

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

export function OpeningStockDialog({ open, onOpenChange, onSaved }: Props) {
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [productId, setProductId] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setProductId(""); setRows([emptyRow()]);
    supabase.from("products").select("id, name, sku").eq("is_active", true).order("name")
      .then(({ data }) => setProducts((data as any) || []));
    supabase.from("suppliers").select("id, name").order("name")
      .then(({ data }) => setSuppliers((data as any) || []));
  }, [open]);

  const product = useMemo(() => products.find(p => p.id === productId), [products, productId]);

  const productOptions = useMemo(
    () => products.map(p => ({ value: p.id, label: p.sku ? `${p.sku} — ${p.name}` : p.name })),
    [products]
  );

  const updateRow = (i: number, patch: Partial<BatchRow>) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const addRow = () => setRows(rs => [...rs, emptyRow()]);
  const removeRow = (i: number) => setRows(rs => rs.length === 1 ? rs : rs.filter((_, idx) => idx !== i));

  const validate = (): string | null => {
    if (!productId) return "Select a product";
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.batch_number.trim()) return `Row ${i + 1}: batch number required`;
      if (!r.expiry_date) return `Row ${i + 1}: expiry required (pharma)`;
      if (!Number(r.quantity) || Number(r.quantity) <= 0) return `Row ${i + 1}: quantity must be > 0`;
      if (!r.location.trim()) return `Row ${i + 1}: location required`;
    }
    // Duplicate in same submission
    const seen = new Set<string>();
    for (const r of rows) {
      const k = `${r.batch_number}|${r.expiry_date}|${r.location}`.toLowerCase();
      if (seen.has(k)) return `Duplicate batch+expiry+location in form: ${r.batch_number}`;
      seen.add(k);
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const inserts = rows.map(r => ({
        product_id: productId,
        movement_type: "opening",
        quantity: Number(r.quantity),
        batch_number: r.batch_number.trim(),
        date: today,
        reference_type: "opening_stock",
        notes: [
          `Opening stock — Location: ${r.location}`,
          r.mfg_date ? `Mfg: ${r.mfg_date}` : null,
          r.expiry_date ? `Expiry: ${r.expiry_date}` : null,
          Number(r.purchase_cost) > 0 ? `Cost: PKR ${r.purchase_cost}` : null,
          r.notes || null,
        ].filter(Boolean).join(" • "),
      }));
      const { error } = await supabase.from("stock_movements").insert(inserts as any);
      if (error) throw error;
      // Audit
      for (const r of rows) {
        logAudit({
          action: "stock_adjusted",
          entity_type: "stock_movement",
          entity_id: productId,
          entity_number: `OPENING/${r.batch_number}`,
          changes: { batch: r.batch_number, qty: r.quantity, expiry: r.expiry_date, location: r.location },
        });
      }
      toast.success(`Opening stock recorded — ${rows.length} batch(es)`);
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const totalQty = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <PackagePlus className="h-4 w-4 text-primary" /> Add Opening Stock
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-3 gap-3 items-end">
            <div className="col-span-2">
              <Label>Product *</Label>
              <SearchableSelect
                options={productOptions}
                value={productId}
                onChange={setProductId}
                placeholder="Select product..."
                searchPlaceholder="Search by SKU or name..."
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">SKU</Label>
              <div className="h-9 px-3 flex items-center rounded-md border border-border bg-secondary/30 font-mono text-xs">
                {product?.sku || "—"}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-secondary/40 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
              <div className="col-span-2">Batch No *</div>
              <div className="col-span-1">Mfg</div>
              <div className="col-span-1">Expiry *</div>
              <div className="col-span-1">Qty *</div>
              <div className="col-span-1">Cost</div>
              <div className="col-span-1">MRP</div>
              <div className="col-span-1">Sale</div>
              <div className="col-span-1">Location</div>
              <div className="col-span-2">Supplier</div>
              <div className="col-span-1 text-right">—</div>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-b last:border-b-0 items-center">
                <Input className="col-span-2 h-8" value={r.batch_number} onChange={e => updateRow(i, { batch_number: e.target.value })} placeholder="N5625" />
                <Input className="col-span-1 h-8" type="date" value={r.mfg_date} onChange={e => updateRow(i, { mfg_date: e.target.value })} />
                <Input className="col-span-1 h-8" type="date" value={r.expiry_date} onChange={e => updateRow(i, { expiry_date: e.target.value })} />
                <Input className="col-span-1 h-8 tabular-nums" type="number" value={r.quantity} onChange={e => updateRow(i, { quantity: e.target.value })} />
                <Input className="col-span-1 h-8 tabular-nums" type="number" value={r.purchase_cost} onChange={e => updateRow(i, { purchase_cost: e.target.value })} />
                <Input className="col-span-1 h-8 tabular-nums" type="number" value={r.mrp} onChange={e => updateRow(i, { mrp: e.target.value })} />
                <Input className="col-span-1 h-8 tabular-nums" type="number" value={r.sale_price} onChange={e => updateRow(i, { sale_price: e.target.value })} />
                <Input className="col-span-1 h-8" value={r.location} onChange={e => updateRow(i, { location: e.target.value })} />
                <select
                  className="col-span-2 h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={r.supplier_id}
                  onChange={e => updateRow(i, { supplier_id: e.target.value })}
                >
                  <option value="">— none —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="col-span-1 flex justify-end">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={rows.length === 1} onClick={() => removeRow(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> Add another batch
            </Button>
            <div className="text-sm text-muted-foreground">
              Total quantity: <span className="font-mono font-semibold text-foreground">{totalQty.toLocaleString()}</span>
            </div>
          </div>

          <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
            Opening stock only creates batch movements. No supplier ledger, no payable, no purchase invoice.
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Opening Stock
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
