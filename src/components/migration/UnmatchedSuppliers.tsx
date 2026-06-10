import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

interface UnmatchedRow {
  id: string;                   // migration_errors.id
  supplier_name: string;
  sku: string;
  row_number: number | null;
  import_batch_id: string | null;
}

interface SupplierOption { id: string; name: string }

/**
 * Surfaces product rows whose `supplier_name` could not be matched during the
 * Products import step. Admin picks an existing supplier or creates a new one
 * and the products are bulk-relinked in place.
 */
export function UnmatchedSuppliers({ batchIds }: { batchIds: string[] }) {
  const [groups, setGroups] = useState<Record<string, UnmatchedRow[]>>({});
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({}); // supplier_name → action ("__new__" or supplierId)
  const [newName, setNewName] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [batchIds.join("|")]);

  async function load() {
    setLoading(true);
    if (batchIds.length === 0) { setGroups({}); setLoading(false); return; }
    const [{ data: errs }, { data: sups }] = await Promise.all([
      supabase.from("migration_errors")
        .select("id, raw, row_number, import_batch_id")
        .in("import_batch_id", batchIds)
        .eq("field", "supplier_name")
        .eq("severity", "warning"),
      supabase.from("suppliers").select("id, name").order("name"),
    ]);
    const g: Record<string, UnmatchedRow[]> = {};
    (errs ?? []).forEach((e: any) => {
      const supplier_name = String(e.raw?.supplier_name ?? "").trim();
      const sku = String(e.raw?.sku ?? "");
      if (!supplier_name) return;
      const key = supplier_name.toLowerCase();
      if (!g[key]) g[key] = [];
      g[key].push({ id: e.id, supplier_name, sku, row_number: e.row_number, import_batch_id: e.import_batch_id });
    });
    setGroups(g);
    setSuppliers((sups ?? []) as any);
    setLoading(false);
  }

  async function applyAll() {
    setApplying(true);
    let ok = 0, fail = 0;
    for (const [key, rows] of Object.entries(groups)) {
      const action = choice[key];
      if (!action) continue;
      const skus = [...new Set(rows.map(r => r.sku).filter(Boolean))];
      if (skus.length === 0) continue;

      let supplierId: string | null = null;
      if (action === "__new__") {
        const name = (newName[key] || rows[0].supplier_name).trim();
        if (!name) { fail++; continue; }
        const { data, error } = await supabase
          .from("suppliers")
          .insert({ name, is_active: true, notes: "Created from unmatched-supplier mapping" } as any)
          .select("id")
          .single();
        if (error || !data) { fail++; continue; }
        supplierId = (data as any).id;
      } else {
        supplierId = action;
      }

      const { error: upErr } = await supabase
        .from("products")
        .update({ supplier_id: supplierId } as any)
        .in("sku", skus);
      if (upErr) { fail++; continue; }

      // Clear resolved warnings
      await supabase.from("migration_errors").delete().in("id", rows.map(r => r.id));
      ok += rows.length;
    }
    setApplying(false);
    if (fail === 0) toast.success(`Linked ${ok} product rows`);
    else toast.warning(`Linked ${ok} rows · ${fail} groups failed`);
    void load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading unmatched suppliers…</p>;
  const keys = Object.keys(groups);
  if (keys.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        ✓ Every imported product is linked to a supplier.
      </p>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium">Unmatched suppliers ({keys.length})</span>
        <span className="text-xs text-muted-foreground">
          Pick an existing supplier or create a new one. Selected mappings will be applied to every affected product.
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="py-2 pr-3">Legacy supplier name</th>
              <th className="py-2 px-3 text-right">Products</th>
              <th className="py-2 px-3">Action</th>
              <th className="py-2 px-3">New supplier name</th>
            </tr>
          </thead>
          <tbody>
            {keys.map(k => {
              const rows = groups[k];
              return (
                <tr key={k} className="border-b border-border/40">
                  <td className="py-2 pr-3 font-medium">{rows[0].supplier_name}</td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    <Badge variant="outline">{rows.length}</Badge>
                  </td>
                  <td className="py-2 px-3 min-w-[220px]">
                    <Select value={choice[k] ?? ""} onValueChange={v => setChoice(p => ({ ...p, [k]: v }))}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Map to…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new__">＋ Create new supplier</SelectItem>
                        {suppliers.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 px-3 min-w-[220px]">
                    {choice[k] === "__new__" ? (
                      <Input
                        className="h-8 text-xs"
                        value={newName[k] ?? rows[0].supplier_name}
                        onChange={e => setNewName(p => ({ ...p, [k]: e.target.value }))}
                      />
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={applyAll} disabled={applying || Object.keys(choice).length === 0}>
          {applying ? "Applying…" : "Apply mappings"}
        </Button>
      </div>
    </Card>
  );
}
