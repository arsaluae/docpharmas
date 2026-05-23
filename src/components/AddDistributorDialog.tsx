import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customerId: string;
  onCreated: (newId: string) => void;
}

/** Lightweight inline dialog to add a distributor to a customer from within Warranty Invoice flow. */
export function AddDistributorDialog({ open, onOpenChange, customerId, onCreated }: Props) {
  const [form, setForm] = useState({ name: "", phone: "", license_number: "", license_expiry: "", address: "" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!customerId) { toast.error("Select a customer first"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("customer_distributors").insert({
      customer_id: customerId,
      name: form.name.trim(),
      phone: form.phone || null,
      license_number: form.license_number || null,
      license_expiry: form.license_expiry || null,
      address: form.address || null,
    }).select("id").single();
    setSaving(false);
    if (error || !data) { toast.error(error?.message || "Failed to add"); return; }
    toast.success(`Distributor "${form.name}" added`);
    onCreated(data.id);
    setForm({ name: "", phone: "", license_number: "", license_expiry: "", address: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add Distributor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus placeholder="Distributor / Pharmacy name" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label className="text-xs">License #</Label><Input value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs">License Expiry</Label><Input type="date" value={form.license_expiry} onChange={e => setForm({ ...form, license_expiry: e.target.value })} /></div>
          <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add Distributor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
