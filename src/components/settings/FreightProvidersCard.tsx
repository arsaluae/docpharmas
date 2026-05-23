import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Truck, Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFreightProviders } from "@/hooks/useFreightProviders";
import { toast } from "sonner";

export function FreightProvidersCard() {
 const { providers, reload, loading } = useFreightProviders(true);
 const [name, setName] = useState("");
 const [code, setCode] = useState("");
 const [saving, setSaving] = useState(false);

 const add = async () => {
 if (!name.trim() || !code.trim()) {
 toast.error("Name and code required");
 return;
 }
 setSaving(true);
 const { error } = await supabase.from("freight_providers" as any).insert({
 name: name.trim(),
 code: code.trim().toUpperCase(),
 is_active: true,
 } as any);
 setSaving(false);
 if (error) return toast.error("Failed: " + error.message);
 toast.success("Courier added");
 setName(""); setCode("");
 reload();
 };

 const toggle = async (id: string, is_active: boolean) => {
 const { error } = await supabase.from("freight_providers" as any).update({ is_active } as any).eq("id", id);
 if (error) return toast.error(error.message);
 reload();
 };

 const remove = async (id: string) => {
 if (!confirm("Remove this courier? Existing delivery notes will keep the label.")) return;
 const { error } = await supabase.from("freight_providers" as any).delete().eq("id", id);
 if (error) return toast.error(error.message);
 toast.success("Removed");
 reload();
 };

 return (
 <Card className="glass-card border-border">
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Truck className="h-4 w-4 text-primary" /> Couriers / Freight Providers
 </CardTitle>
 <p className="text-xs text-muted-foreground mt-1">
 Manage the dispatch options shown when confirming a Sales Order.
 </p>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2 items-end">
 <div>
 <Label className="text-xs text-muted-foreground">Name</Label>
 <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. TCS, Leopards…" />
 </div>
 <div>
 <Label className="text-xs text-muted-foreground">Code</Label>
 <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="TCS" maxLength={12} />
 </div>
 <Button onClick={add} disabled={saving} className="gap-1">
 {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
 </Button>
 </div>

 <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
 {loading ? (
 <div className="p-4 text-sm text-muted-foreground">Loading…</div>
 ) : providers.length === 0 ? (
 <div className="p-4 text-sm text-muted-foreground">No couriers yet.</div>
 ) : providers.map(p => (
 <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30">
 <div className="flex items-center gap-3">
 <Badge variant="outline" className="font-mono text-[10px]">{p.code}</Badge>
 <span className="text-sm font-medium">{p.name}</span>
 {!p.is_active && <span className="text-[10px] text-muted-foreground">(disabled)</span>}
 </div>
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-2">
 <span className="text-[10px] text-muted-foreground">Active</span>
 <Switch checked={p.is_active} onCheckedChange={v => toggle(p.id, v)} />
 </div>
 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(p.id)}>
 <Trash2 className="h-3.5 w-3.5 text-destructive" />
 </Button>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 );
}
