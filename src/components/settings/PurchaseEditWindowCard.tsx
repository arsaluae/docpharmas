import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function PurchaseEditWindowCard() {
  const [id, setId] = useState<string | null>(null);
  const [days, setDays] = useState("30");
  const [autoCost, setAutoCost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("company_settings").select("id, purchase_edit_window_days, purchase_edit_auto_update_cost").limit(1).single();
      if (data) {
        setId(data.id);
        setDays(String((data as any).purchase_edit_window_days ?? 30));
        setAutoCost(!!(data as any).purchase_edit_auto_update_cost);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!id) return;
    const n = Math.max(0, Math.min(365, Number(days) || 0));
    setSaving(true);
    const { error } = await (supabase as any).from("company_settings")
      .update({ purchase_edit_window_days: n, purchase_edit_auto_update_cost: autoCost })
      .eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg">Purchase Edit Window</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          How long a submitted purchase bill stays editable. Past this window, it locks and corrections require a Purchase Return or Adjustment.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <>
            <div className="flex items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pew-days" className="text-xs">Edit window (days)</Label>
                <Input id="pew-days" type="number" min={0} max={365} className="w-32"
                  value={days} onChange={(e) => setDays(e.target.value)} />
              </div>
              <div className="flex gap-1.5">
                {[7, 15, 30, 60].map(d => (
                  <Button key={d} variant={Number(days) === d ? "secondary" : "outline"} size="xs"
                    onClick={() => setDays(String(d))}>{d}d</Button>
                ))}
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 rounded border border-border p-3">
              <div>
                <p className="text-sm font-medium">Auto-update product purchase cost</p>
                <p className="text-xs text-muted-foreground mt-0.5">When a bill rate changes, update the product's purchase cost to the new rate.</p>
              </div>
              <Switch checked={autoCost} onCheckedChange={setAutoCost} />
            </div>
            <Button onClick={save} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
