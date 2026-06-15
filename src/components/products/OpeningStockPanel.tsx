import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Layers, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

interface NewRow {
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

interface ExistingRow {
  id: string;
  batch_number: string;
  quantity: string;
  date: string;
  notes: string;
  _origBatch: string;
  _origQty: string;
  _origDate: string;
  _origNotes: string;
}

const emptyNewRow = (): NewRow => ({
  batch_number: "", mfg_date: "", expiry_date: "", quantity: "",
  purchase_cost: "0", mrp: "0", sale_price: "0",
  location: "Main", supplier_id: "", notes: "",
});

export interface OpeningStockPanelHandle {
  /** Persist all changes. Returns true on success. Called by parent after the product row is created/saved. */
  save: (productId: string) => Promise<boolean>;
  /** True when there are unsaved new rows that have at least batch+qty filled. */
  hasPending: () => boolean;
}

interface Props {
  /** product id when editing, null on create */
  productId: string | null;
  /** show a subtle title above the panel */
  showHeader?: boolean;
}

export const OpeningStockPanel = forwardRef<OpeningStockPanelHandle, Props>(
  ({ productId, showHeader = true }, ref) => {
    const [existing, setExisting] = useState<ExistingRow[]>([]);
    const [removed, setRemoved] = useState<string[]>([]);
    const [newRows, setNewRows] = useState<NewRow[]>([emptyNewRow()]);
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(false);

    // Load existing opening movements
    useEffect(() => {
      supabase.from("suppliers").select("id, name").order("name")
        .then(({ data }) => setSuppliers((data as any) || []));
    }, []);

    useEffect(() => {
      if (!productId) { setExisting([]); setRemoved([]); return; }
      setLoading(true);
      supabase
        .from("stock_movements")
        .select("id, batch_number, quantity, date, notes, movement_type")
        .eq("product_id", productId)
        .in("movement_type", ["opening", "opening_stock"])
        .order("date", { ascending: true })
        .then(({ data }) => {
          const rows: ExistingRow[] = (data || []).map((r: any) => ({
            id: r.id,
            batch_number: r.batch_number || "",
            quantity: String(r.quantity ?? ""),
            date: r.date || "",
            notes: r.notes || "",
            _origBatch: r.batch_number || "",
            _origQty: String(r.quantity ?? ""),
            _origDate: r.date || "",
            _origNotes: r.notes || "",
          }));
          setExisting(rows);
          setRemoved([]);
          setLoading(false);
        });
    }, [productId]);

    const updateExisting = (i: number, patch: Partial<ExistingRow>) =>
      setExisting(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));

    const updateNew = (i: number, patch: Partial<NewRow>) =>
      setNewRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));

    const addNew = () => setNewRows(rs => [...rs, emptyNewRow()]);
    const removeNew = (i: number) =>
      setNewRows(rs => rs.length === 1 ? [emptyNewRow()] : rs.filter((_, idx) => idx !== i));

    const markExistingRemoved = (i: number) => {
      const row = existing[i];
      if (row.id) setRemoved(prev => [...prev, row.id]);
      setExisting(rs => rs.filter((_, idx) => idx !== i));
    };

    const totalQty = useMemo(() => {
      const a = existing.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
      const b = newRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
      return a + b;
    }, [existing, newRows]);

    const validNewRows = () => newRows.filter(r => r.batch_number.trim() && Number(r.quantity) > 0);

    const validate = (): string | null => {
      for (let i = 0; i < existing.length; i++) {
        const r = existing[i];
        if (!r.batch_number.trim()) return `Existing batch row ${i + 1}: batch number required`;
        if (!Number(r.quantity) || Number(r.quantity) <= 0) return `Existing batch row ${i + 1}: quantity must be > 0`;
      }
      const toCheck = validNewRows();
      for (let i = 0; i < toCheck.length; i++) {
        const r = toCheck[i];
        if (!r.expiry_date) return `New batch row ${i + 1}: expiry required`;
        if (!r.location.trim()) return `New batch row ${i + 1}: location required`;
      }
      const seen = new Set<string>();
      for (const r of [...existing.map(e => ({ batch: e.batch_number, loc: "" })), ...toCheck.map(n => ({ batch: n.batch_number, loc: n.location }))]) {
        const k = `${r.batch}|${r.loc}`.toLowerCase();
        if (seen.has(k)) return `Duplicate batch in form: ${r.batch}`;
        seen.add(k);
      }
      return null;
    };

    useImperativeHandle(ref, () => ({
      hasPending: () => validNewRows().length > 0 || existing.some(r =>
        r.batch_number !== r._origBatch || r.quantity !== r._origQty || r.date !== r._origDate || r.notes !== r._origNotes
      ) || removed.length > 0,
      save: async (pid: string) => {
        const err = validate();
        if (err) { toast.error(err); return false; }
        try {
          // Deletes
          if (removed.length > 0) {
            const { error } = await supabase.from("stock_movements").delete().in("id", removed);
            if (error) throw error;
            for (const id of removed) {
              logAudit({ action: "stock_adjusted", entity_type: "stock_movement", entity_id: id, entity_number: `OPENING/DELETE`, changes: { deleted: true } });
            }
          }
          // Updates
          for (const r of existing) {
            const changed = r.batch_number !== r._origBatch || r.quantity !== r._origQty || r.date !== r._origDate || r.notes !== r._origNotes;
            if (!changed) continue;
            const { error } = await supabase.from("stock_movements").update({
              batch_number: r.batch_number.trim(),
              quantity: Number(r.quantity),
              date: r.date || new Date().toISOString().slice(0, 10),
              notes: r.notes || null,
            } as any).eq("id", r.id);
            if (error) throw error;
            logAudit({ action: "stock_adjusted", entity_type: "stock_movement", entity_id: r.id, entity_number: `OPENING/${r.batch_number}`, changes: { batch: r.batch_number, qty: r.quantity } });
          }
          // Inserts
          const toInsert = validNewRows();
          if (toInsert.length > 0) {
            const today = new Date().toISOString().slice(0, 10);
            const inserts = toInsert.map(r => ({
              product_id: pid,
              movement_type: "opening",
              quantity: Number(r.quantity),
              batch_number: r.batch_number.trim(),
              date: r.mfg_date || today,
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
            for (const r of toInsert) {
              logAudit({
                action: "stock_adjusted",
                entity_type: "stock_movement",
                entity_id: pid,
                entity_number: `OPENING/${r.batch_number}`,
                changes: { batch: r.batch_number, qty: r.quantity, expiry: r.expiry_date, location: r.location },
              });
            }
          }
          // Reset new rows after save
          setNewRows([emptyNewRow()]);
          setRemoved([]);
          return true;
        } catch (e: any) {
          toast.error("Opening stock save failed: " + e.message);
          return false;
        }
      },
    }), [existing, newRows, removed]);

    return (
      <div className="space-y-3">
        {showHeader && (
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4 text-primary" /> Opening Stock / Batches
            </Label>
            <span className="text-xs text-muted-foreground">
              Total: <span className="font-mono tabular-nums text-foreground">{totalQty.toLocaleString()}</span>
            </span>
          </div>
        )}

        {/* Existing batches */}
        {productId && (
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
              <History className="h-3 w-3" /> Existing opening batches {existing.length > 0 && `(${existing.length})`}
            </div>
            {loading ? (
              <div className="text-xs text-muted-foreground py-3">Loading…</div>
            ) : existing.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2 px-3 rounded border border-dashed border-border">
                No opening-stock batches yet.
              </div>
            ) : (
              <div className="rounded border border-border">
                <div className="grid grid-cols-12 gap-2 px-2.5 py-1.5 bg-secondary/40 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                  <div className="col-span-3">Batch</div>
                  <div className="col-span-2">Mfg / Date</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-4">Notes</div>
                  <div className="col-span-1 text-right">—</div>
                </div>
                {existing.map((r, i) => (
                  <div key={r.id} className="grid grid-cols-12 gap-2 px-2.5 py-1.5 border-b last:border-b-0 items-center">
                    <Input className="col-span-3 h-8" value={r.batch_number} onChange={e => updateExisting(i, { batch_number: e.target.value })} />
                    <Input className="col-span-2 h-8" type="date" value={r.date} onChange={e => updateExisting(i, { date: e.target.value })} />
                    <Input className="col-span-2 h-8 tabular-nums" type="number" value={r.quantity} onChange={e => updateExisting(i, { quantity: e.target.value })} />
                    <Input className="col-span-4 h-8" value={r.notes} onChange={e => updateExisting(i, { notes: e.target.value })} placeholder="Expiry / location info" />
                    <div className="col-span-1 flex justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => markExistingRemoved(i)} title="Delete batch">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* New batches */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
            {productId ? "Add more opening batches" : "Opening batches"}
          </div>
          <div className="rounded border border-border">
            <div className="grid grid-cols-12 gap-1.5 px-2 py-1.5 bg-secondary/40 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
              <div className="col-span-2">Batch *</div>
              <div className="col-span-1">Mfg</div>
              <div className="col-span-1">Expiry *</div>
              <div className="col-span-1">Qty *</div>
              <div className="col-span-1">Cost</div>
              <div className="col-span-1">MRP</div>
              <div className="col-span-1">Sale</div>
              <div className="col-span-1">Loc</div>
              <div className="col-span-2">Supplier</div>
              <div className="col-span-1 text-right">—</div>
            </div>
            {newRows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-1.5 px-2 py-1.5 border-b last:border-b-0 items-center">
                <Input className="col-span-2 h-8" value={r.batch_number} onChange={e => updateNew(i, { batch_number: e.target.value })} placeholder="N5625" />
                <Input className="col-span-1 h-8" type="date" value={r.mfg_date} onChange={e => updateNew(i, { mfg_date: e.target.value })} />
                <Input className="col-span-1 h-8" type="date" value={r.expiry_date} onChange={e => updateNew(i, { expiry_date: e.target.value })} />
                <Input className="col-span-1 h-8 tabular-nums" type="number" value={r.quantity} onChange={e => updateNew(i, { quantity: e.target.value })} />
                <Input className="col-span-1 h-8 tabular-nums" type="number" value={r.purchase_cost} onChange={e => updateNew(i, { purchase_cost: e.target.value })} />
                <Input className="col-span-1 h-8 tabular-nums" type="number" value={r.mrp} onChange={e => updateNew(i, { mrp: e.target.value })} />
                <Input className="col-span-1 h-8 tabular-nums" type="number" value={r.sale_price} onChange={e => updateNew(i, { sale_price: e.target.value })} />
                <Input className="col-span-1 h-8" value={r.location} onChange={e => updateNew(i, { location: e.target.value })} />
                <select
                  className="col-span-2 h-8 rounded border border-input bg-background px-2 text-xs"
                  value={r.supplier_id}
                  onChange={e => updateNew(i, { supplier_id: e.target.value })}
                >
                  <option value="">— none —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="col-span-1 flex justify-end">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeNew(i)} title="Remove row">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <Button variant="outline" size="sm" onClick={addNew}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add another batch
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Leave a row empty to skip. Rows without batch # or qty are ignored.
            </span>
          </div>
        </div>
      </div>
    );
  }
);
OpeningStockPanel.displayName = "OpeningStockPanel";
