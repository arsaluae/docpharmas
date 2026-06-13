import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CloudUpload, Download, ArrowLeft, ArrowRight, CheckCircle2, X, AlertTriangle, Sparkles, UserPlus, Pencil, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import {
  detectHeaderMap, parseRows, matchRow, normalizeEmail, normalizeMobile, normalizeName, findDuplicate,
  type ContactRow, type CustomerLite, type MatchResult, type ExistingContactLite, type DuplicateAction,
} from "@/lib/import/contacts";

type Step = 1 | 2 | 3 | 4;

const TEMPLATE_HEADERS = ["Customer Name", "Customer Code", "Contact Person", "Designation", "Mobile", "Phone", "Email"];
const TEMPLATE_SAMPLE = [
  ["Rehman Medicos", "CUST-0001", "Ali Rehman", "Owner", "03001234567", "042-3578-9000", "ali@rehmanmed.pk"],
  ["Shifa Pharmacy", "", "Dr. Sara Khan", "Pharmacist", "03219876543", "", "sara@shifa.pk"],
];

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE]);
  ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, "Contacts");
  XLSX.writeFile(wb, "customer-contacts-template.xlsx");
}

function ConfidenceBadge({ value }: { value: number }) {
  let cls = "bg-muted/60 text-muted-foreground";
  if (value >= 85) cls = "bg-emerald-500/10 text-emerald-500";
  else if (value >= 60) cls = "bg-amber-500/10 text-amber-500";
  else if (value > 0) cls = "bg-destructive/10 text-destructive";
  return <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${cls}`}>{value}%</span>;
}

function StatusPill({ s }: { s: MatchResult["status"] }) {
  const map: Record<MatchResult["status"], string> = {
    auto: "bg-emerald-500/10 text-emerald-500",
    review: "bg-amber-500/10 text-amber-500",
    unmatched: "bg-destructive/10 text-destructive",
    accepted: "bg-primary/10 text-primary",
    skipped: "bg-muted/60 text-muted-foreground",
    created: "bg-emerald-500/10 text-emerald-500",
  };
  return <span className={`px-2 py-0.5 rounded text-[11px] capitalize ${map[s]}`}>{s}</span>;
}

export default function ContactImportWizard() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [headerMap, setHeaderMap] = useState<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 2
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [filter, setFilter] = useState<"all" | "auto" | "review" | "unmatched" | "skipped">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTargetRow, setCreateTargetRow] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", phone: "", email: "" });

  // Step 3 result
  const [posting, setPosting] = useState(false);
  const [summary, setSummary] = useState<{
    total: number; matched: number; unmatched: number; imported: number;
    updated: number; duplicatesSkipped: number; errors: string[];
  } | null>(null);

  async function onFile(f: File) {
    setFileName(f.name);
    const ab = await f.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    if (!aoa.length) { toast.error("File is empty"); return; }
    const headers = (aoa[0] as unknown[]).map(h => String(h ?? "").trim());
    const map = detectHeaderMap(headers);
    if (map.contact_name == null) {
      toast.error("Missing required column: Contact Person");
      return;
    }
    setHeaderMap(map);
    const data = aoa.slice(1).filter(r => (r as unknown[]).some(c => c !== "" && c != null)) as unknown[][];
    const parsed = parseRows(data, map);
    setRows(parsed);
    toast.success(`Parsed ${parsed.length} contact rows`);
  }

  async function runMatch() {
    if (!rows.length) { toast.error("Upload a file first"); return; }
    // Bulk fetch customers (single query; pagination not needed for matching scope).
    const all: CustomerLite[] = [];
    let from = 0;
    const SIZE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, company, customer_code")
        .range(from, from + SIZE - 1);
      if (error) { toast.error(error.message); return; }
      if (!data?.length) break;
      all.push(...(data as CustomerLite[]));
      if (data.length < SIZE) break;
      from += SIZE;
    }
    setCustomers(all);
    setMatches(rows.map(r => matchRow(r, all)));
    setStep(2);
  }

  const visibleMatches = useMemo(() => {
    if (filter === "all") return matches;
    return matches.filter(m => m.status === filter);
  }, [matches, filter]);

  const counts = useMemo(() => ({
    total: matches.length,
    auto: matches.filter(m => m.status === "auto" || m.status === "accepted").length,
    review: matches.filter(m => m.status === "review").length,
    unmatched: matches.filter(m => m.status === "unmatched").length,
    skipped: matches.filter(m => m.status === "skipped").length,
    pending: matches.filter(m => m.status === "review" || m.status === "unmatched").length,
  }), [matches]);

  function updateMatch(rowNumber: number, patch: Partial<MatchResult>) {
    setMatches(prev => prev.map(m => m.row.rowNumber === rowNumber ? { ...m, ...patch } : m));
  }

  function changeMatchTo(rowNumber: number, customerId: string) {
    const c = customers.find(x => x.id === customerId);
    if (!c) return;
    updateMatch(rowNumber, {
      matchedCustomerId: c.id,
      matchedLabel: c.name || c.company || "—",
      confidence: 100,
      matchReason: "Manual",
      status: "accepted",
    });
  }

  function acceptAllAuto() {
    setMatches(prev => prev.map(m => m.status === "auto" ? { ...m, status: "accepted" } : m));
  }
  function skipUnmatched() {
    setMatches(prev => prev.map(m => m.status === "unmatched" ? { ...m, status: "skipped" } : m));
  }

  function openCreate(rowNumber: number) {
    const m = matches.find(x => x.row.rowNumber === rowNumber);
    if (!m) return;
    setCreateTargetRow(rowNumber);
    setCreateForm({
      name: m.row.customer_name || m.row.contact_name || "",
      phone: m.row.mobile || m.row.phone || "",
      email: m.row.email || "",
    });
    setCreateOpen(true);
  }

  async function handleCreateCustomer() {
    if (!createForm.name.trim() || createTargetRow == null) return;
    const { data, error } = await supabase.from("customers").insert({
      name: createForm.name.trim(),
      phone: createForm.phone || null,
      email: createForm.email || null,
    } as any).select("id, name, company, customer_code").single();
    if (error) { toast.error(error.message); return; }
    const newC = data as CustomerLite;
    setCustomers(prev => [...prev, newC]);
    updateMatch(createTargetRow, {
      matchedCustomerId: newC.id,
      matchedLabel: newC.name || createForm.name,
      confidence: 100,
      matchReason: "Created",
      status: "created",
    });
    toast.success("Customer created");
    setCreateOpen(false);
    setCreateTargetRow(null);
  }

  async function runImport() {
    setPosting(true);
    try {
      const ready = matches.filter(m =>
        (m.status === "accepted" || m.status === "auto" || m.status === "created") && m.matchedCustomerId);

      if (!ready.length) { toast.error("Nothing to import"); setPosting(false); return; }

      const customerIds = [...new Set(ready.map(m => m.matchedCustomerId!))];

      // Bulk fetch existing contacts for those customers (for dedupe + primary detection).
      const existing: ExistingContactLite[] = [];
      const CHUNK = 200;
      for (let i = 0; i < customerIds.length; i += CHUNK) {
        const ids = customerIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("customer_contacts" as any)
          .select("id, customer_id, contact_name, mobile, email")
          .in("customer_id", ids);
        if (error) throw error;
        existing.push(...((data ?? []) as ExistingContactLite[]));
      }

      // Group ready contacts by customer to assign primary when none exists.
      const byCustomer = new Map<string, MatchResult[]>();
      for (const m of ready) {
        const list = byCustomer.get(m.matchedCustomerId!) ?? [];
        list.push(m); byCustomer.set(m.matchedCustomerId!, list);
      }

      let imported = 0, updated = 0, dupSkipped = 0;
      const errors: string[] = [];
      const inserts: any[] = [];
      const updates: { id: string; payload: any }[] = [];

      for (const [custId, list] of byCustomer) {
        const customerExisting = existing.filter(e => e.customer_id === custId);
        const hasPrimary = customerExisting.length > 0
          ? (await supabase.from("customer_contacts" as any).select("id").eq("customer_id", custId).eq("is_primary", true).limit(1)).data?.length
          : false;
        let assignedPrimary = !!hasPrimary;

        for (const m of list) {
          const candidate = {
            contact_name: m.row.contact_name,
            designation: m.row.designation || null,
            mobile: m.row.mobile || null,
            phone: m.row.phone || null,
            email: m.row.email || null,
          };
          const dup = findDuplicate(custId, {
            contact_name: m.row.contact_name,
            mobile: m.row.mobile,
            email: m.row.email,
          }, customerExisting);
          if (dup) {
            // Update strategy: fill in any missing fields without overwriting existing data.
            updates.push({
              id: dup.id,
              payload: {
                contact_name: candidate.contact_name || dup.contact_name,
                mobile: candidate.mobile || dup.mobile,
                email: candidate.email || dup.email,
                designation: candidate.designation,
                phone: candidate.phone,
              },
            });
            updated++;
            continue;
          }
          inserts.push({
            customer_id: custId,
            ...candidate,
            is_primary: !assignedPrimary,
            source: "import",
          });
          if (!assignedPrimary) assignedPrimary = true;
          imported++;
        }
      }

      // Apply inserts in chunks of 500
      for (let i = 0; i < inserts.length; i += 500) {
        const slice = inserts.slice(i, i + 500);
        const { error } = await supabase.from("customer_contacts" as any).insert(slice);
        if (error) { errors.push(error.message); imported -= slice.length; }
      }
      // Apply updates sequentially (small volumes)
      for (const u of updates) {
        const { error } = await supabase.from("customer_contacts" as any).update(u.payload).eq("id", u.id);
        if (error) errors.push(error.message);
      }

      const sum = {
        total: matches.length,
        matched: matches.filter(m => m.matchedCustomerId).length,
        unmatched: matches.filter(m => !m.matchedCustomerId && m.status !== "skipped").length,
        imported,
        updated,
        duplicatesSkipped: dupSkipped,
        errors,
      };
      setSummary(sum);

      await logAudit({
        entity_type: "import_batch",
        entity_id: null as any,
        action: "created" as any,
        description: `Customer contacts imported: ${imported} new, ${updated} updated`,
        changes: { kind: "customer_contacts", ...sum } as any,
      });

      setStep(4);
      toast.success(`Imported ${imported} contacts (${updated} updated)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setPosting(false);
    }
  }

  return (
    <AppLayout title="Customer Contact Import">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Customer Contact Import</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload contact persons from Excel and auto-match them to existing customers.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => nav("/import")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Data Import
          </Button>
        </div>

        <Stepper step={step} />

        {step === 1 && (
          <Card className="p-6 space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" /> Download template</Button>
              <input
                ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <CloudUpload className="h-4 w-4 mr-2" /> Choose file
              </Button>
            </div>

            {!!rows.length && (
              <Card className="p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{fileName}</span>
                    <Badge variant="secondary">{rows.length} rows</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setRows([]); setFileName(""); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <ScrollArea className="max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 20).map(r => (
                        <TableRow key={r.rowNumber}>
                          <TableCell className="text-xs">{r.customer_name || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.customer_code || "—"}</TableCell>
                          <TableCell className="text-xs font-medium">{r.contact_name}</TableCell>
                          <TableCell className="text-xs">{r.designation || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.mobile || "—"}</TableCell>
                          <TableCell className="text-xs">{r.email || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={runMatch} disabled={!rows.length}>
                Run smart matching <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium text-sm">Verify matches</p>
                <p className="text-xs text-muted-foreground">
                  {counts.auto} auto · {counts.review} review · {counts.unmatched} unmatched · {counts.skipped} skipped
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={acceptAllAuto}>Accept all auto-matched</Button>
              <Button size="sm" variant="outline" onClick={skipUnmatched}>Skip all unmatched</Button>
            </div>

            <div className="px-4 pt-3 flex flex-wrap gap-2">
              {(["all", "auto", "review", "unmatched", "skipped"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded text-xs border ${
                    filter === f ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground hover:bg-foreground/[0.04]"
                  }`}>
                  {f.charAt(0).toUpperCase() + f.slice(1)} ({f === "all" ? matches.length : matches.filter(m => m.status === f).length})
                </button>
              ))}
            </div>

            <ScrollArea className="max-h-[60vh] mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Excel Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Matched ERP Customer</TableHead>
                    <TableHead className="text-center">Confidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMatches.map(m => (
                    <TableRow key={m.row.rowNumber}>
                      <TableCell className="text-[11px] text-muted-foreground tabular-nums">{m.row.rowNumber}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{m.row.customer_name || "—"}</div>
                        {m.row.customer_code && <div className="text-[10px] text-muted-foreground font-mono">{m.row.customer_code}</div>}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{m.row.contact_name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{m.row.mobile || m.row.email || ""}</div>
                      </TableCell>
                      <TableCell className="text-xs min-w-[220px]">
                        <Select value={m.matchedCustomerId ?? "__none"} onValueChange={(v) => {
                          if (v === "__none") return;
                          changeMatchTo(m.row.rowNumber, v);
                        }}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Choose customer">
                              {m.matchedLabel || "Choose customer"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {customers.slice(0, 500).map(c => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {c.name || c.company} {c.customer_code ? `· ${c.customer_code}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center"><ConfidenceBadge value={m.confidence} /></TableCell>
                      <TableCell><StatusPill s={m.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {m.matchedCustomerId && m.status !== "accepted" && m.status !== "created" && (
                            <Button size="xs" variant="outline" onClick={() => updateMatch(m.row.rowNumber, { status: "accepted" })}>
                              Accept
                            </Button>
                          )}
                          {m.status !== "skipped" && (
                            <Button size="xs" variant="ghost" onClick={() => updateMatch(m.row.rowNumber, { status: "skipped" })}>
                              Skip
                            </Button>
                          )}
                          {!m.matchedCustomerId && (
                            <Button size="xs" variant="outline" onClick={() => openCreate(m.row.rowNumber)}>
                              <UserPlus className="h-3 w-3 mr-1" /> Create
                            </Button>
                          )}
                          {m.status === "skipped" && (
                            <Button size="xs" variant="ghost" onClick={() => updateMatch(m.row.rowNumber, { status: m.matchedCustomerId ? "accepted" : "unmatched" })}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="p-4 border-t border-border flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
              {counts.pending > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Resolve {counts.pending} pending row(s) before importing
                </div>
              )}
              <Button onClick={runImport} disabled={counts.pending > 0 || posting}>
                {posting ? "Importing…" : "Import contacts"}<ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {step === 4 && summary && (
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-emerald-500/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Import complete</h2>
                <p className="text-sm text-muted-foreground">Summary of this batch</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat label="Total Rows" v={summary.total} />
              <Stat label="Matched" v={summary.matched} tone="primary" />
              <Stat label="Unmatched" v={summary.unmatched} tone="muted" />
              <Stat label="Contacts Imported" v={summary.imported} tone="primary" />
              <Stat label="Updated" v={summary.updated} />
              <Stat label="Errors" v={summary.errors.length} tone={summary.errors.length ? "danger" : "muted"} />
            </div>
            {!!summary.errors.length && (
              <div className="border border-destructive/20 bg-destructive/5 rounded p-3 max-h-48 overflow-auto">
                {summary.errors.slice(0, 20).map((e, i) => (
                  <p key={i} className="text-xs text-destructive/80 font-mono">• {e}</p>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={() => { setStep(1); setRows([]); setMatches([]); setSummary(null); setFileName(""); }}>
                Import more
              </Button>
              <Button variant="outline" onClick={() => nav("/customers")}>Go to Customers</Button>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new customer</DialogTitle>
            <DialogDescription>Quick-create a customer from this row. You can edit details later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Customer name *</Label><Input value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} /></div>
            <div><Label className="text-xs">Phone</Label><Input value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} /></div>
            <div><Label className="text-xs">Email</Label><Input value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCustomer} disabled={!createForm.name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["Upload", "Verify Matches", "—", "Summary"];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {labels.map((l, i) => {
        if (l === "—") return null;
        const n = (i + 1) as Step;
        const active = step === n; const done = step > n;
        return (
          <div key={l} className="flex items-center gap-2">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
              done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-foreground/[0.06] text-muted-foreground"
            }`}>{done ? "✓" : n}</div>
            <span className={`text-xs ${active ? "font-medium" : "text-muted-foreground"}`}>{l}</span>
            {i < labels.length - 1 && labels[i+1] !== "—" && <div className="w-6 h-px bg-border" />}
            {i < labels.length - 1 && labels[i+1] === "—" && <div className="w-6 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, v, tone = "default" }: { label: string; v: number; tone?: "default" | "primary" | "muted" | "danger" }) {
  const cls = tone === "primary" ? "text-primary" : tone === "danger" ? "text-destructive" : tone === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <div className="border border-border rounded p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${cls}`}>{v}</p>
    </div>
  );
}
