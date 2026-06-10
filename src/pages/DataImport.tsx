import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { ENTITIES, ENTITY_LIST, EntityType, NormalizedRow } from "@/lib/import/types";
import { detectMapping } from "@/lib/import/aliases";
import { downloadTemplate, downloadFailedRowsCsv } from "@/lib/import/templates";
import { validateAll } from "@/lib/import/validators";
import { postBatch } from "@/lib/import/posters";
import { logAudit } from "@/lib/audit";
import { CloudUpload, Download, FileSpreadsheet, X, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, History, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Step = 1 | 2 | 3 | 4 | 5;

const GROUPS: { id: "master"|"opening"|"transaction"; label: string }[] = [
  { id: "master", label: "Master Data" },
  { id: "opening", label: "Opening Balances" },
  { id: "transaction", label: "Historical Transactions" },
];

export default function DataImport() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [entity, setEntity] = useState<EntityType | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<(string | null)[]>([]);
  const [validated, setValidated] = useState<NormalizedRow[] | null>(null);
  const [allowPastExpiry, setAllowPastExpiry] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{posted: number; skipped: number; errors: string[]} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const spec = entity ? ENTITIES[entity] : null;

  const resetAll = () => {
    setStep(1); setEntity(null); setFileName(""); setFileSize(0);
    setHeaders([]); setRawRows([]); setMapping([]); setValidated(null);
    setBatchId(null); setPosting(false); setProgress(0); setResult(null);
  };

  const goStep = (s: Step) => setStep(s);

  // ---------- Step 3: File parse ----------
  async function parseFile(f: File) {
    setFileName(f.name); setFileSize(f.size);
    const ab = await f.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    if (!aoa.length) { toast.error("File is empty"); return; }
    const hdr = (aoa[0] as unknown[]).map(h => String(h ?? "").trim());
    setHeaders(hdr);
    const rows = (aoa.slice(1) as unknown[][])
      .filter(r => r.some(c => c !== "" && c != null))
      .map(r => {
        const obj: Record<string, unknown> = {};
        hdr.forEach((h, i) => { obj[h] = r[i]; });
        return obj;
      });
    setRawRows(rows);
    if (entity) {
      const auto = detectMapping(hdr, entity);
      setMapping(auto);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) parseFile(f);
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0]; if (f) parseFile(f);
  }

  // Re-apply mapping to rows: rebuild rows using mapped canonical keys
  const mappedRows: Record<string, unknown>[] = useMemo(() => {
    if (!entity || rawRows.length === 0) return [];
    return rawRows.map(orig => {
      const out: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        const k = mapping[i];
        if (k) out[k] = orig[h];
      });
      return out;
    });
  }, [entity, rawRows, headers, mapping]);

  const requiredMissing = useMemo(() => {
    if (!spec) return [];
    const mapped = new Set(mapping.filter(Boolean) as string[]);
    return spec.fields.filter(f => f.required && !mapped.has(f.key)).map(f => f.key);
  }, [spec, mapping]);

  // ---------- Step 4: Validate + stage ----------
  async function runValidate() {
    if (!entity || !spec) return;
    if (requiredMissing.length > 0) { toast.error(`Map required fields: ${requiredMissing.join(", ")}`); return; }
    const v = validateAll(entity, mappedRows, { allowPastExpiry });
    setValidated(v);
    const valid = v.filter(r => r.errors.length === 0).length;
    const invalid = v.length - valid;

    // Create batch + stage
    const { data: { user } } = await supabase.auth.getUser();
    const { data: batchRow, error: bErr } = await supabase.from("import_batches").insert({
      entity_type: entity,
      file_name: fileName, file_size: fileSize,
      row_count: v.length, mapped_count: mapping.filter(Boolean).length,
      valid_count: valid, invalid_count: invalid,
      column_mapping: { headers, mapping } as any,
      options: { allowPastExpiry } as any,
      status: "validated",
      created_by: user?.id ?? null,
    } as any).select("id").single();
    if (bErr || !batchRow) { toast.error(bErr?.message ?? "Could not create batch"); return; }
    const bid = (batchRow as any).id as string;
    setBatchId(bid);

    // Persist staging rows in chunks
    const chunkSize = 500;
    for (let i = 0; i < v.length; i += chunkSize) {
      const slice = v.slice(i, i + chunkSize).map(r => ({
        batch_id: bid,
        row_number: r.rowNumber,
        raw: r.raw as any,
        normalized: r.normalized as any,
        status: r.errors.length === 0 ? "valid" : "invalid",
        errors: r.errors as any,
      }));
      const { error } = await supabase.from("import_staging_rows").insert(slice as any);
      if (error) { toast.error(`Staging failed: ${error.message}`); return; }
    }
    setStep(4);
  }

  // ---------- Step 5: Post ----------
  async function runPost() {
    if (!entity || !validated || !batchId) return;
    setPosting(true); setProgress(20);
    try {
      await supabase.from("import_batches").update({ status: "posting" } as any).eq("id", batchId);
      const r = await postBatch(entity, validated, batchId);
      setProgress(95);
      await supabase.from("import_batches").update({
        status: r.errors.length > 0 && r.posted === 0 ? "failed" : "completed",
        posted_count: r.posted,
        posted_at: new Date().toISOString(),
        error_summary: { posting_errors: r.errors.slice(0, 50) } as any,
      } as any).eq("id", batchId);
      await logAudit({
        action: "created",
        entity_type: "tenant_member", // closest existing audit entity
        entity_number: batchId,
        changes: { import_entity: entity, posted: r.posted, skipped: r.skipped } as any,
      });
      setResult(r); setStep(5); setProgress(100);
      toast.success(`Imported ${r.posted} records`);
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed");
      await supabase.from("import_batches").update({ status: "failed" } as any).eq("id", batchId);
    } finally {
      setPosting(false);
    }
  }

  return (
    <AppLayout title="Data Import">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Data Import & Migration</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Migrate from any legacy ERP. Validate before posting, rollback any batch in one click.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => nav("/import/history")}>
            <History className="h-4 w-4 mr-2" /> Import History
          </Button>
        </div>

        {/* Stepper */}
        <Stepper step={step} />

        {/* Step 1 — Pick entity */}
        {step === 1 && (
          <div className="space-y-6">
            {GROUPS.map(g => (
              <div key={g.id}>
                <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground mb-3 font-semibold">{g.label}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ENTITY_LIST.filter(e => ENTITIES[e].group === g.id).map(e => (
                    <button
                      key={e}
                      onClick={() => { setEntity(e); setStep(2); }}
                      className="text-left p-4 border border-border rounded hover:border-primary/60 hover:bg-foreground/[0.02] transition-colors"
                    >
                      <p className="font-medium text-sm">{ENTITIES[e].label}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ENTITIES[e].description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 2 — Template */}
        {step === 2 && spec && (
          <Card className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">{spec.label}</h2>
              <p className="text-sm text-muted-foreground mt-1">{spec.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => downloadTemplate(entity!, true)}>
                <Download className="h-4 w-4 mr-2" /> Download template with examples
              </Button>
              <Button variant="outline" onClick={() => downloadTemplate(entity!, false)}>
                <Download className="h-4 w-4 mr-2" /> Blank template
              </Button>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Fields</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                {spec.fields.map(f => (
                  <div key={f.key} className="flex items-center justify-between border-b border-border/40 py-1.5">
                    <span><code className="text-xs">{f.key}</code> <span className="text-muted-foreground">— {f.label}</span></span>
                    {f.required && <Badge variant="outline" className="text-[10px]">required</Badge>}
                  </div>
                ))}
              </div>
            </div>
            <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Upload file" />
          </Card>
        )}

        {/* Step 3 — Upload + map */}
        {step === 3 && spec && (
          <div className="space-y-4">
            {rawRows.length === 0 ? (
              <Card
                onClick={() => fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                className={`p-12 border-dashed cursor-pointer text-center ${isDragging ? "border-primary bg-primary/5" : ""}`}
              >
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
                <CloudUpload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Drop your file here, or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Accepts .xlsx, .xls, .csv</p>
              </Card>
            ) : (
              <>
                <Card className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {rawRows.length} rows · {headers.length} columns · {mapping.filter(Boolean).length} mapped
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setRawRows([]); setHeaders([]); setMapping([]); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </Card>

                <Card className="p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Column mapping</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {headers.map((h, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-sm flex-1 truncate text-muted-foreground">{h || `(col ${i+1})`}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Select value={mapping[i] ?? "__ignore"} onValueChange={(v) => {
                          const next = [...mapping]; next[i] = v === "__ignore" ? null : v; setMapping(next);
                        }}>
                          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__ignore">— ignore —</SelectItem>
                            {spec.fields.map(f => (
                              <SelectItem key={f.key} value={f.key}>{f.label}{f.required ? " *" : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  {requiredMissing.length > 0 && (
                    <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                      Map required field(s): {requiredMissing.join(", ")}
                    </div>
                  )}
                </Card>

                {entity === "batches" && (
                  <Card className="p-4 flex items-center gap-3">
                    <Switch checked={allowPastExpiry} onCheckedChange={setAllowPastExpiry} id="past-exp" />
                    <Label htmlFor="past-exp" className="text-sm">Allow batches with past expiry dates</Label>
                  </Card>
                )}

                <NavRow onBack={() => setStep(2)} onNext={runValidate} nextLabel="Validate" disableNext={requiredMissing.length > 0} />
              </>
            )}
          </div>
        )}

        {/* Step 4 — Preview */}
        {step === 4 && validated && spec && (
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div className="flex-1">
                <p className="font-medium text-sm">Validation complete</p>
                <p className="text-xs text-muted-foreground">
                  {validated.filter(r => r.errors.length === 0).length} valid · {validated.filter(r => r.errors.length > 0).length} invalid
                </p>
              </div>
              {validated.some(r => r.errors.length > 0) && (
                <Button variant="outline" size="sm" onClick={() => downloadFailedRowsCsv(entity!, validated.filter(r => r.errors.length > 0))}>
                  <Download className="h-3.5 w-3.5 mr-2" /> Failed rows CSV
                </Button>
              )}
            </div>

            <Tabs defaultValue="valid" className="p-4">
              <TabsList>
                <TabsTrigger value="valid">Valid ({validated.filter(r => r.errors.length === 0).length})</TabsTrigger>
                <TabsTrigger value="invalid">Invalid ({validated.filter(r => r.errors.length > 0).length})</TabsTrigger>
              </TabsList>
              <TabsContent value="valid">
                <PreviewTable rows={validated.filter(r => r.errors.length === 0).slice(0, 50)} fields={spec.fields.map(f => f.key)} showErrors={false} />
              </TabsContent>
              <TabsContent value="invalid">
                <PreviewTable rows={validated.filter(r => r.errors.length > 0).slice(0, 100)} fields={spec.fields.map(f => f.key)} showErrors />
              </TabsContent>
            </Tabs>

            {posting && (
              <div className="p-4 border-t border-border space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">Posting…</p>
              </div>
            )}

            <div className="p-4 border-t border-border flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(3)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
              <Button onClick={runPost} disabled={posting || validated.filter(r => r.errors.length === 0).length === 0}>
                Post {validated.filter(r => r.errors.length === 0).length} valid records <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step 5 — Result */}
        {step === 5 && result && (
          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-emerald-500/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Import complete</h2>
                <p className="text-sm text-muted-foreground">Batch ID: <code className="text-xs">{batchId}</code></p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Posted" value={result.posted} tone="primary" />
              <Stat label="Skipped" value={result.skipped} tone="muted" />
              <Stat label="Errors" value={result.errors.length} tone="danger" />
            </div>
            {result.errors.length > 0 && (
              <div className="border border-destructive/20 bg-destructive/5 rounded p-3 max-h-48 overflow-auto">
                {result.errors.slice(0, 20).map((e, i) => (
                  <p key={i} className="text-xs text-destructive/80 font-mono">• {e}</p>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={resetAll}>Import more</Button>
              <Button variant="outline" onClick={() => nav("/import/history")}>
                <History className="h-4 w-4 mr-2" /> View history
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["Type", "Template", "Upload & Map", "Validate", "Post"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const n = (i + 1) as Step;
        const active = step === n; const done = step > n;
        return (
          <div key={l} className="flex items-center gap-2">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
              done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-foreground/[0.06] text-muted-foreground"
            }`}>{done ? "✓" : n}</div>
            <span className={`text-xs ${active ? "font-medium" : "text-muted-foreground"}`}>{l}</span>
            {i < labels.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function NavRow({ onBack, onNext, nextLabel, disableNext }: { onBack: () => void; onNext: () => void; nextLabel: string; disableNext?: boolean }) {
  return (
    <div className="flex items-center justify-between pt-2">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
      <Button onClick={onNext} disabled={disableNext}>{nextLabel} <ArrowRight className="h-4 w-4 ml-2" /></Button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "primary"|"muted"|"danger" }) {
  const cls = tone === "primary" ? "text-primary" : tone === "danger" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="border border-border rounded p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function PreviewTable({ rows, fields, showErrors }: { rows: NormalizedRow[]; fields: string[]; showErrors: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">No rows.</p>;
  return (
    <ScrollArea className="max-h-96 mt-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Row</TableHead>
            {fields.map(f => <TableHead key={f}>{f}</TableHead>)}
            {showErrors && <TableHead>Errors</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.rowNumber}>
              <TableCell className="text-xs text-muted-foreground tabular-nums">{r.rowNumber}</TableCell>
              {fields.map(f => <TableCell key={f} className="text-xs">{String(r.normalized[f] ?? r.raw[f] ?? "")}</TableCell>)}
              {showErrors && (
                <TableCell className="text-xs text-destructive">
                  {r.errors.map(e => `${e.field}: ${e.message}`).join(" · ")}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
