import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, RotateCcw, Save, AlertTriangle } from "lucide-react";
import { useRoles } from "@/hooks/useRoles";
import {
  DOC_TYPE_META, DEFAULT_TEMPLATES, VARIABLE_GROUPS,
  findUnknownPlaceholders, renderTemplate,
  type WaDocType, type WhatsAppTemplateRow,
} from "@/lib/whatsapp-templates";

const SAMPLE_VARS: Record<string, string> = {
  company_name: "DocPharmas",
  company_phone: "+92 300 0000000",
  company_email: "billing@docpharmas.com",
  company_address: "Plot 12, Industrial Area, Karachi",
  customer_name: "ABC Pharmacy",
  customer_code: "CUS-0042",
  customer_phone: "+92 321 1234567",
  customer_city: "Lahore",
  customer_address: "Shop 5, Main Bazaar",
  document_type: "Sales Invoice",
  document_number: "INV-0123",
  document_date: "11 Jun 2026",
  due_date: "25 Jun 2026",
  validity_days: "15",
  document_total: "125,400",
  amount_in_words: "One Lakh Twenty-Five Thousand Four Hundred Only",
  document_status: "Dispatched",
  sales_agent_name: "Ali Raza",
  sales_agent_phone: "+92 333 9876543",
  opening_balance: "50,000",
  debit_total: "200,000",
  credit_total: "175,000",
  closing_balance: "75,000",
  outstanding_amount: "75,000",
  payment_amount: "75,000",
  payment_date: "11 Jun 2026",
  payment_method: "Bank Transfer",
  payment_reference: "TRX-558822",
  document_link: "https://docpharmas.com/d/inv-0123",
  ledger_link: "https://docpharmas.com/l/cus-0042",
  payment_receipt_link: "https://docpharmas.com/r/pay-0099",
};

export function WhatsAppTemplatesCard() {
  const { can, isOwner } = useRoles();
  const canEdit = isOwner || can("settings", "write");

  const [rows, setRows] = useState<Record<string, WhatsAppTemplateRow | undefined>>({});
  const [activeKey, setActiveKey] = useState<WaDocType>("sales_invoice");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatedMeta, setUpdatedMeta] = useState<{ at?: string; by?: string }>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadAll = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("whatsapp_templates")
      .select("*");
    const map: Record<string, WhatsAppTemplateRow> = {};
    (data || []).forEach((r: WhatsAppTemplateRow) => { map[r.document_type] = r; });
    setRows(map);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // load editor when active key or rows change
  useEffect(() => {
    const r = rows[activeKey];
    if (r) {
      setName(r.template_name);
      setBody(r.message_body);
      setActive(r.is_active);
      setUpdatedMeta({ at: r.updated_at, by: r.updated_by || undefined });
    } else {
      const def = DEFAULT_TEMPLATES[activeKey];
      setName(def.name);
      setBody(def.body);
      setActive(true);
      setUpdatedMeta({});
    }
  }, [activeKey, rows]);

  const unknown = useMemo(() => findUnknownPlaceholders(body), [body]);
  const preview = useMemo(() => renderTemplate(body, SAMPLE_VARS), [body]);

  const insertVar = (v: string) => {
    const ta = textareaRef.current;
    const token = `{{${v}}}`;
    if (!ta) { setBody(b => b + token); return; }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const resetToDefault = () => {
    const def = DEFAULT_TEMPLATES[activeKey];
    setName(def.name);
    setBody(def.body);
    setActive(true);
    toast.message("Reset to default. Click Save to apply.");
  };

  const save = async () => {
    if (!canEdit) { toast.error("Only admins can edit templates."); return; }
    if (!body.trim()) { toast.error("Message body cannot be empty."); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id || null;
    const existing = rows[activeKey];
    const payload: any = {
      document_type: activeKey,
      template_name: name.trim() || DEFAULT_TEMPLATES[activeKey].name,
      message_body: body,
      is_active: active,
      is_default: false,
      updated_by: userId,
    };
    let error;
    if (existing) {
      ({ error } = await (supabase as any).from("whatsapp_templates").update(payload).eq("id", existing.id));
    } else {
      payload.created_by = userId;
      ({ error } = await (supabase as any).from("whatsapp_templates").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error("Save failed: " + error.message); return; }
    toast.success("Template saved");
    await loadAll();
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-success" /> WhatsApp Message Templates
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Edit the message body used by the WhatsApp share buttons. Click a variable on the right to insert it. {canEdit ? "" : "Read-only — admin permission required to edit."}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-12 gap-4">
          {/* Doc-type tabs */}
          <div className="col-span-12 md:col-span-3 space-y-1">
            {DOC_TYPE_META.map(t => {
              const r = rows[t.key];
              const isActive = activeKey === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveKey(t.key)}
                  className={`w-full text-left text-sm px-3 py-2 rounded border transition-colors ${isActive ? "border-primary bg-primary/5 text-foreground" : "border-border hover:bg-foreground/[0.04] text-muted-foreground"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{t.label}</span>
                    {r ? (
                      <span className={`h-1.5 w-1.5 rounded-full ${r.is_active ? "bg-success" : "bg-muted-foreground/40"}`} />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">default</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Editor */}
          <div className="col-span-12 md:col-span-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Template Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="flex items-end justify-between gap-3 pb-1">
                <div>
                  <Label className="block mb-2">Active</Label>
                  <Switch checked={active} onCheckedChange={setActive} disabled={!canEdit} />
                </div>
                <div className="text-[11px] text-muted-foreground text-right">
                  {updatedMeta.at ? <>Updated {new Date(updatedMeta.at).toLocaleString()}</> : <>Not yet saved (using default)</>}
                </div>
              </div>
            </div>

            <div>
              <Label>Message Body</Label>
              <Textarea
                ref={textareaRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={!canEdit}
                className="font-mono text-[13px] min-h-[260px]"
              />
              {unknown.length > 0 && (
                <p className="text-xs text-warning mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Unknown placeholders: {unknown.map(u => `{{${u}}}`).join(", ")}
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Live Preview (sample data)</Label>
              <pre className="mt-1 text-[12px] whitespace-pre-wrap rounded border border-border bg-foreground/[0.03] p-3 leading-relaxed">{preview}</pre>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={resetToDefault} disabled={!canEdit}>
                <RotateCcw className="h-4 w-4 mr-1" /> Reset to Default
              </Button>
              <Button size="sm" onClick={save} disabled={!canEdit || saving || loading}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save Template"}
              </Button>
            </div>
          </div>

          {/* Variable palette */}
          <div className="col-span-12 md:col-span-3">
            <Label className="text-xs text-muted-foreground">Available Variables</Label>
            <div className="mt-2 space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {VARIABLE_GROUPS.map(g => (
                <div key={g.label}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{g.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {g.vars.map(v => (
                      <button
                        key={v}
                        onClick={() => insertVar(v)}
                        disabled={!canEdit}
                        className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-border hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                        title={`Insert {{${v}}}`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
