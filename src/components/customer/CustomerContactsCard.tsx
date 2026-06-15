import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, X, Edit, Star, Phone } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  customer_id: string;
  contact_name: string;
  designation: string | null;
  mobile: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
}

interface Props {
  customerId: string;
}

const emptyForm = { contact_name: "", designation: "", mobile: "", phone: "", email: "" };

export function CustomerContactsCard({ customerId }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [customerId]);

  async function load() {
    const { data } = await supabase
      .from("customer_contacts" as any)
      .select("*")
      .eq("customer_id", customerId)
      .order("is_primary", { ascending: false })
      .order("contact_name", { ascending: true });
    setContacts(((data ?? []) as unknown) as Contact[]);
  }

  /**
   * Mirror a contact's details onto the customer record (fill-blanks-only).
   * Called whenever a contact becomes primary or is the first contact added.
   */
  async function syncToCustomer(c: { contact_name: string; mobile: string | null; phone: string | null; email: string | null }) {
    const { data: cust } = await supabase
      .from("customers")
      .select("contact_person, sms_mobile, phone, email")
      .eq("id", customerId)
      .single();
    if (!cust) return;
    const payload: Record<string, string> = {};
    const fill = (key: "contact_person" | "sms_mobile" | "phone" | "email", value: string | null) => {
      if (!value) return;
      const current = (cust as any)[key];
      if (!current || !String(current).trim()) payload[key] = value;
    };
    fill("contact_person", c.contact_name);
    fill("sms_mobile", c.mobile);
    fill("phone", c.phone || c.mobile);
    fill("email", c.email);
    if (Object.keys(payload).length) {
      await supabase.from("customers").update(payload as any).eq("id", customerId);
    }
  }

  async function save() {
    if (!form.contact_name.trim()) { toast.error("Name is required"); return; }
    const payload: any = {
      customer_id: customerId,
      contact_name: form.contact_name.trim(),
      designation: form.designation || null,
      mobile: form.mobile || null,
      phone: form.phone || null,
      email: form.email || null,
    };
    if (editId) {
      const { error } = await supabase.from("customer_contacts" as any).update(payload).eq("id", editId);
      if (error) { toast.error(error.message); return; }
      // If the edited contact is the primary one, keep customer record in sync.
      const edited = contacts.find(c => c.id === editId);
      if (edited?.is_primary) {
        await syncToCustomer({
          contact_name: payload.contact_name,
          mobile: payload.mobile,
          phone: payload.phone,
          email: payload.email,
        });
      }
      toast.success("Contact updated");
    } else {
      // First contact for this customer becomes primary automatically.
      const isPrimary = contacts.length === 0;
      payload.is_primary = isPrimary;
      const { error } = await supabase.from("customer_contacts" as any).insert(payload);
      if (error) { toast.error(error.message); return; }
      if (isPrimary) {
        await syncToCustomer({
          contact_name: payload.contact_name,
          mobile: payload.mobile,
          phone: payload.phone,
          email: payload.email,
        });
      }
      toast.success("Contact added");
    }
    setShowForm(false); setEditId(null); setForm(emptyForm);
    load();
  }

  async function makePrimary(id: string) {
    // Clear any other primary first to satisfy the unique index.
    const others = contacts.filter(c => c.is_primary && c.id !== id);
    for (const o of others) {
      await supabase.from("customer_contacts" as any).update({ is_primary: false }).eq("id", o.id);
    }
    const { error } = await supabase.from("customer_contacts" as any).update({ is_primary: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    const c = contacts.find(x => x.id === id);
    if (c) {
      await syncToCustomer({
        contact_name: c.contact_name,
        mobile: c.mobile,
        phone: c.phone,
        email: c.email,
      });
    }
    toast.success("Primary contact updated · customer record synced");
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("customer_contacts" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Contact removed");
    load();
  }

  function startEdit(c: Contact) {
    setEditId(c.id);
    setForm({
      contact_name: c.contact_name,
      designation: c.designation ?? "",
      mobile: c.mobile ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
    });
    setShowForm(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Phone className="h-4 w-4" /> Contact Persons ({contacts.length})
        </h4>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        )}
      </div>

      {showForm && (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/30 mb-3">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium">{editId ? "Edit" : "New"} contact</p>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setShowForm(false); setEditId(null); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Name *</Label><Input className="text-xs" value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
            <div><Label className="text-xs">Designation</Label><Input className="text-xs" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} /></div>
            <div><Label className="text-xs">Mobile</Label><Input className="text-xs" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></div>
            <div><Label className="text-xs">Phone</Label><Input className="text-xs" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="col-span-2"><Label className="text-xs">Email</Label><Input className="text-xs" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <Button size="sm" onClick={save} className="w-full">{editId ? "Update" : "Add"} contact</Button>
        </div>
      )}

      {contacts.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Designation</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map(c => (
              <TableRow key={c.id}>
                <TableCell className="text-sm font-medium">
                  <div className="flex items-center gap-1.5">
                    {c.is_primary && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                    {c.contact_name}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{c.designation || "—"}</TableCell>
                <TableCell className="text-xs font-mono">{c.mobile || "—"}</TableCell>
                <TableCell className="text-xs">{c.email || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    {!c.is_primary && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Set as primary" onClick={() => makePrimary(c.id)}>
                        <Star className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(c)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">No contacts added yet.</p>
      )}
    </div>
  );
}
