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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, Users, Power, UserPlus, Shield, CreditCard, CheckCircle, XCircle, Clock, Image, UserCheck } from "lucide-react";
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
  subscription_status: string | null;
  subscription_ends_at: string | null;
}

interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface PaymentSubmission {
  id: string;
  tenant_id: string;
  submitted_by: string;
  amount: number;
  plan: string;
  screenshot_url: string;
  status: string;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface PendingSignup {
  id: string;
  user_id: string;
  email: string;
  company_name: string;
  phone: string | null;
  status: string;
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
  const [payments, setPayments] = useState<PaymentSubmission[]>([]);
  const [pendingSignups, setPendingSignups] = useState<PendingSignup[]>([]);
  const [rejectNotes, setRejectNotes] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      loadTenants();
      loadPayments();
      loadPendingSignups();
    }
  }, [isAdmin]);

  if (tenantLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  async function loadTenants() {
    const { data } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });
    setTenants((data as any) || []);
    
    // Single query for all tenant users (fixes N+1)
    const { data: allUsers } = await supabase.from("tenant_users").select("*");
    const usersMap: Record<string, TenantUser[]> = {};
    (allUsers || []).forEach((u: any) => {
      if (!usersMap[u.tenant_id]) usersMap[u.tenant_id] = [];
      usersMap[u.tenant_id].push(u);
    });
    setTenantUsers(usersMap);
  }

  async function loadPayments() {
    const { data } = await supabase
      .from("payment_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    setPayments((data as any) || []);
  }

  async function loadPendingSignups() {
    const { data } = await supabase
      .from("pending_signups")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false }) as any;
    setPendingSignups(data || []);
  }

  async function createTenant() {
    setSubmitting(true);
    try {
      const { data: newTenant, error } = await supabase.from("tenants").insert({
        company_name: tenantForm.company_name,
        owner_email: tenantForm.owner_email || null,
        phone: tenantForm.phone || null,
        plan: tenantForm.plan,
      }).select().single();
      if (error) throw error;
      
      // Seed document counters + company settings
      if (newTenant) {
        await supabase.functions.invoke("manage-tenant", {
          body: { action: "seed_tenant", tenant_id: newTenant.id },
        });
      }
      
      toast.success("Tenant created with all defaults!");
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
      const { data, error } = await supabase.functions.invoke("manage-tenant", {
        body: { action: "create_user", tenant_id: selectedTenantId, email: userForm.email, password: userForm.password, role: userForm.role },
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

  async function handlePaymentAction(submissionId: string, action: "approve" | "reject", plan?: string) {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", {
        body: { action, submission_id: submissionId, plan, admin_notes: action === "reject" ? rejectNotes : undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(action === "approve" ? "Payment approved & subscription extended!" : "Payment rejected");
      setRejectNotes("");
      loadPayments();
      loadTenants();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function extendSubscription(tenantId: string, days: number) {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-subscription", {
        body: { action: "extend", tenant_id: tenantId, days },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Subscription extended by ${days} days!`);
      loadTenants();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignupAction(signupId: string, action: "approve" | "reject") {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-tenant", {
        body: { 
          action: action === "approve" ? "approve_signup" : "reject_signup", 
          signup_id: signupId,
          admin_notes: action === "reject" ? rejectNotes : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(action === "approve" ? "Signup approved! Tenant created with all defaults." : "Signup rejected");
      setRejectNotes("");
      loadPendingSignups();
      loadTenants();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function viewScreenshot(url: string) {
    // Use signed URL for private bucket
    const path = url.split("/payment-screenshots/")[1];
    if (path) {
      const { data } = await supabase.storage.from("payment-screenshots").createSignedUrl(path, 300);
      setScreenshotUrl(data?.signedUrl || url);
    } else {
      setScreenshotUrl(url);
    }
  }

  const tenantMap: Record<string, string> = {};
  tenants.forEach(t => { tenantMap[t.id] = t.company_name; });

  const pendingPayments = payments.filter(p => p.status === "pending");

  return (
    <AppLayout title="Admin Panel" subtitle="Manage all client tenants"
      headerActions={
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/10 text-primary">
            <Shield className="h-3 w-3 mr-1" /> Super Admin
          </Badge>
          {pendingSignups.length > 0 && (
            <Badge className="bg-blue-500/10 text-blue-600">
              {pendingSignups.length} signups
            </Badge>
          )}
          {pendingPayments.length > 0 && (
            <Badge className="bg-amber-500/10 text-amber-600">
              {pendingPayments.length} payments
            </Badge>
          )}
        </div>
      }
    >
      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="signups" className="relative">
            Signups
            {pendingSignups.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-blue-500 text-white">
                {pendingSignups.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments" className="relative">
            Payments
            {pendingPayments.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                {pendingPayments.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-6">
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
                    <TableHead>Subscription</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map(t => {
                    const endDate = t.subscription_ends_at ? new Date(t.subscription_ends_at) : null;
                    const isExpired = endDate ? endDate < new Date() : false;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.company_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.owner_email || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs capitalize">{t.plan}</Badge></TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <Badge className={
                              t.subscription_status === "active" ? "bg-emerald-500/10 text-emerald-600" :
                              isExpired ? "bg-destructive/10 text-destructive" :
                              "bg-amber-500/10 text-amber-600"
                            }>
                              {isExpired ? "expired" : t.subscription_status || "trial"}
                            </Badge>
                            {endDate && (
                              <p className="text-muted-foreground mt-0.5">{endDate.toLocaleDateString()}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{(tenantUsers[t.id] || []).length}/{t.max_users}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={t.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}>
                            {t.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => extendSubscription(t.id, 30)} title="Extend 30 days">
                            +30d
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => extendSubscription(t.id, 365)} title="Extend 1 year">
                            +1yr
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedTenantId(t.id); setUserDialogOpen(true); }}>
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleTenant(t.id, !t.is_active)}>
                            <Power className={`h-4 w-4 ${t.is_active ? "text-destructive" : "text-emerald-500"}`} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {tenants.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No tenants yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>

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
        </TabsContent>

        {/* Pending Signups Tab */}
        <TabsContent value="signups" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" /> Pending Signups
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingSignups.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No pending signups</p>
              ) : (
                <div className="space-y-3">
                  {pendingSignups.map(s => (
                    <div key={s.id} className="p-4 rounded-lg border border-border bg-card space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{s.company_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.email} {s.phone ? `• ${s.phone}` : ""} • {new Date(s.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className="bg-amber-500/10 text-amber-600">
                          <Clock className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleSignupAction(s.id, "approve")} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                          <CheckCircle className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Input placeholder="Reject reason..." value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} className="flex-1 h-8 text-xs" />
                        <Button size="sm" variant="destructive" onClick={() => handleSignupAction(s.id, "reject")} disabled={submitting}>
                          <XCircle className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Payment Submissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No payment submissions yet</p>
              ) : (
                <div className="space-y-3">
                  {payments.map(p => (
                    <div key={p.id} className="p-4 rounded-lg border border-border bg-card space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{tenantMap[p.tenant_id] || p.tenant_id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">
                            PKR {Number(p.amount).toLocaleString()} — {p.plan} — {new Date(p.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className={
                          p.status === "approved" ? "bg-emerald-500/10 text-emerald-600" :
                          p.status === "rejected" ? "bg-destructive/10 text-destructive" :
                          "bg-amber-500/10 text-amber-600"
                        }>
                          {p.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {p.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                          {p.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                          {p.status}
                        </Badge>
                      </div>

                      {/* Screenshot preview - uses signed URL */}
                      <Button size="sm" variant="outline" onClick={() => viewScreenshot(p.screenshot_url)} className="text-xs">
                        <Image className="h-3 w-3 mr-1" /> View Screenshot
                      </Button>

                      {p.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => handlePaymentAction(p.id, "approve", p.plan)} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                            <CheckCircle className="h-3 w-3 mr-1" /> Approve
                          </Button>
                          <Input placeholder="Reject reason..." value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} className="flex-1 h-8 text-xs" />
                          <Button size="sm" variant="destructive" onClick={() => handlePaymentAction(p.id, "reject")} disabled={submitting}>
                            <XCircle className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                      {p.admin_notes && <p className="text-xs text-destructive">Note: {p.admin_notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Screenshot Preview Dialog - uses signed URL */}
      <Dialog open={!!screenshotUrl} onOpenChange={() => setScreenshotUrl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Payment Screenshot</DialogTitle></DialogHeader>
          {screenshotUrl && (
            <img src={screenshotUrl} alt="Payment screenshot" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

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
