import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Save, Upload, FileText, Plus, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useDocumentTemplates, DocumentTemplate } from "@/hooks/useDocumentTemplates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DOC_TYPE_LABELS: Record<string, string> = {
  sales_invoice: "Sales Invoice / Sales Order",
  warranty_invoice: "Warranty Invoice / Warranty Note",
  proforma: "Proforma Invoice (Sales)",
  purchase_proforma: "Purchase Proforma",
  delivery_note: "Delivery Note",
  purchase_order: "Purchase Order",
  grn: "Goods Received Note (GRN)",
};

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_name: "", address: "", phone: "", email: "", website: "",
    logo_url: "", fbr_enabled: false, ntn: "", strn: "",
    gst_enabled: false, default_gst_rate: "17", wht_enabled: false, default_wht_rate: "4.5",
    whatsapp_number: "",
  });

  const { templates, loading: templatesLoading, updateTemplate } = useDocumentTemplates();

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from("company_settings").select("*").limit(1).single();
    if (data) {
      setSettingsId(data.id);
      setForm({
        company_name: data.company_name || "",
        address: data.address || "",
        phone: data.phone || "",
        email: data.email || "",
        website: data.website || "",
        logo_url: data.logo_url || "",
        fbr_enabled: data.fbr_enabled || false,
        ntn: data.ntn || "",
        strn: data.strn || "",
        gst_enabled: (data as any).gst_enabled || false,
        default_gst_rate: String((data as any).default_gst_rate ?? 17),
        wht_enabled: (data as any).wht_enabled || false,
        default_wht_rate: String((data as any).default_wht_rate ?? 4.5),
        whatsapp_number: (data as any).whatsapp_number || "",
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      company_name: form.company_name, address: form.address, phone: form.phone,
      email: form.email, website: form.website, logo_url: form.logo_url,
      fbr_enabled: form.fbr_enabled, ntn: form.ntn, strn: form.strn,
      gst_enabled: form.gst_enabled, default_gst_rate: Number(form.default_gst_rate),
      wht_enabled: form.wht_enabled, default_wht_rate: Number(form.default_wht_rate),
      whatsapp_number: form.whatsapp_number || null,
    };
    if (settingsId) {
      await supabase.from("company_settings").update(payload as any).eq("id", settingsId);
    } else {
      const { data } = await supabase.from("company_settings").insert(payload as any).select().single();
      if (data) setSettingsId(data.id);
    }
    toast.success("Settings saved");
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop();
    const path = `logo.${ext}`;
    const { error } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); return; }
    const { data: { publicUrl } } = supabase.storage.from("company-assets").getPublicUrl(path);
    setForm({ ...form, logo_url: publicUrl });
    toast.success("Logo uploaded");
  };

  if (loading) return null;

  const headerActions = (
    <Button size="sm" onClick={handleSave} disabled={saving}>
      <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Settings"}
    </Button>
  );

  return (
    <AppLayout title="Settings" subtitle="Company profile, tax configuration & templates" headerActions={headerActions}>
      <div className="max-w-4xl">
        <Tabs defaultValue="company" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="company">Company Profile</TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="h-4 w-4 mr-1" /> Document Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-6 max-w-2xl">
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-lg">Company Profile</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Company Logo</Label>
                  <div className="flex items-center gap-4 mt-1">
                    {form.logo_url && <img src={form.logo_url} alt="Logo" className="h-16 w-auto rounded border border-border" />}
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent text-sm">
                        <Upload className="h-4 w-4" /> Upload Logo
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Company Name</Label><Input value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                  <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                  <div><Label>Website</Label><Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} /></div>
                  <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
                  <div><Label>NTN</Label><Input value={form.ntn} onChange={e => setForm({...form, ntn: e.target.value})} /></div>
                  <div><Label>STRN</Label><Input value={form.strn} onChange={e => setForm({...form, strn: e.target.value})} /></div>
                </div>
              </CardContent>
            </Card>

            {/* WhatsApp Configuration */}
            <Card className="glass-card border-emerald-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-emerald-500" /> WhatsApp Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>WhatsApp Number for Reorder Alerts</Label>
                  <Input 
                    value={form.whatsapp_number} 
                    onChange={e => setForm({...form, whatsapp_number: e.target.value})} 
                    placeholder="+923001234567"
                    className="mt-1 max-w-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    When stock runs low, you'll get a WhatsApp alert with reorder suggestions
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader><CardTitle className="text-lg">Tax Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {/* GST */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">GST (General Sales Tax)</p>
                      <p className="text-xs text-muted-foreground">When enabled, GST fields appear on products, invoices, proformas & expenses</p>
                    </div>
                    <Switch checked={form.gst_enabled} onCheckedChange={v => setForm({...form, gst_enabled: v})} />
                  </div>
                  {form.gst_enabled && (
                    <div className="ml-4 max-w-xs">
                      <Label>Default GST Rate (%)</Label>
                      <Input type="number" step="0.1" value={form.default_gst_rate} onChange={e => setForm({...form, default_gst_rate: e.target.value})} />
                    </div>
                  )}
                </div>

                <div className="border-t border-border" />

                {/* WHT */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">WHT (Withholding Tax)</p>
                      <p className="text-xs text-muted-foreground">When enabled, WHT rate field appears on suppliers & purchase bills</p>
                    </div>
                    <Switch checked={form.wht_enabled} onCheckedChange={v => setForm({...form, wht_enabled: v})} />
                  </div>
                  {form.wht_enabled && (
                    <div className="ml-4 max-w-xs">
                      <Label>Default WHT Rate (%)</Label>
                      <Input type="number" step="0.1" value={form.default_wht_rate} onChange={e => setForm({...form, default_wht_rate: e.target.value})} />
                    </div>
                  )}
                </div>

                <div className="border-t border-border" />

                {/* FBR */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">FBR QR Code</p>
                    <p className="text-xs text-muted-foreground">When enabled, FBR QR column appears on sales invoices</p>
                  </div>
                  <Switch checked={form.fbr_enabled} onCheckedChange={v => setForm({...form, fbr_enabled: v})} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            {templatesLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading templates...</div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Configure PDF layout for each document type. Changes are saved individually per template.</p>
                <Accordion type="single" collapsible className="space-y-2">
                  {templates.map(tpl => (
                    <TemplateCard key={tpl.id} template={tpl} onUpdate={updateTemplate} />
                  ))}
                </Accordion>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function TemplateCard({ template, onUpdate }: { template: DocumentTemplate; onUpdate: (id: string, u: Partial<DocumentTemplate>) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(template.title);
  const [showTotalInWords, setShowTotalInWords] = useState(template.show_total_in_words);
  const [showBankDetails, setShowBankDetails] = useState(template.show_bank_details);
  const [bankDetailsText, setBankDetailsText] = useState(template.bank_details_text);
  const [footerText, setFooterText] = useState(template.footer_text);
  const [signatureLabels, setSignatureLabels] = useState<string[]>(template.signature_labels || []);
  const [showPartyArea, setShowPartyArea] = useState(template.show_party_area);
  const [showPartyLicense, setShowPartyLicense] = useState(template.show_party_license);
  const [showPartyCnic, setShowPartyCnic] = useState(template.show_party_cnic);
  const [columns, setColumns] = useState(template.columns_config || []);

  const save = async () => {
    setSaving(true);
    await onUpdate(template.id, {
      title,
      show_total_in_words: showTotalInWords,
      show_bank_details: showBankDetails,
      bank_details_text: bankDetailsText,
      footer_text: footerText,
      signature_labels: signatureLabels,
      show_party_area: showPartyArea,
      show_party_license: showPartyLicense,
      show_party_cnic: showPartyCnic,
      columns_config: columns,
    } as any);
    toast.success(`${title} template saved`);
    setSaving(false);
  };

  const addColumn = () => setColumns([...columns, { header: "New Column", key: "new_col", align: "left" as const }]);
  const removeColumn = (i: number) => setColumns(columns.filter((_, idx) => idx !== i));
  const updateColumn = (i: number, field: string, value: string) => {
    const updated = [...columns];
    (updated[i] as any)[field] = value;
    setColumns(updated);
  };

  const addSignature = () => setSignatureLabels([...signatureLabels, "New Label"]);
  const removeSignature = (i: number) => setSignatureLabels(signatureLabels.filter((_, idx) => idx !== i));

  return (
    <AccordionItem value={template.document_type} className="border border-border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-primary" />
          <div className="text-left">
            <div className="font-semibold text-sm">{DOC_TYPE_LABELS[template.document_type] || template.document_type}</div>
            <div className="text-xs text-muted-foreground">PDF Title: "{title}"</div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pt-4 space-y-6">
        <div>
          <Label>Document Title (shown on PDF)</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 max-w-xs" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border">
            <Label className="text-xs">Total in Words</Label>
            <Switch checked={showTotalInWords} onCheckedChange={setShowTotalInWords} />
          </div>
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border">
            <Label className="text-xs">Bank Details</Label>
            <Switch checked={showBankDetails} onCheckedChange={setShowBankDetails} />
          </div>
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border">
            <Label className="text-xs">Party Area</Label>
            <Switch checked={showPartyArea} onCheckedChange={setShowPartyArea} />
          </div>
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border">
            <Label className="text-xs">Party License No</Label>
            <Switch checked={showPartyLicense} onCheckedChange={setShowPartyLicense} />
          </div>
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border">
            <Label className="text-xs">Party CNIC</Label>
            <Switch checked={showPartyCnic} onCheckedChange={setShowPartyCnic} />
          </div>
        </div>
        {showBankDetails && (
          <div>
            <Label>Bank Details Text</Label>
            <Input value={bankDetailsText} onChange={e => setBankDetailsText(e.target.value)} className="mt-1" placeholder="e.g. Meezan Bank: 09020102207667" />
          </div>
        )}
        <div>
          <Label>Footer / Certification Text</Label>
          <Textarea value={footerText} onChange={e => setFooterText(e.target.value)} className="mt-1" rows={3} placeholder="Leave empty for no footer certification text" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Table Columns</Label>
            <Button size="sm" variant="outline" onClick={addColumn}><Plus className="h-3 w-3 mr-1" /> Add Column</Button>
          </div>
          <div className="space-y-2">
            {columns.map((col, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={col.header} onChange={e => updateColumn(i, "header", e.target.value)} placeholder="Header" className="flex-1" />
                <Input value={col.key} onChange={e => updateColumn(i, "key", e.target.value)} placeholder="Key" className="w-36" />
                <select value={col.align || "left"} onChange={e => updateColumn(i, "align", e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
                <Button size="icon" variant="ghost" onClick={() => removeColumn(i)} className="text-destructive h-8 w-8"><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Signature Labels</Label>
            <Button size="sm" variant="outline" onClick={addSignature}><Plus className="h-3 w-3 mr-1" /> Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {signatureLabels.map((label, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input value={label} onChange={e => { const updated = [...signatureLabels]; updated[i] = e.target.value; setSignatureLabels(updated); }} className="w-48" />
                <Button size="icon" variant="ghost" onClick={() => removeSignature(i)} className="text-destructive h-8 w-8"><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        </div>
        <Button onClick={save} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Template"}
        </Button>
      </AccordionContent>
    </AccordionItem>
  );
}
