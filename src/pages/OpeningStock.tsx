import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Plus, Copy, Trash2, Save, ArrowLeft, Loader2, PackagePlus, AlertTriangle, Calendar as CalIcon, MapPin, Hash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

interface ProductLite { id: string; name: string; sku: string | null; purchase_cost?: number | null; selling_price?: number | null; mrp?: number | null; }
interface SupplierLite { id: string; name: string; }

interface BatchRow {
  key: string;
  product_id: string;
  supplier_id: string;
  batch_number: string;
  mfg_date: string;
  expiry_date: string;
  quantity: string;
  purchase_cost: string;
  mrp: string;
  sale_price: string;
  location: string;
}

const newRow = (): BatchRow => ({
  key: Math.random().toString(36).slice(2),
  product_id: "", supplier_id: "",
  batch_number: "", mfg_date: "", expiry_date: "",
  quantity: "", purchase_cost: "0", mrp: "0", sale_price: "0",
  location: "Main",
});

export default function OpeningStock() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const editDocId = params.get("doc");

  // header
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("Main");
  const [refNo, setRefNo] = useState("");
  const [notes, setNotes] = useState("");

  // master data
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);

  // rows
  const [rows, setRows] = useState<BatchRow[]>([newRow()]);
  const [saving, setSaving] = useState(false);

  // duplicate prompt
  const [dupPrompt, setDupPrompt] = useState<null | { rows: BatchRow[]; resolve: (action: "merge" | "keep" | "cancel") => void }>(null);

  // first input focus
  const firstFocus = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([
        supabase.from("products").select("id, name, sku, purchase_cost, selling_price, mrp").eq("is_active", true).order("name").limit(2000),
        supabase.from("suppliers").select("id, name").order("name").limit(1000),
      ]);
      setProducts((p.data as any) || []);
      setSuppliers((s.data as any) || []);
    })();
  }, []);

  useEffect(() => {
    if (!editDocId) return;
    (async () => {
      const [{ data: doc }, { data: lines }] = await Promise.all([
        supabase.from("opening_stock_documents" as any).select("*").eq("id", editDocId).maybeSingle(),
        supabase.from("opening_stock_batches" as any).select("*").eq("document_id", editDocId).order("created_at"),
      ]);
      if (doc) {
        setDocDate((doc as any).doc_date || docDate);
        setLocation((doc as any).location || "Main");
        setRefNo((doc as any).ref_no || "");
        setNotes((doc as any).notes || "");
      }
      if (lines && (lines as any[]).length) {
        setRows((lines as any[]).map((l) => ({
          key: l.id,
          product_id: l.product_id,
          supplier_id: l.supplier_id || "",
          batch_number: l.batch_number || "",
          mfg_date: l.mfg_date || "",
          expiry_date: l.expiry_date || "",
          quantity: String(l.quantity ?? ""),
          purchase_cost: String(l.purchase_cost ?? "0"),
          mrp: String(l.mrp ?? "0"),
          sale_price: String(l.sale_price ?? "0"),
          location: l.location || "Main",
        })));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editDocId]);

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.sku ? `${p.sku} — ${p.name}` : p.name })),
    [products]
  );
  const supplierOptions = useMemo(
    () => [{ value: "", label: "— none —" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))],
    [suppliers]
  );
  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  const update = (i: number, patch: Partial<BatchRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const onPickProduct = (i: number, product_id: string) => {
    const p = productMap[product_id];
    update(i, {
      product_id,
      purchase_cost: rows[i].purchase_cost === "0" ? String(p?.purchase_cost ?? 0) : rows[i].purchase_cost,
      mrp: rows[i].mrp === "0" ? String(p?.mrp ?? 0) : rows[i].mrp,
      sale_price: rows[i].sale_price === "0" ? String(p?.selling_price ?? 0) : rows[i].sale_price,
    });
  };

  const addRow = () => setRows((rs) => [...rs, { ...newRow(), location }]);
  const addFive = () => setRows((rs) => [...rs, ...Array.from({ length: 5 }, () => ({ ...newRow(), location }))]);
  const duplicate = (i: number) => setRows((rs) => {
    const copy = { ...rs[i], key: Math.random().toString(36).slice(2), batch_number: "" };
    const next = [...rs];
    next.splice(i + 1, 0, copy);
    return next;
  });
  const removeRow = (i: number) => setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, idx) => idx !== i)));

  // Paste from Excel — handles tab/newline tabular paste into the batch grid.
  const handlePaste = (rowIdx: number, fieldOrder: (keyof BatchRow)[], startField: keyof BatchRow, e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return; // fall through to default single-cell paste
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length > 0);
    const startCol = fieldOrder.indexOf(startField);
    setRows((prev) => {
      const next = [...prev];
      lines.forEach((line, lOff) => {
        const cells = line.split("\t");
        const target = rowIdx + lOff;
        while (next.length <= target) next.push(newRow());
        const patch: Partial<BatchRow> = {};
        cells.forEach((cell, cOff) => {
          const f = fieldOrder[startCol + cOff];
          if (!f) return;
          (patch as any)[f] = cell.trim();
        });
        next[target] = { ...next[target], ...patch };
      });
      return next;
    });
  };

  const totals = useMemo(() => {
    let qty = 0, value = 0, batches = 0;
    const products = new Set<string>();
    for (const r of rows) {
      const q = Number(r.quantity) || 0;
      const c = Number(r.purchase_cost) || 0;
      if (q > 0) { qty += q; value += q * c; batches += 1; }
      if (r.product_id) products.add(r.product_id);
    }
    return { qty, value, batches, products: products.size };
  }, [rows]);

  const validate = (): string | null => {
    if (!docDate) return "Document date is required";
    if (!location.trim()) return "Location is required";
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.product_id) return `Row ${i + 1}: pick a product`;
      if (!r.batch_number.trim()) return `Row ${i + 1}: batch number required`;
      if (!r.expiry_date) return `Row ${i + 1}: expiry required`;
      if (!Number(r.quantity) || Number(r.quantity) <= 0) return `Row ${i + 1}: quantity must be > 0`;
      if (Number(r.purchase_cost) < 0) return `Row ${i + 1}: cost cannot be negative`;
    }
    return null;
  };

  const findDuplicateGroups = (rs: BatchRow[]) => {
    const map = new Map<string, BatchRow[]>();
    for (const r of rs) {
      const k = `${r.product_id}|${r.batch_number.trim().toLowerCase()}|${r.expiry_date}|${r.location.trim().toLowerCase()}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.values()].filter((g) => g.length > 1);
  };

  const askDuplicates = (groups: BatchRow[][]) =>
    new Promise<"merge" | "keep" | "cancel">((resolve) => {
      setDupPrompt({ rows: groups.flat(), resolve: (a) => { setDupPrompt(null); resolve(a); } });
    });

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    let workingRows = rows;
    const dupGroups = findDuplicateGroups(workingRows);
    if (dupGroups.length > 0) {
      const action = await askDuplicates(dupGroups);
      if (action === "cancel") return;
      if (action === "merge") {
        const merged: BatchRow[] = [];
        const seen = new Map<string, number>();
        for (const r of workingRows) {
          const k = `${r.product_id}|${r.batch_number.trim().toLowerCase()}|${r.expiry_date}|${r.location.trim().toLowerCase()}`;
          if (seen.has(k)) {
            const idx = seen.get(k)!;
            merged[idx] = {
              ...merged[idx],
              quantity: String((Number(merged[idx].quantity) || 0) + (Number(r.quantity) || 0)),
            };
          } else {
            seen.set(k, merged.length);
            merged.push(r);
          }
        }
        workingRows = merged;
        setRows(merged);
      }
    }

    setSaving(true);
    try {
      // 1. Document header (upsert)
      let docId = editDocId;
      const headerPayload = {
        doc_date: docDate,
        location: location.trim(),
        ref_no: refNo.trim() || null,
        notes: notes.trim() || null,
        status: "posted",
        totals_qty: totals.qty,
        totals_value: totals.value,
      };
      if (docId) {
        const { error } = await supabase.from("opening_stock_documents" as any).update(headerPayload).eq("id", docId);
        if (error) throw error;
        // wipe existing batches + their movements before re-inserting
        const { data: existing } = await supabase.from("opening_stock_batches" as any).select("stock_movement_id").eq("document_id", docId);
        const movementIds = ((existing as any[]) || []).map((b) => b.stock_movement_id).filter(Boolean);
        if (movementIds.length) await supabase.from("stock_movements").delete().in("id", movementIds);
        await supabase.from("opening_stock_batches" as any).delete().eq("document_id", docId);
      } else {
        const { data: created, error } = await supabase
          .from("opening_stock_documents" as any)
          .insert(headerPayload)
          .select("id")
          .single();
        if (error) throw error;
        docId = (created as any).id;
      }

      // 2. For each row → create stock_movement + batch line
      for (const r of workingRows) {
        const { data: mv, error: mvErr } = await supabase
          .from("stock_movements")
          .insert({
            product_id: r.product_id,
            movement_type: "opening",
            quantity: Number(r.quantity),
            batch_number: r.batch_number.trim(),
            date: docDate,
            reference_type: "opening_stock",
            reference_id: docId,
            notes: [
              `Opening stock — Location: ${r.location || location}`,
              r.mfg_date ? `Mfg: ${r.mfg_date}` : null,
              r.expiry_date ? `Expiry: ${r.expiry_date}` : null,
              Number(r.purchase_cost) > 0 ? `Cost: PKR ${r.purchase_cost}` : null,
            ].filter(Boolean).join(" • "),
          } as any)
          .select("id")
          .single();
        if (mvErr) throw mvErr;

        const { error: bErr } = await supabase.from("opening_stock_batches" as any).insert({
          document_id: docId,
          product_id: r.product_id,
          supplier_id: r.supplier_id || null,
          batch_number: r.batch_number.trim(),
          mfg_date: r.mfg_date || null,
          expiry_date: r.expiry_date,
          quantity: Number(r.quantity),
          purchase_cost: Number(r.purchase_cost) || 0,
          mrp: Number(r.mrp) || 0,
          sale_price: Number(r.sale_price) || 0,
          location: r.location || location,
          stock_movement_id: (mv as any).id,
        });
        if (bErr) throw bErr;
      }

      logAudit({
        action: editDocId ? "updated" : "created",
        entity_type: "stock_movement",
        entity_id: docId,
        entity_number: refNo || `OPENING/${docDate}`,
        changes: { rows: workingRows.length, total_qty: totals.qty, total_value: totals.value },
      });

      toast.success(`Opening stock ${editDocId ? "updated" : "posted"} — ${workingRows.length} batch(es), ${totals.qty.toLocaleString()} units`);
      nav("/products");
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldOrder: (keyof BatchRow)[] = [
    "product_id", "supplier_id", "batch_number", "mfg_date", "expiry_date",
    "quantity", "purchase_cost", "mrp", "sale_price", "location",
  ];

  return (
    <AppLayout
      title={editDocId ? "Edit Opening Stock" : "Add Opening Stock"}
      subtitle="Record one-time starting inventory. Does not hit supplier ledger or create a purchase invoice."
      headerActions={
        <Button variant="outline" size="sm" onClick={() => nav("/products")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Products
        </Button>
      }
    >
      <div className="space-y-5 pb-32">
        {/* HEADER */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <PackagePlus className="h-4 w-4 text-primary" />
            <h2 className="font-heading text-base">Document details</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs"><CalIcon className="h-3 w-3 inline mr-1" />Opening date *</Label>
              <Input ref={firstFocus as any} type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs"><MapPin className="h-3 w-3 inline mr-1" />Location / Warehouse *</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main" />
            </div>
            <div>
              <Label className="text-xs"><Hash className="h-3 w-3 inline mr-1" />Reference No</Label>
              <Input value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="optional" />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <Label className="text-xs">Status</Label>
              <div className="h-9 flex items-center">
                <Badge variant={editDocId ? "default" : "secondary"} className="font-mono uppercase tracking-wider text-[10px]">
                  {editDocId ? "editing" : "new"}
                </Badge>
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything worth remembering about this opening balance…" />
            </div>
          </div>
        </Card>

        {/* BATCH GRID */}
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-heading text-base">Product batches</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={addFive}>+5 rows</Button>
              <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-3.5 w-3.5 mr-1" /> Add row</Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 text-left w-[18%] min-w-[200px]">Product *</th>
                  <th className="px-2 py-2 text-left w-[12%] min-w-[140px]">Supplier</th>
                  <th className="px-2 py-2 text-left w-[10%] min-w-[110px]">Batch No *</th>
                  <th className="px-2 py-2 text-left min-w-[120px]">Mfg</th>
                  <th className="px-2 py-2 text-left min-w-[120px]">Expiry *</th>
                  <th className="px-2 py-2 text-right min-w-[80px]">Qty *</th>
                  <th className="px-2 py-2 text-right min-w-[90px]">Cost</th>
                  <th className="px-2 py-2 text-right min-w-[90px]">MRP</th>
                  <th className="px-2 py-2 text-right min-w-[90px]">Sale</th>
                  <th className="px-2 py-2 text-left min-w-[100px]">Location</th>
                  <th className="px-2 py-2 text-right w-[80px]">—</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const p = productMap[r.product_id];
                  const lineValue = (Number(r.quantity) || 0) * (Number(r.purchase_cost) || 0);
                  return (
                    <tr key={r.key} className="border-b border-border/60 hover:bg-foreground/[0.015]">
                      <td className="px-3 py-2 align-top">
                        <SearchableSelect
                          options={productOptions}
                          value={r.product_id}
                          onChange={(v) => onPickProduct(i, v)}
                          placeholder="Search product…"
                          searchPlaceholder="SKU or name…"
                        />
                        {p?.sku && <div className="text-[10px] text-muted-foreground font-mono mt-1">{p.sku}</div>}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <SearchableSelect
                          options={supplierOptions}
                          value={r.supplier_id}
                          onChange={(v) => update(i, { supplier_id: v })}
                          placeholder="—"
                          searchPlaceholder="Search…"
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input
                          className="h-9"
                          value={r.batch_number}
                          onChange={(e) => update(i, { batch_number: e.target.value })}
                          onPaste={(e) => handlePaste(i, fieldOrder, "batch_number", e)}
                          placeholder="N5625"
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input className="h-9" type="date" value={r.mfg_date} onChange={(e) => update(i, { mfg_date: e.target.value })} />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input className="h-9" type="date" value={r.expiry_date} onChange={(e) => update(i, { expiry_date: e.target.value })} />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input className="h-9 text-right" type="number" value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value })} />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input className="h-9 text-right" type="number" value={r.purchase_cost} onChange={(e) => update(i, { purchase_cost: e.target.value })} />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input className="h-9 text-right" type="number" value={r.mrp} onChange={(e) => update(i, { mrp: e.target.value })} />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input className="h-9 text-right" type="number" value={r.sale_price} onChange={(e) => update(i, { sale_price: e.target.value })} />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input className="h-9" value={r.location} onChange={(e) => update(i, { location: e.target.value })} />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicate(i)} title="Duplicate row">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={rows.length === 1} onClick={() => removeRow(i)} title="Remove row">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {lineValue > 0 && (
                          <div className="text-right text-[10px] text-muted-foreground mt-1">
                            PKR {lineValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-border bg-secondary/20 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
            <span>
              Paste a tab-separated range from Excel into any cell to fill multiple rows at once.
            </span>
            <span>
              Opening stock will create batch-level <code className="font-mono">stock_movements</code> only — no supplier ledger, no purchase invoice.
            </span>
          </div>
        </Card>
      </div>

      {/* STICKY FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container max-w-screen-2xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6 text-sm">
            <div><span className="text-muted-foreground text-xs uppercase tracking-wider mr-2">Products</span><span className="font-mono font-semibold">{totals.products}</span></div>
            <div><span className="text-muted-foreground text-xs uppercase tracking-wider mr-2">Batches</span><span className="font-mono font-semibold">{totals.batches}</span></div>
            <div><span className="text-muted-foreground text-xs uppercase tracking-wider mr-2">Total qty</span><span className="font-mono font-semibold">{totals.qty.toLocaleString()}</span></div>
            <div><span className="text-muted-foreground text-xs uppercase tracking-wider mr-2">Total value</span><span className="font-mono font-semibold">PKR {totals.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => nav("/products")} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editDocId ? "Update opening stock" : "Post opening stock"}
            </Button>
          </div>
        </div>
      </div>

      {/* DUPLICATE PROMPT */}
      <Dialog open={!!dupPrompt} onOpenChange={(o) => !o && dupPrompt?.resolve("cancel")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> Duplicate batches detected</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Some rows have the same product + batch + expiry + location. Choose how to handle them:
          </p>
          <ul className="text-xs space-y-1 max-h-40 overflow-auto border border-border rounded-md p-3 font-mono">
            {(dupPrompt?.rows || []).map((r, i) => (
              <li key={i}>{(productMap[r.product_id]?.sku || "—")} — {r.batch_number} — {r.expiry_date} — qty {r.quantity}</li>
            ))}
          </ul>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => dupPrompt?.resolve("cancel")}>Cancel</Button>
            <Button variant="outline" onClick={() => dupPrompt?.resolve("keep")}>Keep separate</Button>
            <Button onClick={() => dupPrompt?.resolve("merge")}>Merge quantities</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
