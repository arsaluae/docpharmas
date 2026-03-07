import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Building2, Users, Power, UserPlus, Shield } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

interface Tenant {
  id: string;
  company_name: string;
  owner_email: string | null;
  phone: string | null;
  plan: string | null;
  setup_paid: boolean;
  is_active: boolean;
  max_users: number;
  created_at: string;
}

interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const emptyTenantForm = { company_name: "", owner_email: "", phone: "", plan: "monthly" };
const emptyUserForm = { email: "", password: "", role: "owner" };

export default function AdminPanel() {
  const { isAdmin, loading: tenantLoading } = useTenant();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantUsers, setTenantUsers] = useState<Record<string, TenantUser[]>>({});
  const [tenantForm, setTenantForm] = useState(emptyTenantForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (isAdmin) loadTenants(); }, [isAdmin]);

  if (tenantLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  async function loadTenants() {
    const { data } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });
    setTenants(data || []);

    // Load users for each tenant
    if (data) {
      const usersMap: Record<string, TenantUser[]> = {};
      for (const t of data) {
        const { data: users } = await supabase.from("tenant_users").select("*").eq("tenant_id", t.id);
        usersMap[t.id] = users || [];
      }
      setTenantUsers(usersMap);
    }
  }

  async function createTenant() {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("tenants").insert({
        company_name: tenantForm.company_name,
        owner_email: tenantForm.owner_email || null,
        phone: tenantForm.phone || null,
        plan: tenantForm.plan,
      });
      if (error) throw error;
      toast.success("Tenant created!");
      setDialogOpen(false);
      setTenantForm(emptyTenantForm);
      loadTenants();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function createTenantUser() {
    if (!selectedTenantId) return;
    setSubmitting(true);
    try {
      // Call edge function to create auth user + tenant_user
      const { data, error } = await supabase.functions.invoke("manage-tenant", {
        body: {
          action: "create_user",
          tenant_id: selectedTenantId,
          email: userForm.email,
          password: userForm.password,
          role: userForm.role,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("User created and linked to tenant!");
      setUserDialogOpen(false);
      setUserForm(emptyUserForm);
      loadTenants();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleTenant(id: string, active: boolean) {
    const { error } = await supabase.from("tenants").update({ is_active: active }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(active ? "Tenant activated" : "Tenant deactivated"); loadTenants(); }
  }

  return (
    <AppLayout title="Admin Panel" subtitle="Manage all client tenants"
      headerActions={
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/10 text-primary">
            <Shield className="h-3 w-3 mr-1" /> Super Admin
          </Badge>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10"><Building2 className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold font-heading">{tenants.length}</p>
                <p className="text-xs text-muted-foreground">Total Tenants</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10"><Power className="h-5 w-5 text-emerald-500" /></div>
              <div>
                <p className="text-2xl font-bold font-heading">{tenants.filter(t => t.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-500/10"><Users className="h-5 w-5 text-violet-500" /></div>
              <div>
                <p className="text-2xl font-bold font-heading">{Object.values(tenantUsers).flat().length}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenant List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-heading flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Client Tenants
            </CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Tenant</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create New Tenant</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div><Label>Company Name *</Label><Input value={tenantForm.company_name} onChange={e => setTenantForm(p => ({ ...p, company_name: e.target.value }))} /></div>
                  <div><Label>Owner Email</Label><Input type="email" value={tenantForm.owner_email} onChange={e => setTenantForm(p => ({ ...p, owner_email: e.target.value }))} /></div>
                  <div><Label>Phone</Label><Input value={tenantForm.phone} onChange={e => setTenantForm(p => ({ ...p, phone: e.target.value }))} /></div>
                  <div><Label>Plan</Label>
                    <Select value={tenantForm.plan} onValueChange={v => setTenantForm(p => ({ ...p, plan: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly - PKR 5,000/mo</SelectItem>
                        <SelectItem value="yearly">Yearly - PKR 45,000/yr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={createTenant} disabled={submitting || !tenantForm.company_name} className="w-full">
                    {submitting ? "Creating..." : "Create Tenant"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.company_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.owner_email || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs capitalize">{t.plan}</Badge></TableCell>
                    <TableCell>
                      <span className="text-sm">{(tenantUsers[t.id] || []).length}/{t.max_users}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={t.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}>
                        {t.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => { setSelectedTenantId(t.id); setUserDialogOpen(true); }}>
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleTenant(t.id, !t.is_active)}>
                        <Power className={`h-4 w-4 ${t.is_active ? "text-destructive" : "text-emerald-500"}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {tenants.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No tenants yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>

            {/* Show users under each tenant */}
            {tenants.map(t => (tenantUsers[t.id] || []).length > 0 && (
              <div key={t.id} className="mt-4 pl-4 border-l-2 border-primary/20">
                <p className="text-xs font-semibold text-muted-foreground mb-2">{t.company_name} Users:</p>
                {(tenantUsers[t.id] || []).map(u => (
                  <div key={u.id} className="flex items-center gap-3 py-1">
                    <Badge variant="outline" className="text-[10px] capitalize">{u.role}</Badge>
                    <span className="text-xs text-muted-foreground">User ID: {u.user_id.slice(0, 8)}...</span>
                    <Badge className={u.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"} variant="outline">
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Create User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add User to Tenant</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Email *</Label><Input type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Password *</Label><Input type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} minLength={6} /></div>
            <div><Label>Role</Label>
              <Select value={userForm.role} onValueChange={v => setUserForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner (Full Access)</SelectItem>
                  <SelectItem value="staff">Staff (Sales Only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createTenantUser} disabled={submitting || !userForm.email || !userForm.password} className="w-full">
              {submitting ? "Creating..." : "Create User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
