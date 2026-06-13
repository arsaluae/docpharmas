import { useEffect, useMemo, useRef, useState } from "react";
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
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  CloudUpload, Download, ArrowLeft, ArrowRight, CheckCircle2, X, AlertTriangle,
  Sparkles, UserPlus, Pencil, FileSpreadsheet, Columns3,
} from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import {
  autoDetectMapping, parseRows, matchRow, findDuplicate, customerSearchText,
  type ContactRow, type ColumnMapping, type ContactField,
  type CustomerLite, type MatchResult, type ExistingContactLite,
} from "@/lib/import/contacts";

type Step = 1 | 2 | 3 | 4;

const TEMPLATE_HEADERS = ["Customer Name", "Customer Code", "Contact Person", "Designation", "Mobile", "Phone", "Email", "City", "Area"];
const TEMPLATE_SAMPLE = [
  ["Rehman Medicos", "CUST-0001", "Ali Rehman", "Owner", "03001234567", "042-3578-9000", "ali@rehmanmed.pk", "Lahore", "Gulberg"],
  ["Shifa Pharmacy", "", "Dr. Sara Khan", "Pharmacist", "03219876543", "", "sara@shifa.pk", "Karachi", "Defence"],
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
  if (value >= 90) cls = "bg-emerald-500/10 text-emerald-500";
  else if (value >= 70) cls = "bg-amber-500/10 text-amber-500";
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

const FIELD_LABELS: Record<ContactField, string> = {
  customer_name: "Customer Name",
  contact_name: "Contact Person",
  mobile: "Mobile",
  phone: "Phone",
  customer_code: "Customer Code",
  city: "City",
  area: "Area",
  address: "Address",
  designation: "Designation",
  email: "Email",
  notes: "Notes",
};

const REQUIRED_FIELDS: ContactField[] = ["customer_name", "contact_name"];
const OPTIONAL_FIELDS: ContactField[] = ["mobile", "phone", "customer_code", "designation", "email", "city", "area", "address", "notes"];

const NONE_VALUE = "__none";

export default function ContactImportWizard() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // Step 1 — file
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [aoa, setAoa] = useState<unknown[][]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 1.5 — mapping
  const [mapping, setMapping] = useState<ColumnMapping>({});

  // Step 2 — matches
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [filter, setFilter] = useState<"all" | "auto" | "review" | "unmatched" | "skipped">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTargetRow, setCreateTargetRow] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", phone: "", email: "" });
  const [overwriteMobile, setOverwriteMobile] = useState(false);

  // Step 4 — summary
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
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    if (!grid.length) { toast.error("File is empty"); return; }
    const hdr = (grid[0] as unknown[]).map(h => String(h ?? "").trim());
    const data = grid.slice(1).filter(r => (r as unknown[]).some(c => c !== "" && c != null)) as unknown[][];
    setHeaders(hdr);
    setAoa(data);
    setMapping(autoDetectMapping(hdr));
    toast.success(`Read ${data.length} rows — review column mapping`);
  }

  function setField(field: ContactField, value: string) {
    setMapping(m => ({ ...m, [field]: value === NONE_VALUE ? null : Number(value) }));
  }

  const mappingPreview = useMemo(() => {
    if (!aoa.length) return [];
    return parseRows(aoa.slice(0, 8), mapping, headers);
  }, [aoa, mapping, headers]);

  const fallbackCount = useMemo(
    () => mappingPreview.filter(r => r.matchNameSource === "contact").length,
    [mappingPreview]
  );

  async function runMatch() {
    if (mapping.customer_name == null && mapping.contact_name == null) {
      toast.error("Map either Customer Name or Contact Person before matching");
      return;
    }
    if (mapping.contact_name == null) {
      toast.error("Contact Person column is required");
      return;
    }
    const parsed = parseRows(aoa, mapping, headers);
    if (!parsed.length) { toast.error("No usable rows after mapping"); return; }
    setRows(parsed);

    // Bulk fetch customers including searchable fields.
    const all: CustomerLite[] = [];
    let from = 0;
    const SIZE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, company, customer_code, city, area, phone, mobile")
        .range(from, from + SIZE - 1);
      if (error) { toast.error(error.message); return; }
      if (!data?.length) break;
      all.push(...(data as CustomerLite[]));
      if (data.length < SIZE) break;
      from += SIZE;
    }
    setCustomers(all);
    setMatches(parsed.map(r => matchRow(r, all)));
    setStep(3);
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
      matchMethod: "Manual",
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
      name: m.row.matchName || m.row.contact_name || "",
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
    } as any).select("id, name, company, customer_code, city, area, phone, mobile").single();
    if (error) { toast.error(error.message); return; }
    const newC = data as CustomerLite;
    setCustomers(prev => [...prev, newC]);
    updateMatch(createTargetRow, {
      matchedCustomerId: newC.id,
      matchedLabel: newC.name || createForm.name,
      confidence: 100,
      matchMethod: "Created",
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

      const existing: ExistingContactLite[] = [];
      const CHUNK = 200;
      for (let i = 0; i < customerIds.length; i += CHUNK) {
        const ids = customerIds.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("customer_contacts" as any)
          .select("id, customer_id, contact_name, mobile, email")
          .in("customer_id", ids);
        if (error) throw error;
        existing.push(...((data ?? []) as unknown as ExistingContactLite[]));
      }

      const byCustomer = new Map<string, MatchResult[]>();
      for (const m of ready) {
        const list = byCustomer.get(m.matchedCustomerId!) ?? [];
        list.push(m); byCustomer.set(m.matchedCustomerId!, list);
      }

      let imported = 0, updated = 0;
      const dupSkipped = 0;
      const errors: string[] = [];
      const inserts: any[] = [];
      const updates: { id: string; payload: any }[] = [];
      const customerMobileUpdates: { id: string; mobile: string }[] = [];

      for (const [custId, list] of byCustomer) {
        const customerExisting = existing.filter(e => e.customer_id === custId);
        const hasPrimary = customerExisting.length > 0
          ? (await supabase.from("customer_contacts" as any).select("id").eq("customer_id", custId).eq("is_primary", true).limit(1)).data?.length
          : false;
        let assignedPrimary = !!hasPrimary;
        const cust = customers.find(c => c.id === custId);

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

          // Optional: update customer's mobile if blank, or always (with confirmation flag).
          if (cust && candidate.mobile && (overwriteMobile || !cust.mobile)) {
            customerMobileUpdates.push({ id: custId, mobile: candidate.mobile });
          }
        }
      }

      for (let i = 0; i < inserts.length; i += 500) {
        const slice = inserts.slice(i, i + 500);
        const { error } = await supabase.from("customer_contacts" as any).insert(slice);
        if (error) { errors.push(error.message); imported -= slice.length; }
      }
      for (const u of updates) {
        const { error } = await supabase.from("customer_contacts" as any).update(u.payload).eq("id", u.id);
        if (error) errors.push(error.message);
      }
      // Apply customer mobile updates (deduped, last write wins per customer).
      const mobileMap = new Map<string, string>();
      for (const m of customerMobileUpdates) mobileMap.set(m.id, m.mobile);
      for (const [id, mobile] of mobileMap) {
        const { error } = await supabase.from("customers").update({ mobile } as any).eq("id", id);
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
        entity_id: null,
        action: "import_completed",
        changes: { kind: "customer_contacts", note: `${imported} new, ${updated} updated`, ...sum } as any,
      });

      setStep(4);
      toast.success(`Imported ${imported} contacts (${updated} updated)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
    } finally {
      setPosting(false);
    }
  }

  // ---- Customer picker options (filtered to ~1000 of best matches per row to keep popover snappy) ----
  const customerOptions = useMemo(() => customers.map(c => ({
    value: c.id,
    label: [c.name || c.company || "(unnamed)", c.customer_code && `· ${c.customer_code}`, c.city && `· ${c.city}`]
      .filter(Boolean).join(" "),
    search: customerSearchText(c),
  })), [customers]);

  return (
    <AppLayout title="Customer Contact Import">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Customer Contact Import</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload contact persons from Excel, map columns, and auto-match to existing customers.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => nav("/import")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Data Import
          </Button>
        </div>

        <Stepper step={step} />

        {/* ============ STEP 1: UPLOAD ============ */}
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

            {!!aoa.length && (
              <Card className="p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{fileName}</span>
                    <Badge variant="secondary">{aoa.length} rows · {headers.length} columns</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setAoa([]); setHeaders([]); setFileName(""); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Headers detected: {headers.filter(Boolean).slice(0, 12).join(" · ")}
                  {headers.length > 12 ? ` … (+${headers.length - 12})` : ""}
                </p>
              </Card>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)} disabled={!aoa.length}>
                Continue to column mapping <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* ============ STEP 2: MAPPING ============ */}
        {step === 2 && (
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Columns3 className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">Map Excel columns to ERP fields</h2>
                <p className="text-xs text-muted-foreground">
                  We auto-detected columns where possible. Adjust any mapping below — pick <em>None</em> to ignore a field.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {REQUIRED_FIELDS.map(f => (
                <MappingRow key={f} field={f} required headers={headers} value={mapping[f]} onChange={(v) => setField(f, v)} />
              ))}
              {OPTIONAL_FIELDS.map(f => (
                <MappingRow key={f} field={f} headers={headers} value={mapping[f]} onChange={(v) => setField(f, v)} />
              ))}
            </div>

            {mapping.customer_name == null && mapping.contact_name != null && (
              <div className="border border-amber-500/30 bg-amber-500/5 rounded p-3 text-xs flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <strong>No Customer Name column mapped.</strong> The Contact Person column will be used as the customer matching name as a fallback.
                </div>
              </div>
            )}
            {mapping.customer_name != null && fallbackCount > 0 && (
              <div className="border border-amber-500/30 bg-amber-500/5 rounded p-3 text-xs flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <strong>{fallbackCount} of {mappingPreview.length}</strong> preview rows have blank Customer Name — the Contact Person value will be used as the matching name for those rows.
                </div>
              </div>
            )}

            {!!mappingPreview.length && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</p>
                <ScrollArea className="max-h-72 border border-border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Match Name</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>City</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mappingPreview.map(r => (
                        <TableRow key={r.rowNumber}>
                          <TableCell className="text-xs font-medium">{r.matchName || <span className="text-destructive">— blank —</span>}</TableCell>
                          <TableCell>
                            <Badge variant={r.matchNameSource === "customer" ? "secondary" : r.matchNameSource === "contact" ? "outline" : "destructive"} className="text-[10px]">
                              {r.matchNameSource}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{r.contact_name || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.mobile || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{r.customer_code || "—"}</TableCell>
                          <TableCell className="text-xs">{r.city || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
              <Button onClick={runMatch} disabled={mapping.contact_name == null}>
                Run smart matching <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* ============ STEP 3: VERIFY ============ */}
        {step === 3 && (
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium text-sm">Verify matches</p>
                <p className="text-xs text-muted-foreground">
                  {counts.auto} auto · {counts.review} review · {counts.unmatched} unmatched · {counts.skipped} skipped
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" className="accent-primary" checked={overwriteMobile} onChange={e => setOverwriteMobile(e.target.checked)} />
                Overwrite customer mobile when present
              </label>
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
                    <TableHead>Excel Name Used</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Matched ERP Customer</TableHead>
                    <TableHead>Method</TableHead>
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
                        <div className="font-medium">{m.row.matchName || "—"}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {m.row.matchNameSource === "contact" && <Badge variant="outline" className="text-[9px] py-0">from Contact</Badge>}
                          {m.row.customer_code && <span className="font-mono ml-1">{m.row.customer_code}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{m.row.contact_name || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{m.row.mobile || "—"}</TableCell>
                      <TableCell className="text-xs min-w-[240px]">
                        <CustomerPicker
                          options={customerOptions}
                          value={m.matchedCustomerId ?? ""}
                          onChange={(v) => v && changeMatchTo(m.row.rowNumber, v)}
                          placeholder="Choose customer"
                        />
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{m.matchMethod}</TableCell>
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
              <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
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

        {/* ============ STEP 4: SUMMARY ============ */}
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
              <Button onClick={() => {
                setStep(1); setAoa([]); setHeaders([]); setRows([]); setMatches([]);
                setSummary(null); setFileName(""); setMapping({});
              }}>
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

function MappingRow({
  field, headers, value, onChange, required,
}: {
  field: ContactField;
  headers: string[];
  value: number | null | undefined;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Label className="text-xs w-36 shrink-0">
        {FIELD_LABELS[field]}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select value={value == null ? NONE_VALUE : String(value)} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select column" /></SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={NONE_VALUE} className="text-xs italic text-muted-foreground">— None —</SelectItem>
          {headers.map((h, i) => (
            <SelectItem key={i} value={String(i)} className="text-xs">
              {h || `(column ${i + 1})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Custom picker that filters via the merged search blob (name + company + code + city + area + phone + mobile).
function CustomerPicker({
  options, value, onChange, placeholder,
}: {
  options: { value: string; label: string; search: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options.slice(0, 200);
    return options.filter(o => o.search.includes(needle)).slice(0, 200);
  }, [options, q]);
  const selected = options.find(o => o.value === value);

  useEffect(() => { if (!open) setQ(""); }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left h-8 px-2 rounded border border-border bg-background text-xs flex items-center justify-between hover:bg-foreground/[0.04]"
      >
        <span className="truncate">{selected?.label || <span className="text-muted-foreground">{placeholder}</span>}</span>
        <ArrowRight className="h-3 w-3 ml-1 opacity-50 rotate-90" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-[340px] bg-popover border border-border rounded shadow-lg">
          <Input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search name, code, city, phone…"
            className="h-8 text-xs border-0 border-b border-border rounded-none focus-visible:ring-0"
          />
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && <div className="p-3 text-xs text-muted-foreground">No matches</div>}
            {filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-foreground/[0.06] truncate"
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels: { n: Step; label: string }[] = [
    { n: 1, label: "Upload" },
    { n: 2, label: "Map columns" },
    { n: 3, label: "Verify matches" },
    { n: 4, label: "Summary" },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {labels.map(({ n, label }, i) => {
        const active = step === n; const done = step > n;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
              done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-foreground/[0.06] text-muted-foreground"
            }`}>{done ? "✓" : n}</div>
            <span className={`text-xs ${active ? "font-medium" : "text-muted-foreground"}`}>{label}</span>
            {i < labels.length - 1 && <div className="w-6 h-px bg-border" />}
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
