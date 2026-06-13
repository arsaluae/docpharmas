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
import { Save, Upload, FileText, Plus, Trash2, MessageCircle, Download, Database, Cloud, RefreshCw, Clock, Users, ShieldCheck, Truck, Wallet, UserCog, Send, Wrench } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { useDocumentTemplates, DocumentTemplate } from "@/hooks/useDocumentTemplates";
import { WARRANTY_NOTE_TEXT } from "@/lib/warranty-declaration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import * as XLSX from "xlsx";
import { FreightProvidersCard } from "@/components/settings/FreightProvidersCard";
import { WhatsAppTemplatesCard } from "@/components/settings/WhatsAppTemplatesCard";
import { SandboxTestingTab } from "@/components/settings/SandboxTestingTab";
import { FlaskConical } from "lucide-react";
import { CREATABLE_ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type TenantRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const DOC_TYPE_LABELS: Record<string, string> = {
 sales_invoice: "Sales Invoice / Sales Order",
 warranty_invoice: "Warranty Invoice / Warranty Note",
 proforma: "Proforma Invoice (Sales)",
 purchase_proforma: "Purchase Proforma",
 delivery_note: "Delivery Note",
 purchase_order: "Purchase Order",
 grn: "Goods Received Note (GRN)",
};

const BACKUP_TABLES = [
 { table: "customers", sheet: "Customers" },
 { table: "suppliers", sheet: "Suppliers" },
 { table: "products", sheet: "Products" },
 { table: "proforma_invoices", sheet: "Sales Orders" },
 { table: "sales_invoices", sheet: "Sales Invoices" },
 { table: "sales_invoice_items", sheet: "Sales Invoice Items" },
 { table: "purchase_proformas", sheet: "Purchase Proformas" },
 { table: "purchase_proforma_items", sheet: "Purchase Proforma Items" },
 { table: "purchase_orders", sheet: "Purchase Orders" },
 { table: "purchase_order_items", sheet: "PO Items" },
 { table: "purchase_invoices", sheet: "Purchase Invoices" },
 { table: "payments", sheet: "Payments" },
 { table: "expenses", sheet: "Expenses" },
 { table: "expense_ledgers", sheet: "Expense Ledgers" },
 { table: "bank_accounts", sheet: "Bank Accounts" },
 { table: "delivery_notes", sheet: "Delivery Notes" },
 { table: "print_jobs", sheet: "Print Jobs" },
 { table: "printers", sheet: "Printers" },
 { table: "sales_agents", sheet: "Sales Agents" },
 { table: "agent_customers", sheet: "Agent Customers" },
 { table: "agent_commissions", sheet: "Agent Commissions" },
 { table: "credit_notes", sheet: "Credit Notes" },
 { table: "debit_notes", sheet: "Debit Notes" },
 { table: "salary_payments", sheet: "Salary Payments" },
 { table: "stock_movements", sheet: "Stock Movements" },
 { table: "sales_returns", sheet: "Sales Returns" },
 { table: "sales_return_items", sheet: "Sales Return Items" },
 { table: "purchase_returns", sheet: "Purchase Returns" },
 { table: "purchase_return_items", sheet: "Purchase Return Items" },
 { table: "document_templates", sheet: "Doc Templates" },
 { table: "document_counters", sheet: "Doc Counters" },
 { table: "company_settings", sheet: "Company Settings" },
 { table: "customer_products", sheet: "Customer Products" },
 { table: "customer_licenses", sheet: "Customer Licenses" },
 { table: "customer_distributors", sheet: "Customer Distributors" },
 { table: "chart_of_accounts", sheet: "Chart of Accounts" },
 { table: "journal_entries", sheet: "Journal Entries" },
 { table: "journal_lines", sheet: "Journal Lines" },
 { table: "goods_received_notes", sheet: "GRN" },
 { table: "grn_items", sheet: "GRN Items" },
 { table: "drap_registrations", sheet: "DRAP Registrations" },
 { table: "additional_costs", sheet: "Additional Costs" },
] as const;

export default function Settings() {
 const navigate = useNavigate();
 const { tenantRole, tenantId } = useTenant();
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [settingsId, setSettingsId] = useState<string | null>(null);
 const [backupLoading, setBackupLoading] = useState(false);
 const [lastBackup, setLastBackup] = useState<string | null>(null);
 const [form, setForm] = useState({
 company_name: "", address: "", phone: "", email: "", website: "",
 logo_url: "", fbr_enabled: false, ntn: "", strn: "",
 gst_enabled: false, default_gst_rate: "17", wht_enabled: false, default_wht_rate: "4.5",
 whatsapp_number: "",
    show_customer_mobile_on_docs: false, show_customer_phone_on_docs: false,
    show_supplier_mobile_on_docs: false, show_supplier_phone_on_docs: false,
    warranty_note_text: "",
    warranty_declaration_enabled: true,
    warranty_require_mobile: true,
    warranty_require_address: true,
    warranty_require_license_no: true,
    warranty_require_license_expiry: true,
    warranty_require_batch_number: true,
    warranty_require_batch_expiry: true,
    warranty_stamp_url: "",
    warranty_signature_url: "",
    warranty_footer_text: "",
    warranty_show_company_stamp: true,
    warranty_show_rep_signature: true,
    warranty_show_prepared_by: true,
    warranty_show_agent_license_number: true,
    warranty_show_agent_license_expiry: true,
    document_page_mode: "auto" as "half" | "full" | "auto",
  });


 const { templates, loading: templatesLoading, updateTemplate } = useDocumentTemplates();

 useEffect(() => {
 loadSettings();
 setLastBackup(localStorage.getItem("docpharmas_last_backup"));
 }, []);

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
 show_customer_mobile_on_docs: !!(data as any).show_customer_mobile_on_docs,
 show_customer_phone_on_docs: !!(data as any).show_customer_phone_on_docs,
 show_supplier_mobile_on_docs: !!(data as any).show_supplier_mobile_on_docs,
        show_supplier_phone_on_docs: !!(data as any).show_supplier_phone_on_docs,
          warranty_note_text: (data as any).warranty_note_text || "",
          warranty_declaration_enabled: (data as any).warranty_declaration_enabled !== false,
          warranty_require_mobile: (data as any).warranty_require_mobile !== false,
          warranty_require_address: (data as any).warranty_require_address !== false,
          warranty_require_license_no: (data as any).warranty_require_license_no !== false,
          warranty_require_license_expiry: (data as any).warranty_require_license_expiry !== false,
          warranty_require_batch_number: (data as any).warranty_require_batch_number !== false,
          warranty_require_batch_expiry: (data as any).warranty_require_batch_expiry !== false,
          warranty_stamp_url: (data as any).warranty_stamp_url || "",
          warranty_signature_url: (data as any).warranty_signature_url || "",
          warranty_footer_text: (data as any).warranty_footer_text || "",
          warranty_show_company_stamp: (data as any).warranty_show_company_stamp !== false,
          warranty_show_rep_signature: (data as any).warranty_show_rep_signature !== false,
          warranty_show_prepared_by: (data as any).warranty_show_prepared_by !== false,
          warranty_show_agent_license_number: (data as any).warranty_show_agent_license_number !== false,
          warranty_show_agent_license_expiry: (data as any).warranty_show_agent_license_expiry !== false,
          document_page_mode: ((data as any).document_page_mode || "auto") as "half" | "full" | "auto",
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
 show_customer_mobile_on_docs: form.show_customer_mobile_on_docs,
 show_customer_phone_on_docs: form.show_customer_phone_on_docs,
 show_supplier_mobile_on_docs: form.show_supplier_mobile_on_docs,
      show_supplier_phone_on_docs: form.show_supplier_phone_on_docs,
       warranty_note_text: form.warranty_note_text || null,
       warranty_declaration_enabled: form.warranty_declaration_enabled,
       warranty_require_mobile: form.warranty_require_mobile,
       warranty_require_address: form.warranty_require_address,
       warranty_require_license_no: form.warranty_require_license_no,
       warranty_require_license_expiry: form.warranty_require_license_expiry,
       warranty_require_batch_number: form.warranty_require_batch_number,
        warranty_require_batch_expiry: form.warranty_require_batch_expiry,
        warranty_stamp_url: form.warranty_stamp_url || null,
        warranty_signature_url: form.warranty_signature_url || null,
        warranty_footer_text: form.warranty_footer_text || null,
        warranty_show_company_stamp: form.warranty_show_company_stamp,
        warranty_show_rep_signature: form.warranty_show_rep_signature,
        warranty_show_prepared_by: form.warranty_show_prepared_by,
        warranty_show_agent_license_number: form.warranty_show_agent_license_number,
        warranty_show_agent_license_expiry: form.warranty_show_agent_license_expiry,
        document_page_mode: form.document_page_mode,
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
 if (!tenantId) { toast.error("Tenant not loaded"); return; }
 const ext = file.name.split(".").pop();
 const path = `${tenantId}/logo.${ext}`;
 const { error } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
 if (error) { toast.error("Upload failed"); return; }
 const { data: { publicUrl } } = supabase.storage.from("company-assets").getPublicUrl(path);
 setForm({ ...form, logo_url: publicUrl });
 toast.success("Logo uploaded");
 };

 const uploadWarrantyAsset = async (file: File, kind: "stamp" | "signature"): Promise<string | null> => {
   if (!tenantId) { toast.error("Tenant not loaded"); return null; }
   if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) { toast.error("Only PNG, JPG, or WebP images"); return null; }
   if (file.size > 5 * 1024 * 1024) { toast.error("File too large — maximum 5MB"); return null; }
   const ext = file.name.split(".").pop() || "png";
   const path = `${tenantId}/warranty-${kind}-${Date.now()}.${ext}`;
   const { error } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true, contentType: file.type });
   if (error) { toast.error(`${kind} upload failed`); return null; }
   const { data: { publicUrl } } = supabase.storage.from("company-assets").getPublicUrl(path);
   return publicUrl;
 };


 const fetchAllRows = async (tableName: string) => {
 const PAGE_SIZE = 500;
 let allData: any[] = [];
 let from = 0;
 let hasMore = true;
 while (hasMore) {
 // Use type assertion for dynamic table name
 const { data, error } = await (supabase as any).from(tableName).select("*").range(from, from + PAGE_SIZE - 1);
 if (error) { console.error(`Error fetching ${tableName}:`, error); break; }
 if (data) allData = allData.concat(data);
 hasMore = data ? data.length === PAGE_SIZE : false;
 from += PAGE_SIZE;
 }
 return allData;
 };

 const handleBackup = async () => {
 setBackupLoading(true);
 try {
 const workbook = XLSX.utils.book_new();
 
 for (let i = 0; i < BACKUP_TABLES.length; i++) {
 const { table, sheet } = BACKUP_TABLES[i];
 const data = await fetchAllRows(table);
 const worksheet = XLSX.utils.json_to_sheet(data);
 XLSX.utils.book_append_sheet(workbook, worksheet, sheet);
 }

 const today = new Date().toISOString().split("T")[0];
 XLSX.writeFile(workbook, `DocPharmas_Backup_${today}.xlsx`);
 
 const timestamp = new Date().toLocaleString();
 localStorage.setItem("docpharmas_last_backup", timestamp);
 setLastBackup(timestamp);
 toast.success("Backup downloaded successfully!");
 } catch (err: any) {
 toast.error("Backup failed: " + err.message);
 } finally {
 setBackupLoading(false);
 }
 };

 if (loading) return null;

 const headerActions = (
 <Button size="sm" onClick={handleSave} disabled={saving}>
 <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Settings"}
 </Button>
 );

 return (
 <AppLayout title="Settings" subtitle="Company profile, tax configuration, templates & backup" headerActions={headerActions}>
 <div className="max-w-6xl">
 <Tabs defaultValue="company" className="w-full">
 <TabsList className="mb-6">
 <TabsTrigger value="company">Company Profile</TabsTrigger>
 <TabsTrigger value="operations">
 <Wrench className="h-4 w-4 mr-1" /> Operations
 </TabsTrigger>
 <TabsTrigger value="templates">
 <FileText className="h-4 w-4 mr-1" /> Document Templates
 </TabsTrigger>
 <TabsTrigger value="whatsapp">
 <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp Templates
 </TabsTrigger>
 {tenantRole === "owner" && (
 <TabsTrigger value="team">
 <Users className="h-4 w-4 mr-1" /> Team & Access
 </TabsTrigger>
 )}
				<TabsTrigger value="backup">
					<Database className="h-4 w-4 mr-1" /> Data Backup
				</TabsTrigger>
				{tenantRole === "owner" && (
					<TabsTrigger value="testing">
						<FlaskConical className="h-4 w-4 mr-1" /> Testing
					</TabsTrigger>
				)}
				</TabsList>


 <TabsContent value="operations" className="space-y-6 max-w-3xl">
 <Card className="glass-card">
 <CardHeader>
 <CardTitle className="text-lg">Operations Shortcuts</CardTitle>
 <p className="text-xs text-muted-foreground mt-1">Quick access to secondary day-to-day tools — moved here to keep the sidebar focused.</p>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 {[
 { label: "Sales Agents", desc: "Manage commission agents", icon: UserCog, url: "/sales-agents" },
 { label: "Couriers", desc: "Freight dispatch tracking", icon: Truck, url: "/couriers" },
 { label: "Delivery Notes", desc: "Logistics & DN status", icon: Send, url: "/delivery-notes" },
 { label: "Receive Payment", desc: "Customer payments in", icon: Wallet, url: "/payments?tab=received" },
 { label: "Make Payment", desc: "Supplier payments out", icon: Wallet, url: "/payments?tab=made" },
 { label: "Credit Notes", desc: "Customer credit adjustments", icon: FileText, url: "/credit-notes" },
 { label: "Debit Notes", desc: "Supplier debit adjustments", icon: FileText, url: "/debit-notes" },
 { label: "Stock Audit", desc: "Cross-check stock vs movements", icon: ShieldCheck, url: "/stock-audit" },
 ].map(it => (
 <button key={it.url} onClick={() => navigate(it.url)}
 className="text-left p-4 rounded-xl border border-border from-card to-muted/30 hover:border-primary/40 transition-all group">
 <div className="flex items-center gap-2 mb-1">
 <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
 <it.icon className="h-4 w-4 text-primary" />
 </div>
 <p className="font-medium text-sm text-foreground">{it.label}</p>
 </div>
 <p className="text-xs text-muted-foreground">{it.desc}</p>
 </button>
 ))}
 </div>
 </CardContent>
 </Card>

 <FreightProvidersCard />
 </TabsContent>



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

 <Card className="glass-card border-border">
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <MessageCircle className="h-5 w-5 text-success" /> WhatsApp Alerts
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

 <div className="flex items-center justify-between">
 <div>
 <p className="font-medium text-sm">FBR QR Code</p>
 <p className="text-xs text-muted-foreground">When enabled, FBR QR column appears on sales invoices</p>
 </div>
 <Switch checked={form.fbr_enabled} onCheckedChange={v => setForm({...form, fbr_enabled: v})} />
 </div>

 <div className="border-t border-border" />

 <div className="space-y-3">
 <div>
 <p className="font-medium text-sm">Document Preferences</p>
 <p className="text-xs text-muted-foreground">Choose which contact numbers appear on printed Sales/Purchase documents. All off by default.</p>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
 <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
 <span className="text-sm">Show customer mobile on documents</span>
 <Switch checked={form.show_customer_mobile_on_docs} onCheckedChange={v => setForm({...form, show_customer_mobile_on_docs: v})} />
 </label>
 <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
 <span className="text-sm">Show customer phone on documents</span>
 <Switch checked={form.show_customer_phone_on_docs} onCheckedChange={v => setForm({...form, show_customer_phone_on_docs: v})} />
 </label>
 <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
 <span className="text-sm">Show supplier mobile on documents</span>
 <Switch checked={form.show_supplier_mobile_on_docs} onCheckedChange={v => setForm({...form, show_supplier_mobile_on_docs: v})} />
 </label>
 <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
 <span className="text-sm">Show supplier phone on documents</span>
 <Switch checked={form.show_supplier_phone_on_docs} onCheckedChange={v => setForm({...form, show_supplier_phone_on_docs: v})} />
 </label>
                </div>

                  <div className="pt-2 space-y-3 border-t border-border mt-2">
                    <div>
                      <p className="font-medium text-sm">Document Print Size</p>
                      <p className="text-xs text-muted-foreground">Applies to Sales/Purchase Orders, Invoices, Delivery Notes, Returns, Warranty Notes and Payment Receipts.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {([
                        { v: "half" as const, label: "Half A4", hint: "Top half of A4, lower half blank" },
                        { v: "auto" as const, label: "Auto (Default)", hint: "≤5 items → Half · >5 items → Full" },
                        { v: "full" as const, label: "Full A4", hint: "Traditional full-page layout" },
                      ]).map(o => (
                        <label key={o.v} className={`flex flex-col gap-1 rounded-md border p-3 cursor-pointer transition-colors ${form.document_page_mode === o.v ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"}`}>
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="document_page_mode"
                              value={o.v}
                              checked={form.document_page_mode === o.v}
                              onChange={() => setForm({ ...form, document_page_mode: o.v })}
                            />
                            <span className="text-sm font-medium">{o.label}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground pl-5">{o.hint}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                 <div className="pt-2 space-y-4 border-t border-border mt-2">
                   <div className="flex items-center justify-between">
                     <div>
                       <p className="font-medium text-sm">Warranty Declaration</p>
                       <p className="text-xs text-muted-foreground">Legal paragraph printed on every Warranty Note. Editable below.</p>
                     </div>
                     <Switch
                       checked={form.warranty_declaration_enabled}
                       onCheckedChange={v => setForm({ ...form, warranty_declaration_enabled: v })}
                     />
                   </div>

                   {form.warranty_declaration_enabled && (
                     <div className="space-y-2">
                       <Textarea
                         rows={10}
                         value={form.warranty_note_text}
                         onChange={e => setForm({ ...form, warranty_note_text: e.target.value })}
                         placeholder={WARRANTY_NOTE_TEXT}
                         className="text-xs leading-relaxed font-mono"
                       />
                       <div className="text-[11px] text-muted-foreground space-y-1">
                         <p>Use blank lines to separate paragraphs. Lines beginning with <code>1.</code> <code>2.</code> render as hanging-indent numbered points. Leave empty to use the default template.</p>
                         <p className="font-medium text-foreground mt-2">Available tokens:</p>
                         <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                           <code>{"{{sales_rep_name}}"}</code>
                           <code>{"{{father_name}}"}</code>
                           <code>{"{{relation}}"}</code>
                           <code>{"{{sales_rep_cnic}}"}</code>
                           <code>{"{{agent_license_number}}"}</code>
                           <code>{"{{agent_license_expiry}}"}</code>
                           <code>{"{{company_name}}"}</code>
                         </div>
                         <p>Tokens auto-fill from the Sales Rep selected on the warranty note.</p>
                       </div>
                     </div>
                   )}
                 </div>

                 <div className="pt-2 space-y-3 border-t border-border mt-2">
                   <div>
                     <p className="font-medium text-sm">Warranty Stamp & Signature</p>
                     <p className="text-xs text-muted-foreground">Printed at the bottom of every Warranty Note. Company stamp prints on the left, sales-rep signature on the right.</p>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="rounded-md border border-border p-3 space-y-2">
                       <Label>Company Stamp</Label>
                       <Input type="file" accept="image/*" onChange={async e => {
                         const f = e.target.files?.[0]; if (!f) return;
                         const url = await uploadWarrantyAsset(f, "stamp");
                         if (url) { setForm({ ...form, warranty_stamp_url: url }); toast.success("Stamp uploaded"); }
                       }} />
                       {form.warranty_stamp_url ? (
                         <div className="flex items-center justify-between gap-2">
                           <img src={form.warranty_stamp_url} alt="stamp" className="h-16 object-contain border border-border rounded bg-muted/30 p-1" />
                           <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => setForm({ ...form, warranty_stamp_url: "" })}>Remove</Button>
                         </div>
                       ) : <p className="text-[11px] text-muted-foreground">No stamp uploaded — printed area stays blank.</p>}
                     </div>
                     <div className="rounded-md border border-border p-3 space-y-2">
                       <Label>Default Signature (fallback)</Label>
                       <Input type="file" accept="image/*" onChange={async e => {
                         const f = e.target.files?.[0]; if (!f) return;
                         const url = await uploadWarrantyAsset(f, "signature");
                         if (url) { setForm({ ...form, warranty_signature_url: url }); toast.success("Signature uploaded"); }
                       }} />
                       {form.warranty_signature_url ? (
                         <div className="flex items-center justify-between gap-2">
                           <img src={form.warranty_signature_url} alt="signature" className="h-16 object-contain border border-border rounded bg-muted/30 p-1" />
                           <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => setForm({ ...form, warranty_signature_url: "" })}>Remove</Button>
                         </div>
                       ) : <p className="text-[11px] text-muted-foreground">Used only when the selected Sales Rep has no signature image.</p>}
                     </div>
                   </div>
                 </div>

                 <div className="pt-2 space-y-2 border-t border-border mt-2">
                   <Label>Warranty Note Footer Text</Label>
                   <Input
                     value={form.warranty_footer_text}
                     onChange={e => setForm({ ...form, warranty_footer_text: e.target.value })}
                     placeholder="This is a system generated invoice and does not require any signatures."
                   />
                   <p className="text-[11px] text-muted-foreground">Prints centred at the very bottom of every Warranty Note. Leave blank for the default.</p>
                 </div>



                 <div className="pt-2 space-y-3 border-t border-border mt-2">
                   <div>
                     <p className="font-medium text-sm">Warranty Required Fields</p>
                     <p className="text-xs text-muted-foreground">Block PDF download if any required field is missing.</p>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                     <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                       <span className="text-sm">Require customer mobile</span>
                       <Switch checked={form.warranty_require_mobile} onCheckedChange={v => setForm({...form, warranty_require_mobile: v})} />
                     </label>
                     <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                       <span className="text-sm">Require warranty address</span>
                       <Switch checked={form.warranty_require_address} onCheckedChange={v => setForm({...form, warranty_require_address: v})} />
                     </label>
                     <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                       <span className="text-sm">Require licence number</span>
                       <Switch checked={form.warranty_require_license_no} onCheckedChange={v => setForm({...form, warranty_require_license_no: v})} />
                     </label>
                     <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                       <span className="text-sm">Require licence expiry</span>
                       <Switch checked={form.warranty_require_license_expiry} onCheckedChange={v => setForm({...form, warranty_require_license_expiry: v})} />
                     </label>
                     <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                       <span className="text-sm">Require batch number</span>
                       <Switch checked={form.warranty_require_batch_number} onCheckedChange={v => setForm({...form, warranty_require_batch_number: v})} />
                     </label>
                     <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                       <span className="text-sm">Require batch expiry</span>
                       <Switch checked={form.warranty_require_batch_expiry} onCheckedChange={v => setForm({...form, warranty_require_batch_expiry: v})} />
                     </label>
                   </div>
                 </div>
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

 <TabsContent value="whatsapp" className="max-w-6xl">
 <WhatsAppTemplatesCard />
 </TabsContent>

 {tenantRole === "owner" && (
 <TabsContent value="team" className="max-w-2xl space-y-6">
 <TeamAccessCard />
 <SalesAgentScopeCard />
 </TabsContent>
 )}


 <TabsContent value="backup" className="max-w-2xl space-y-6">
 <Card className="glass-card">
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Database className="h-5 w-5 text-primary" /> Manual Backup
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-6">
 <div className="rounded-xl bg-muted/50 p-6 text-center">
 <Download className="h-12 w-12 text-primary mx-auto mb-4" />
 <h3 className="font-heading font-semibold text-lg text-foreground mb-2">Export All Data</h3>
 <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
 Download a complete backup of your data as an Excel file. Includes {BACKUP_TABLES.length} tables covering all business data.
 </p>
 <Button onClick={handleBackup} disabled={backupLoading} size="lg" className="px-8">
 <Download className="h-4 w-4 mr-2" />
 {backupLoading ? "Exporting..." : "Download Backup (.xlsx)"}
 </Button>
 {lastBackup && (
 <p className="text-xs text-muted-foreground mt-4">
 Last manual backup: {lastBackup}
 </p>
 )}
 </div>
 <div className="text-xs text-muted-foreground space-y-1">
 <p>• Backup includes {BACKUP_TABLES.length} data tables with all records</p>
 <p>• Each table is exported as a separate sheet in the Excel file</p>
 <p>• Data is filtered to your company only (tenant-isolated)</p>
 </div>
 </CardContent>
 </Card>

 <AutomatedBackupCard />

 <Card>
  <CardContent className="pt-6 flex items-center justify-between gap-4 flex-wrap">
   <div>
    <h3 className="font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Backups & Disaster Recovery</h3>
    <p className="text-sm text-muted-foreground mt-1">Owner-only page showing daily / weekly / monthly backup history, sizes, retention, and signed-URL downloads.</p>
   </div>
   <Button variant="outline" onClick={() => navigate("/settings/backups")}>Open Backups page</Button>
  </CardContent>
 </Card>

 <DangerZoneCard />
				</TabsContent>

				{tenantRole === "owner" && (
					<TabsContent value="testing">
						<SandboxTestingTab />
					</TabsContent>
				)}
				</Tabs>
 </div>
 </AppLayout>
 );
}

function DangerZoneCard() {
 const { tenantName } = useTenant();
 const [open, setOpen] = useState(false);
 const [confirm, setConfirm] = useState("");
 const [busy, setBusy] = useState(false);
 const [showEmpty, setShowEmpty] = useState(false);
 const [counts, setCounts] = useState<Record<string, number> | null>(null);
 const [previewError, setPreviewError] = useState<string | null>(null);
 const expected = `WIPE ${tenantName ?? ""}`;

 useEffect(() => {
  if (!open) { setConfirm(""); setCounts(null); setPreviewError(null); return; }
  (async () => {
   try {
    const { data, error } = await supabase.rpc("preview_wipe_counts" as never);
    if (error) throw error;
    setCounts((data ?? {}) as Record<string, number>);
   } catch (e: any) {
    setPreviewError(e.message ?? "Failed to load preview");
   }
  })();
 }, [open]);

 const rows = counts
  ? Object.entries(counts)
     .map(([table, count]) => ({ table, count: Number(count) || 0 }))
     .filter((r) => showEmpty || r.count > 0)
     .sort((a, b) => b.count - a.count || a.table.localeCompare(b.table))
  : [];
 const total = counts ? Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0) : 0;

 const handleWipe = async () => {
  if (confirm !== expected) { toast.error(`Type exactly: ${expected}`); return; }
  setBusy(true);
  try {
   const { data, error } = await supabase.rpc("wipe_my_tenant" as never, { confirm_text: confirm } as never);
   if (error) throw error;
   toast.success("Tenant data wiped. Reloading…");
   // eslint-disable-next-line no-console
   console.table((data as any)?.deleted ?? {});
   setTimeout(() => window.location.reload(), 1500);
  } catch (e: any) {
   toast.error(e.message ?? "Wipe failed");
   setBusy(false);
  }
 };

 return (
  <Card className="border-destructive/50">
   <CardHeader>
    <CardTitle className="text-destructive flex items-center gap-2">
     <Trash2 className="h-4 w-4" /> Danger Zone — Wipe Tenant Data
    </CardTitle>
   </CardHeader>
   <CardContent className="space-y-3">
    <p className="text-sm text-muted-foreground">
     Permanently deletes all invoices, payments, stock, customers, suppliers, products, banks,
     chart of accounts, document templates, and import history for <b>{tenantName}</b>.
     Keeps your login, workspace, team members, and existing backups.
     <br /><b>Take a manual backup first</b> from the Backups page.
    </p>
    <Button variant="destructive" onClick={() => setOpen(true)}>I understand — start wipe</Button>

    <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
     <AlertDialogContent className="max-w-2xl">
      <AlertDialogHeader>
       <AlertDialogTitle className="text-destructive flex items-center gap-2">
        <Trash2 className="h-4 w-4" /> Confirm wipe of {tenantName}
       </AlertDialogTitle>
       <AlertDialogDescription>
        Review every row that will be permanently deleted. This cannot be undone.
       </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="space-y-3">
       <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Data to be removed</div>
        <label className="text-xs text-muted-foreground flex items-center gap-2 cursor-pointer">
         <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
         Show empty tables
        </label>
       </div>
       <div className="max-h-72 overflow-auto rounded-md border">
        {previewError ? (
         <div className="p-3 text-sm text-destructive">{previewError}</div>
        ) : !counts ? (
         <div className="p-3 text-sm text-muted-foreground">Loading preview…</div>
        ) : rows.length === 0 ? (
         <div className="p-3 text-sm text-muted-foreground">No data to wipe.</div>
        ) : (
         <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
           <tr><th className="text-left px-3 py-1.5 font-medium">Table</th><th className="text-right px-3 py-1.5 font-medium">Rows</th></tr>
          </thead>
          <tbody>
           {rows.map((r) => (
            <tr key={r.table} className="border-t">
             <td className="px-3 py-1 font-mono text-xs">{r.table}</td>
             <td className="px-3 py-1 text-right tabular-nums">{r.count.toLocaleString()}</td>
            </tr>
           ))}
          </tbody>
          <tfoot>
           <tr className="border-t bg-muted/30 font-medium">
            <td className="px-3 py-1.5">Total</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{total.toLocaleString()}</td>
           </tr>
          </tfoot>
         </table>
        )}
       </div>

       <div className="text-xs text-muted-foreground rounded-md border p-2">
        <b>Kept intact:</b> your login, workspace, team members, role assignments, document number prefixes, and existing backup files.
       </div>

       <div className="space-y-2">
        <Label className="text-sm">
         Type <code className="px-1 bg-muted rounded">{expected}</code> to confirm
        </Label>
        <Input
         value={confirm}
         onChange={(e) => setConfirm(e.target.value)}
         placeholder={expected}
         autoFocus
         className={confirm && confirm !== expected ? "border-destructive" : ""}
        />
        {confirm && confirm !== expected && (
         <p className="text-xs text-destructive">Text does not match.</p>
        )}
       </div>
      </div>

      <AlertDialogFooter>
       <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
       <Button
        variant="destructive"
        disabled={busy || !counts || confirm !== expected}
        onClick={handleWipe}
       >
        {busy ? "Wiping…" : `Wipe ${total.toLocaleString()} rows now`}
       </Button>
      </AlertDialogFooter>
     </AlertDialogContent>
    </AlertDialog>
   </CardContent>
  </Card>
 );
}

function AutomatedBackupCard() {
 const [backups, setBackups] = useState<{ name: string; created_at: string }[]>([]);
 const [loading, setLoading] = useState(true);
 const [triggerLoading, setTriggerLoading] = useState(false);

 useEffect(() => { loadBackups(); }, []);

 const loadBackups = async () => {
 setLoading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { data: tu } = await (supabase as any).from("tenant_users").select("tenant_id").eq("user_id", user.id).eq("is_active", true).limit(1).single();
 if (!tu) return;
 const tenantId = tu.tenant_id;
 const { data: files } = await supabase.storage.from("tenant-backups").list(tenantId, { sortBy: { column: "created_at", order: "desc" }, limit: 10 });
 setBackups(files || []);
 } catch { /* ignore */ }
 setLoading(false);
 };

 const handleDownload = async (fileName: string) => {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;
 const { data: tu } = await (supabase as any).from("tenant_users").select("tenant_id").eq("user_id", user.id).eq("is_active", true).limit(1).single();
 if (!tu) return;
 const tenantId = tu.tenant_id;
 const { data, error } = await supabase.storage.from("tenant-backups").download(`${tenantId}/${fileName}`);
 if (error || !data) { toast.error("Download failed"); return; }
 const url = URL.createObjectURL(data);
 const a = document.createElement("a");
 a.href = url;
 a.download = fileName;
 a.click();
 URL.revokeObjectURL(url);
 toast.success("Backup downloaded");
 };

 const handleTriggerBackup = async () => {
 setTriggerLoading(true);
 try {
 const { error } = await supabase.functions.invoke("weekly-backup");
 if (error) throw error;
 toast.success("Automated backup triggered successfully!");
 await loadBackups();
 } catch (err: any) {
 toast.error("Backup failed: " + err.message);
 }
 setTriggerLoading(false);
 };

 return (
 <Card className="glass-card border-primary/20">
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Cloud className="h-5 w-5 text-primary" /> Automated Cloud Backups
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
 <div>
 <p className="font-medium text-sm text-foreground">Weekly Automated Backup</p>
 <p className="text-xs text-muted-foreground">Runs every Sunday at midnight · 1-month rolling retention</p>
 </div>
 <div className="flex items-center gap-2">
 <span className="inline-flex items-center gap-1 text-xs font-medium text-success dark:text-success">
 <span className="h-2 w-2 rounded-full bg-success/10 animate-pulse" /> Active
 </span>
 <Button size="sm" variant="outline" onClick={handleTriggerBackup} disabled={triggerLoading}>
 <RefreshCw className={`h-3 w-3 mr-1 ${triggerLoading ? "animate-spin" : ""}`} />
 {triggerLoading ? "Running..." : "Run Now"}
 </Button>
 </div>
 </div>

 <div>
 <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
 <Clock className="h-4 w-4" /> Backup History
 </h4>
 {loading ? (
 <p className="text-xs text-muted-foreground">Loading...</p>
 ) : backups.length === 0 ? (
 <p className="text-xs text-muted-foreground">No automated backups yet. Click "Run Now" to create the first one.</p>
 ) : (
 <div className="space-y-2">
 {backups.map((b) => (
 <div key={b.name} className="flex items-center justify-between p-3 rounded-lg border border-border">
 <div>
 <p className="text-sm font-medium text-foreground">{b.name.replace("backup_", "").replace(".json", "").replace(/-/g, " ").slice(0, 19)}</p>
 <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</p>
 </div>
 <Button size="sm" variant="ghost" onClick={() => handleDownload(b.name)}>
 <Download className="h-4 w-4" />
 </Button>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="text-xs text-muted-foreground space-y-1">
 <p>• Automated backups store all {BACKUP_TABLES.length} tables as JSON in secure cloud storage</p>
 <p>• Only the last 4 backups are retained (rolling 1-month window)</p>
 <p>• Each backup is isolated to your company data only</p>
 </div>
 </CardContent>
 </Card>
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

// ============= Team & Access (sub-users) =============

interface TenantMember {
 user_id: string;
 role: TenantRole;
 is_active: boolean;
 created_at: string;
 email?: string;
 last_sign_in_at?: string | null;
}


function TeamAccessCard() {
 const { tenantId } = useTenant();
 const [members, setMembers] = useState<TenantMember[]>([]);
 const [meId, setMeId] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [adding, setAdding] = useState(false);
 const [showForm, setShowForm] = useState(false);
 const [newEmail, setNewEmail] = useState("");
 const [newPassword, setNewPassword] = useState("");
 const [newRole, setNewRole] = useState<TenantRole>("sales_agent");
 const [resetFor, setResetFor] = useState<string | null>(null);
 const [resetPwd, setResetPwd] = useState("");
 const [resetting, setResetting] = useState(false);
 const [deleteFor, setDeleteFor] = useState<TenantMember | null>(null);
 const [deleteConfirm, setDeleteConfirm] = useState("");
 const [deleting, setDeleting] = useState(false);


 const load = async () => {
 if (!tenantId) return;
 setLoading(true);
 const { data: { user } } = await supabase.auth.getUser();
 setMeId(user?.id ?? null);

  // Try edge function first (uses service role, sees all tenant members)
  try {
    const { data: emailData, error: efErr } = await supabase.functions.invoke("manage-tenant", {
      body: { action: "list_tenant_users", tenant_id: tenantId },
    });
    if (!efErr && Array.isArray(emailData?.users)) {
      setMembers((emailData.users as any[]).map(u => ({
        user_id: u.user_id, role: u.role, is_active: u.is_active,
        created_at: u.created_at, email: u.email ?? undefined,
        last_sign_in_at: u.last_sign_in_at ?? null,
      })));
      setLoading(false);
      return;
    }

  } catch { /* fall through */ }

  // Fallback (non-owner): direct query, RLS limits to own row
  const { data } = await (supabase as any)
    .from("tenant_users")
    .select("user_id, role, is_active, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  setMembers((data || []) as TenantMember[]);
  setLoading(false);
 };

 useEffect(() => { load(); }, [tenantId]);

 const handleResetPassword = async (m: TenantMember) => {
 if (!tenantId) return;
 if (resetPwd.length < 6) { toast.error("Password must be at least 6 characters"); return; }
 setResetting(true);
 try {
   const { data, error } = await supabase.functions.invoke("manage-tenant", {
     body: {
       action: "owner_reset_password",
       tenant_id: tenantId,
       user_id: m.user_id,
       new_password: resetPwd,
     },
   });
   if (error) {
     let msg = error.message;
     try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch {}
     throw new Error(msg);
   }
   if (data?.error) throw new Error(data.error);
    toast.success("Password updated");
    void logAudit({ action: "member_password_reset", entity_type: "tenant_member", entity_id: m.user_id, entity_number: m.email ?? null });
    setResetFor(null); setResetPwd("");
 } catch (err: any) {
   toast.error(err.message);
 } finally {
   setResetting(false);
 }
 };


 const handleAdd = async () => {
 if (!tenantId) return;
 if (!newEmail.trim() || newPassword.length < 6) {
 toast.error("Email and a password of at least 6 characters are required");
 return;
 }
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-tenant", {
        body: {
          action: "owner_create_user",
          tenant_id: tenantId,
          email: newEmail.trim(),
          password: newPassword,
          role: newRole,
        },
      });
      // Surface real server-side error message (FunctionsHttpError hides body)
      if (error) {
        let serverMsg = error.message || "Could not create user";
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) serverMsg = body.error;
        } catch { /* ignore */ }
        throw new Error(serverMsg);
      }
      if (data?.error) throw new Error(data.error);
        toast.success(`${ROLE_LABEL[newRole]} user created`);
        void logAudit({
          action: "member_invited",
          entity_type: "tenant_member",
          entity_id: (data as any)?.user_id ?? null,
          entity_number: newEmail.trim(),
          changes: { role: newRole },
        });
        setNewEmail(""); setNewPassword(""); setNewRole("sales_agent"); setShowForm(false);
        await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  };


 const handleToggle = async (m: TenantMember) => {
 if (!tenantId) return;
 try {
 const { data, error } = await supabase.functions.invoke("manage-tenant", {
 body: {
 action: "toggle_user_active",
 tenant_id: tenantId,
 user_id: m.user_id,
 is_active: !m.is_active,
 },
 });
      if (error) {
        let serverMsg = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) serverMsg = body.error;
        } catch { /* ignore */ }
        throw new Error(serverMsg);
      }
      if (data?.error) throw new Error(data.error);
      toast.success(m.is_active ? "User deactivated" : "User reactivated");
      void logAudit({
        action: m.is_active ? "member_removed" : "member_reactivated",
        entity_type: "tenant_member",
        entity_id: m.user_id,
        entity_number: m.email ?? null,
        changes: { role: m.role },
      });
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

 const handleDelete = async () => {
   if (!tenantId || !deleteFor) return;
   if (deleteConfirm.trim().toLowerCase() !== (deleteFor.email ?? "").trim().toLowerCase()) {
     toast.error("Type the user's email to confirm");
     return;
   }
   setDeleting(true);
   try {
     const { data, error } = await supabase.functions.invoke("manage-tenant", {
       body: { action: "delete_tenant_user", tenant_id: tenantId, user_id: deleteFor.user_id },
     });
     if (error) {
       let serverMsg = error.message;
       let serverCode: string | null = null;
       try {
         const b = await (error as any).context?.json?.();
         if (b?.error) serverMsg = b.message || b.error;
         if (b?.error === "user_has_history") serverCode = "user_has_history";
       } catch {}
       if (serverCode === "user_has_history") {
         toast.error("User has business records. Deactivate them instead — history must stay intact.");
         setDeleteFor(null); setDeleteConfirm("");
         return;
       }
       throw new Error(serverMsg);
     }
     if (data?.error) throw new Error(data.error);
     toast.success("User deleted");
     void logAudit({
       action: "member_deleted",
       entity_type: "tenant_member",
       entity_id: deleteFor.user_id,
       entity_number: deleteFor.email ?? null,
       changes: { role: deleteFor.role },
     });
     setDeleteFor(null); setDeleteConfirm("");
     await load();
   } catch (err: any) {
     toast.error(err.message);
   } finally {
     setDeleting(false);
   }
 };




 return (
 <div className="space-y-6">
 <Card className="glass-card">
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Users className="h-5 w-5 text-primary" /> Team Members
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {loading ? (
 <p className="text-sm text-muted-foreground">Loading team…</p>
 ) : members.length === 0 ? (
 <p className="text-sm text-muted-foreground">No members yet.</p>
 ) : (
 <div className="space-y-2">
 {members.map((m) => (
 <div
 key={m.user_id}
 className="rounded-lg border border-border bg-card px-4 py-3"
 >
 <div className="flex items-center justify-between gap-3">
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-sm font-medium text-foreground truncate">
 {m.email || (m.user_id.slice(0, 8) + "…")}
 </span>
 {m.user_id === meId && (
   <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-primary/40 text-primary">You</span>
 )}
 <span
 className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
 m.role === "owner"
 ? "border-primary/40 text-primary"
 : "border-border text-muted-foreground"
 }`}
 >
 {ROLE_LABEL[m.role] ?? m.role}
 </span>
 {!m.is_active && (
 <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-destructive/40 text-destructive">
 Inactive
 </span>
 )}
 </div>
 <p className="text-xs text-muted-foreground mt-0.5">
 Joined {new Date(m.created_at).toLocaleDateString()}
 {m.last_sign_in_at
   ? ` · Last login ${new Date(m.last_sign_in_at).toLocaleDateString()}`
   : " · Never signed in"}
 </p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 {m.user_id !== meId && (
   <Button size="sm" variant="ghost" onClick={() => { setResetFor(resetFor === m.user_id ? null : m.user_id); setResetPwd(""); }}>
     Reset password
   </Button>
 )}
 {m.user_id !== meId && (() => {
 const activeAdmins = members.filter(x => x.role === "owner" && x.is_active).length;
 const isLastAdmin = m.role === "owner" && m.is_active && activeAdmins <= 1;
 return (
 <Button size="sm" variant="outline" disabled={isLastAdmin} onClick={() => handleToggle(m)} title={isLastAdmin ? "Cannot deactivate the last admin" : ""}>
 {m.is_active ? "Deactivate" : "Reactivate"}
 </Button>
 );
 })()}
 {m.user_id !== meId && (() => {
   const activeAdmins = members.filter(x => x.role === "owner" && x.is_active).length;
   const isLastAdmin = m.role === "owner" && activeAdmins <= 1;
   if (isLastAdmin) return null;
   return (
     <Button size="sm" variant="destructive" onClick={() => { setDeleteFor(m); setDeleteConfirm(""); }}>
       Delete
     </Button>
   );
 })()}

 </div>
 </div>
 {resetFor === m.user_id && (
   <div className="mt-3 flex items-end gap-2">
     <div className="flex-1">
       <Label className="text-xs">New password</Label>
       <Input type="text" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} placeholder="min. 6 characters" autoFocus />
     </div>
     <Button size="sm" onClick={() => handleResetPassword(m)} disabled={resetting || resetPwd.length < 6}>
       {resetting ? "Saving…" : "Save"}
     </Button>
     <Button size="sm" variant="ghost" onClick={() => { setResetFor(null); setResetPwd(""); }}>Cancel</Button>
   </div>
 )}
 </div>
 ))}

 </div>
 )}

 {!showForm ? (
 <Button onClick={() => setShowForm(true)} size="sm">
 <Plus className="h-4 w-4 mr-1" /> Add Team Member
 </Button>
 ) : (
 <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
 <div className="flex items-center gap-2 text-sm font-medium text-foreground">
 <ShieldCheck className="h-4 w-4 text-primary" /> New team member
 </div>
 <div>
 <Label className="text-xs">Role</Label>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 max-h-72 overflow-auto">
 {CREATABLE_ROLES.map((r) => (
 <button
 key={r}
 type="button"
 onClick={() => setNewRole(r)}
 className={`text-left rounded-md border px-3 py-2 transition-colors ${newRole === r ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
 >
 <div className="text-sm font-medium">{ROLE_LABEL[r]}</div>
 <div className="text-[11px] text-muted-foreground mt-0.5">{ROLE_DESCRIPTION[r]}</div>
 </button>
 ))}
 </div>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
 <Label className="text-xs">Email</Label>
 <Input
 type="email"
 value={newEmail}
 onChange={(e) => setNewEmail(e.target.value)}
 placeholder={`${newRole}@company.com`}
 />
 </div>
 <div>
 <Label className="text-xs">Temporary password</Label>
 <Input
 type="text"
 value={newPassword}
 onChange={(e) => setNewPassword(e.target.value)}
 placeholder="min. 6 characters"
 />
 </div>
 </div>
 <p className="text-xs text-muted-foreground">
 {ROLE_DESCRIPTION[newRole]} Workspace cap is enforced per plan.
 </p>
 <div className="flex gap-2">
 <Button size="sm" onClick={handleAdd} disabled={adding}>
 {adding ? "Creating…" : `Create ${ROLE_LABEL[newRole]}`}
 </Button>
 <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setNewEmail(""); setNewPassword(""); setNewRole("sales_agent"); }}>
 Cancel
 </Button>
 </div>
 </div>
 )}
 </CardContent>
 </Card>

 <AlertDialog open={!!deleteFor} onOpenChange={(v) => { if (!v) { setDeleteFor(null); setDeleteConfirm(""); } }}>
   <AlertDialogContent>
     <AlertDialogHeader>
       <AlertDialogTitle className="text-destructive">Delete user?</AlertDialogTitle>
       <AlertDialogDescription>
         Are you sure? This action may affect audit history. If this user has any business records,
         deletion will be refused and you should deactivate them instead.
         Type <strong>{deleteFor?.email ?? "their email"}</strong> below to confirm.
       </AlertDialogDescription>
     </AlertDialogHeader>
     <Input
       autoFocus
       value={deleteConfirm}
       onChange={(e) => setDeleteConfirm(e.target.value)}
       placeholder={deleteFor?.email ?? ""}
     />
     <AlertDialogFooter>
       <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
       <Button
         variant="destructive"
         disabled={deleting || deleteConfirm.trim().toLowerCase() !== (deleteFor?.email ?? "").trim().toLowerCase()}
         onClick={handleDelete}
       >
         {deleting ? "Deleting…" : "Delete user"}
       </Button>
     </AlertDialogFooter>
   </AlertDialogContent>
 </AlertDialog>
 </div>
 );
}

function SalesAgentScopeCard() {
  const { tenantId } = useTenant();
  const [scope, setScope] = useState<"all" | "assigned">("all");
  const [assignmentCount, setAssignmentCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data: cs } = await (supabase as any).from("company_settings")
      .select("sales_agent_scope").eq("tenant_id", tenantId).maybeSingle();
    const { count } = await (supabase as any).from("agent_customers")
      .select("agent_id", { count: "exact", head: true }).eq("tenant_id", tenantId);
    setScope((cs?.sales_agent_scope as any) ?? "all");
    setAssignmentCount(count ?? 0);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [tenantId]);

  const save = async (next: "all" | "assigned") => {
    if (!tenantId) return;
    setSaving(true);
    const { error } = await (supabase as any).from("company_settings")
      .update({ sales_agent_scope: next }).eq("tenant_id", tenantId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setScope(next);
    toast.success("Sales agent scope updated");
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg">Sales Agent Customer Scope</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Controls which customers a Sales Agent can see, edit and sell to. You currently have{" "}
              <strong>{assignmentCount}</strong> agent-customer assignment{assignmentCount === 1 ? "" : "s"}.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => save("all")}
                className={`text-left rounded-md border px-3 py-2 transition-colors ${scope === "all" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
              >
                <div className="text-sm font-medium">All customers</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Every sales agent sees every customer in the workspace. Recommended when you haven't set up assignments yet.
                </div>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => save("assigned")}
                className={`text-left rounded-md border px-3 py-2 transition-colors ${scope === "assigned" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
              >
                <div className="text-sm font-medium">Assigned customers only</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Each agent only sees customers explicitly assigned to them on the Sales Agents page.
                </div>
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}


