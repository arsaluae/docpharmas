import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Merge, Undo2, Sparkles, AlertTriangle, EyeOff, Users, Truck } from "lucide-react";
import { toast } from "sonner";
import { useRoles } from "@/hooks/useRoles";

interface SupplierRow {
  group_key: string;
  supplier_id: string;
  name: string;
  supplier_code: string | null;
  phone: string | null;
  city: string | null;
  balance: number | null;
  is_merged: boolean;
  created_at: string;
  pi_count: number;
  po_count: number;
  payment_count: number;
  product_count: number;
}
interface CustomerRow {
  group_key: string;
  customer_id: string;
  name: string;
  customer_code: string | null;
  sms_mobile: string | null;
  phone: string | null;
  city: string | null;
  balance: number | null;
  is_merged: boolean;
  created_at: string;
  si_count: number;
  payment_count: number;
  dn_count: number;
}

function groupBy<T extends { group_key: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  rows.forEach(r => {
    const list = map.get(r.group_key) ?? [];
    list.push(r);
    map.set(r.group_key, list);
  });
  return Array.from(map.entries());
}

function pickMaster<T extends { is_merged: boolean; created_at: string }>(rows: T[], scores: number[]): number {
  // Highest score first; tiebreak older created_at; never pick an already-merged row
  let bestIdx = -1, bestScore = -1, bestDate = Infinity;
  rows.forEach((r, i) => {
    if (r.is_merged) return;
    const s = scores[i] ?? 0;
    const d = new Date(r.created_at).getTime();
    if (s > bestScore || (s === bestScore && d < bestDate)) {
      bestIdx = i; bestScore = s; bestDate = d;
    }
  });
  return bestIdx === -1 ? 0 : bestIdx;
}

export default function DataCleanup() {
  const { isOwner, loading: roleLoading } = useRoles();
  const [tab, setTab] = useState<"suppliers" | "customers">("suppliers");
  const [supplierRows, setSupplierRows] = useState<SupplierRow[]>([]);
  const [customerRows, setCustomerRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  // groupKey -> chosen master id
  const [masters, setMasters] = useState<Record<string, string>>({});
  // groupKey -> set of ids to merge into master
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [confirmGroup, setConfirmGroup] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [{ data: sup, error: e1 }, { data: cus, error: e2 }] = await Promise.all([
        (supabase.rpc as any)("detect_supplier_duplicates"),
        (supabase.rpc as any)("detect_customer_duplicates"),
      ]);
      if (e1) throw e1; if (e2) throw e2;
      setSupplierRows((sup ?? []) as SupplierRow[]);
      setCustomerRows((cus ?? []) as CustomerRow[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to detect duplicates");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (!roleLoading && isOwner) loadAll(); }, [roleLoading, isOwner]);

  const supplierGroups = useMemo(() => groupBy(supplierRows), [supplierRows]);
  const customerGroups = useMemo(() => groupBy(customerRows), [customerRows]);

  const filteredSupplierGroups = useMemo(() =>
    supplierGroups.filter(([k, rows]) => !search || k.includes(search.toLowerCase()) ||
      rows.some(r => (r.name || "").toLowerCase().includes(search.toLowerCase()))),
    [supplierGroups, search]);

  const filteredCustomerGroups = useMemo(() =>
    customerGroups.filter(([k, rows]) => !search || k.includes(search.toLowerCase()) ||
      rows.some(r => (r.name || "").toLowerCase().includes(search.toLowerCase()))),
    [customerGroups, search]);

  function ensureGroupDefaults(kind: "supplier" | "customer", key: string, rows: any[]) {
    if (masters[key]) return;
    const scores = kind === "supplier"
      ? rows.map((r: SupplierRow) => r.pi_count + r.po_count + r.payment_count + r.product_count)
      : rows.map((r: CustomerRow) => r.si_count + r.payment_count + r.dn_count);
    const idx = pickMaster(rows, scores);
    const idField = kind === "supplier" ? "supplier_id" : "customer_id";
    const masterId = rows[idx]?.[idField];
    const dupIds = new Set<string>(rows.filter(r => !r.is_merged && r[idField] !== masterId).map(r => r[idField]));
    setMasters(m => ({ ...m, [key]: masterId }));
    setSelected(s => ({ ...s, [key]: dupIds }));
  }

  useEffect(() => {
    supplierGroups.forEach(([k, rows]) => ensureGroupDefaults("supplier", k, rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierGroups]);
  useEffect(() => {
    customerGroups.forEach(([k, rows]) => ensureGroupDefaults("customer", k, rows));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerGroups]);

  async function runMerge(kind: "supplier" | "customer", key: string) {
    const master = masters[key];
    const dups = Array.from(selected[key] ?? []);
    if (!master || dups.length === 0) { toast.error("Pick a master and at least one duplicate"); return; }
    setBusy(true);
    try {
      const fn = kind === "supplier" ? "merge_suppliers" : "merge_customers";
      const { error } = await (supabase.rpc as any)(fn, {
        p_master: master, p_duplicates: dups, p_reason: "Data Cleanup merge",
      });
      if (error) throw error;
      toast.success(`Merged ${dups.length} ${kind}${dups.length > 1 ? "s" : ""} into master`);
      setConfirmGroup(null);
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Merge failed");
    } finally { setBusy(false); }
  }

  async function ignoreGroup(kind: "supplier" | "customer", key: string) {
    setBusy(true);
    try {
      const { data: tu } = await (supabase as any).from("tenant_users")
        .select("tenant_id").eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .eq("is_active", true).limit(1).single();
      const { error } = await (supabase as any).from("duplicate_ignores").insert({
        tenant_id: tu?.tenant_id, party_type: kind, group_key: key,
      });
      if (error) throw error;
      toast.success("Group ignored");
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not ignore group");
    } finally { setBusy(false); }
  }

  async function autoMergeObvious(kind: "supplier" | "customer") {
    const groups = kind === "supplier" ? supplierGroups : customerGroups;
    const obvious = groups.filter(([, rows]) => {
      const active = rows.filter(r => !r.is_merged);
      if (active.length < 2) return false;
      // Obvious: same normalized name (already grouped) AND either same code prefix or shared phone
      const codes = new Set(active.map(r => (kind === "supplier" ? (r as SupplierRow).supplier_code : (r as CustomerRow).customer_code) || "").map(c => c.trim().toLowerCase()).filter(Boolean));
      const phones = new Set(active.map(r => ((r as any).sms_mobile || (r as any).phone || "").replace(/\D+/g, "").slice(-10)).filter(Boolean));
      return codes.size <= 1 || phones.size <= 1;
    });
    if (!obvious.length) { toast.message("No obvious groups to auto-merge"); return; }
    if (!confirm(`Auto-merge ${obvious.length} obvious ${kind} group${obvious.length > 1 ? "s" : ""}? (reversible for 7 days)`)) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (const [key] of obvious) {
      try {
        const master = masters[key];
        const dups = Array.from(selected[key] ?? []);
        if (!master || !dups.length) continue;
        const fn = kind === "supplier" ? "merge_suppliers" : "merge_customers";
        const { error } = await (supabase.rpc as any)(fn, { p_master: master, p_duplicates: dups, p_reason: "Auto-merge obvious" });
        if (error) fail++; else ok++;
      } catch { fail++; }
    }
    toast.success(`Auto-merged ${ok}${fail ? ` · ${fail} failed` : ""}`);
    await loadAll();
    setBusy(false);
  }

  async function undoMerge(kind: "supplier" | "customer", oldId: string) {
    setBusy(true);
    try {
      const fn = kind === "supplier" ? "unmerge_supplier" : "unmerge_customer";
      const { error } = await (supabase.rpc as any)(fn, { p_old_id: oldId });
      if (error) throw error;
      toast.success("Merge reversed");
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not undo");
    } finally { setBusy(false); }
  }

  if (roleLoading) return <AppLayout title="Data Cleanup"><div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div></AppLayout>;
  if (!isOwner) return <AppLayout title="Data Cleanup">
    <div className="max-w-2xl mx-auto p-8">
      <Card className="p-6 text-center">
        <AlertTriangle className="h-6 w-6 mx-auto text-amber-500 mb-2" />
        <p className="text-sm">Data Cleanup is owner-only.</p>
      </Card>
    </div>
  </AppLayout>;

  return (
    <AppLayout title="Data Cleanup">
      <div className="max-w-7xl mx-auto p-6 space-y-5">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Data Cleanup</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Detect and merge duplicate suppliers and customers. Every merge is reversible for 7 days.
            </p>
          </div>
          <div className="flex gap-2">
            <Input className="w-56" placeholder="Search groups…" value={search} onChange={e => setSearch(e.target.value)} />
            <Button variant="outline" onClick={loadAll} disabled={loading || busy}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Refresh
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="suppliers"><Truck className="h-4 w-4 mr-2" /> Suppliers ({supplierGroups.length})</TabsTrigger>
            <TabsTrigger value="customers"><Users className="h-4 w-4 mr-2" /> Customers ({customerGroups.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="suppliers" className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => autoMergeObvious("supplier")} disabled={busy || !supplierGroups.length}>
                <Sparkles className="h-4 w-4 mr-2" /> Auto-merge obvious groups
              </Button>
            </div>
            {!filteredSupplierGroups.length && !loading && (
              <Card className="p-8 text-center text-sm text-muted-foreground">No duplicate supplier groups detected.</Card>
            )}
            {filteredSupplierGroups.map(([key, rows]) => (
              <Card key={key} className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{rows.length} suppliers</Badge>
                    <span className="text-sm font-medium">Normalized: <span className="font-mono">{key}</span></span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => ignoreGroup("supplier", key)} disabled={busy}>
                      <EyeOff className="h-3 w-3 mr-1" /> Ignore
                    </Button>
                    <Button size="sm" onClick={() => setConfirmGroup(`s:${key}`)} disabled={busy || !masters[key] || !(selected[key]?.size)}>
                      <Merge className="h-3 w-3 mr-1" /> Merge selected
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Master</TableHead>
                      <TableHead className="w-16">Merge</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">PI</TableHead>
                      <TableHead className="text-right">PO</TableHead>
                      <TableHead className="text-right">Pay</TableHead>
                      <TableHead className="text-right">Prod</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.supplier_id} className={r.is_merged ? "opacity-50" : ""}>
                        <TableCell>
                          <input type="radio" name={`m-${key}`} disabled={r.is_merged}
                            checked={masters[key] === r.supplier_id}
                            onChange={() => {
                              setMasters(m => ({ ...m, [key]: r.supplier_id }));
                              setSelected(s => ({ ...s, [key]: new Set(rows.filter(x => !x.is_merged && x.supplier_id !== r.supplier_id).map(x => x.supplier_id)) }));
                            }} />
                        </TableCell>
                        <TableCell>
                          <input type="checkbox" disabled={r.is_merged || masters[key] === r.supplier_id}
                            checked={selected[key]?.has(r.supplier_id) ?? false}
                            onChange={(e) => setSelected(s => {
                              const set = new Set(s[key] ?? []);
                              if (e.target.checked) set.add(r.supplier_id); else set.delete(r.supplier_id);
                              return { ...s, [key]: set };
                            })} />
                        </TableCell>
                        <TableCell className="text-sm font-medium">{r.name}</TableCell>
                        <TableCell className="text-xs font-mono">{r.supplier_code || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{r.phone || "—"}</TableCell>
                        <TableCell className="text-xs">{r.city || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{Number(r.balance ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs">{r.pi_count}</TableCell>
                        <TableCell className="text-right text-xs">{r.po_count}</TableCell>
                        <TableCell className="text-right text-xs">{r.payment_count}</TableCell>
                        <TableCell className="text-right text-xs">{r.product_count}</TableCell>
                        <TableCell>
                          {r.is_merged ? (
                            <Button size="sm" variant="ghost" onClick={() => undoMerge("supplier", r.supplier_id)} disabled={busy}>
                              <Undo2 className="h-3 w-3 mr-1" /> Undo
                            </Button>
                          ) : <Badge variant="outline" className="text-[10px]">Active</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="customers" className="space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => autoMergeObvious("customer")} disabled={busy || !customerGroups.length}>
                <Sparkles className="h-4 w-4 mr-2" /> Auto-merge obvious groups
              </Button>
            </div>
            {!filteredCustomerGroups.length && !loading && (
              <Card className="p-8 text-center text-sm text-muted-foreground">No duplicate customer groups detected.</Card>
            )}
            {filteredCustomerGroups.map(([key, rows]) => (
              <Card key={key} className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{rows.length} customers</Badge>
                    <span className="text-sm font-medium">Normalized: <span className="font-mono">{key}</span></span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => ignoreGroup("customer", key)} disabled={busy}>
                      <EyeOff className="h-3 w-3 mr-1" /> Ignore
                    </Button>
                    <Button size="sm" onClick={() => setConfirmGroup(`c:${key}`)} disabled={busy || !masters[key] || !(selected[key]?.size)}>
                      <Merge className="h-3 w-3 mr-1" /> Merge selected
                    </Button>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Master</TableHead>
                      <TableHead className="w-16">Merge</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">SI</TableHead>
                      <TableHead className="text-right">Pay</TableHead>
                      <TableHead className="text-right">DN</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.customer_id} className={r.is_merged ? "opacity-50" : ""}>
                        <TableCell>
                          <input type="radio" name={`m-${key}`} disabled={r.is_merged}
                            checked={masters[key] === r.customer_id}
                            onChange={() => {
                              setMasters(m => ({ ...m, [key]: r.customer_id }));
                              setSelected(s => ({ ...s, [key]: new Set(rows.filter(x => !x.is_merged && x.customer_id !== r.customer_id).map(x => x.customer_id)) }));
                            }} />
                        </TableCell>
                        <TableCell>
                          <input type="checkbox" disabled={r.is_merged || masters[key] === r.customer_id}
                            checked={selected[key]?.has(r.customer_id) ?? false}
                            onChange={(e) => setSelected(s => {
                              const set = new Set(s[key] ?? []);
                              if (e.target.checked) set.add(r.customer_id); else set.delete(r.customer_id);
                              return { ...s, [key]: set };
                            })} />
                        </TableCell>
                        <TableCell className="text-sm font-medium">{r.name}</TableCell>
                        <TableCell className="text-xs font-mono">{r.customer_code || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{r.sms_mobile || r.phone || "—"}</TableCell>
                        <TableCell className="text-xs">{r.city || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{Number(r.balance ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs">{r.si_count}</TableCell>
                        <TableCell className="text-right text-xs">{r.payment_count}</TableCell>
                        <TableCell className="text-right text-xs">{r.dn_count}</TableCell>
                        <TableCell>
                          {r.is_merged ? (
                            <Button size="sm" variant="ghost" onClick={() => undoMerge("customer", r.customer_id)} disabled={busy}>
                              <Undo2 className="h-3 w-3 mr-1" /> Undo
                            </Button>
                          ) : <Badge variant="outline" className="text-[10px]">Active</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        <AlertDialog open={!!confirmGroup} onOpenChange={(o) => !o && setConfirmGroup(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm merge</AlertDialogTitle>
              <AlertDialogDescription>
                All transactions on the selected duplicates will be moved onto the master record.
                Duplicates will become inactive but stay in the database. This is reversible for 7 days.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => {
                if (!confirmGroup) return;
                const [kind, key] = confirmGroup.split(":", 2);
                runMerge(kind === "s" ? "supplier" : "customer", key);
              }}>
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Merge className="h-4 w-4 mr-2" />}
                Merge now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
