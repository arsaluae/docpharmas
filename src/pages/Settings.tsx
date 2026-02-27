import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Upload } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_name: "", address: "", phone: "", email: "", website: "",
    logo_url: "", fbr_enabled: false, ntn: "", strn: "",
  });

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check();
    loadSettings();
  }, [navigate]);

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
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    if (settingsId) {
      await supabase.from("company_settings").update(form as any).eq("id", settingsId);
    } else {
      const { data } = await supabase.from("company_settings").insert(form as any).select().single();
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Settings</h1>
              <p className="text-sm text-muted-foreground">Company profile, letterhead & FBR integration</p>
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save Settings"}
            </Button>
          </header>

          <div className="p-6 max-w-2xl space-y-6">
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

            <Card className="glass-card">
              <CardHeader><CardTitle className="text-lg">FBR Integration</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Enable FBR QR Code</p>
                    <p className="text-xs text-muted-foreground">When enabled, FBR QR column appears on sales invoices</p>
                  </div>
                  <Switch checked={form.fbr_enabled} onCheckedChange={v => setForm({...form, fbr_enabled: v})} />
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
