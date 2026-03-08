import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Landmark, Upload, Copy, Clock, CheckCircle, XCircle, AlertTriangle, Users, UserPlus, Calendar, Shield } from "lucide-react";
import { toast } from "sonner";

const BANK_DETAILS = {
  name: "Arslan Amir",
  bank: "Meezan Bank",
  account: "09020103209991",
};

export default function Subscription() {
  const { tenantId, tenantRole, subscriptionStatus, subscriptionEndsAt, daysRemaining } = useTenant();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [amount, setAmount] = useState("");
  const [plan, setPlan] = useState("monthly");
  const [file, setFile] = useState<File | null>(null);
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("staff");
  const [creating, setCreating] = useState(false);

  const isOwner = tenantRole === "owner";

  useEffect(() => {
    if (tenantId) {
      loadSubmissions();
      if (isOwner) loadTenantUsers();
    }
  }, [tenantId, isOwner]);

  const loadSubmissions = async () => {
    const { data } = await supabase
      .from("payment_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setSubmissions(data);
  };

  const loadTenantUsers = async () => {
    const { data } = await supabase
      .from("tenant_users")
      .select("*")
      .eq("tenant_id", tenantId!)
      .order("created_at", { ascending: true });
    if (data) setTenantUsers(data);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleSubmit = async () => {
    if (!file || !amount || !user || !tenantId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-screenshots")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("payment-screenshots")
        .getPublicUrl(path);

      const { error: insertError } = await supabase
        .from("payment_submissions")
        .insert({
          tenant_id: tenantId,
          submitted_by: user.id,
          amount: parseFloat(amount),
          plan,
          screenshot_url: urlData.publicUrl || path,
        });
      if (insertError) throw insertError;

      toast.success("Payment submitted for review!");
      setFile(null);
      setAmount("");
      loadSubmissions();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword || !tenantId) return;
    setCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const res = await supabase.functions.invoke("manage-tenant", {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          action: "create_user",
          tenant_id: tenantId,
          email: newEmail,
          password: newPassword,
          role: newRole,
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast.success("User created successfully!");
      setNewEmail("");
      setNewPassword("");
      setShowCreateUser(false);
      loadTenantUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleUserActive = async (userId: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("tenant_users")
      .update({ is_active: !currentActive })
      .eq("user_id", userId)
      .eq("tenant_id", tenantId!);
    if (error) toast.error(error.message);
    else {
      toast.success(`User ${!currentActive ? "activated" : "deactivated"}`);
      loadTenantUsers();
    }
  };

  const isExpired = subscriptionStatus === "expired";
  const isTrial = subscriptionStatus === "trial";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Status Banner */}
        <Card className={`border-l-4 ${isExpired ? "border-l-destructive" : isTrial ? "border-l-[hsl(262,83%,58%)]" : "border-l-[hsl(160,60%,45%)]"}`}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isExpired ? "bg-destructive/10" : isTrial ? "bg-[hsl(262,83%,58%)]/10" : "bg-[hsl(160,60%,45%)]/10"}`}>
              {isExpired ? <AlertTriangle className="h-6 w-6 text-destructive" /> :
                <Clock className={`h-6 w-6 ${isTrial ? "text-[hsl(262,83%,58%)]" : "text-[hsl(160,60%,45%)]"}`} />}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold font-heading">
                {isExpired ? "Subscription Expired" : isTrial ? "Free Trial" : "Active Subscription"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isExpired
                  ? "Your access has expired. Please make a payment to continue."
                  : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining — expires ${subscriptionEndsAt ? new Date(subscriptionEndsAt).toLocaleDateString() : ""}`}
              </p>
            </div>
            {subscriptionEndsAt && (
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{new Date(subscriptionEndsAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="payment" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="payment">Payment & Billing</TabsTrigger>
            {isOwner && <TabsTrigger value="users">User Management</TabsTrigger>}
          </TabsList>

          {/* PAYMENT TAB */}
          <TabsContent value="payment" className="space-y-6 mt-4">
            {/* Bank Details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-primary" /> Bank Transfer Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Transfer to the following account and upload the screenshot below:</p>
                {[
                  { label: "Account Holder", value: BANK_DETAILS.name },
                  { label: "Bank", value: BANK_DETAILS.bank },
                  { label: "Account Number", value: BANK_DETAILS.account },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="font-mono font-semibold text-foreground">{item.value}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(item.value)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-xs font-medium text-primary">Pricing</p>
                  <p className="text-sm text-foreground">Monthly: <strong>PKR 5,000/mo</strong> &nbsp;|&nbsp; Yearly: <strong>PKR 45,000/yr</strong></p>
                </div>
              </CardContent>
            </Card>

            {/* Upload Form */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <Upload className="h-4 w-4 text-primary" /> Upload Payment Screenshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Amount (PKR)</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" />
                </div>
                <div>
                  <Label>Plan</Label>
                  <Select value={plan} onValueChange={setPlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly - PKR 5,000</SelectItem>
                      <SelectItem value="yearly">Yearly - PKR 45,000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Screenshot</Label>
                  <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </div>
                <Button onClick={handleSubmit} disabled={uploading || !file || !amount} className="w-full">
                  {uploading ? "Uploading..." : "Submit Payment"}
                </Button>
              </CardContent>
            </Card>

            {/* Submission History */}
            {submissions.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-heading">Payment History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {submissions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                      <div>
                        <p className="text-sm font-medium">PKR {Number(s.amount).toLocaleString()} — {s.plan}</p>
                        <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
                        {s.admin_notes && <p className="text-xs text-destructive mt-1">{s.admin_notes}</p>}
                      </div>
                      <Badge className={
                        s.status === "approved" ? "bg-[hsl(160,60%,45%)]/10 text-[hsl(160,60%,45%)]" :
                        s.status === "rejected" ? "bg-destructive/10 text-destructive" :
                        "bg-[hsl(262,83%,58%)]/10 text-[hsl(262,83%,58%)]"
                      }>
                        {s.status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {s.status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
                        {s.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                        {s.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* USERS TAB — Owner only */}
          {isOwner && (
            <TabsContent value="users" className="space-y-6 mt-4">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-heading flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" /> Team Members
                  </CardTitle>
                  <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1">
                        <UserPlus className="h-4 w-4" /> Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New User</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-2">
                        <div>
                          <Label>Email</Label>
                          <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com" />
                        </div>
                        <div>
                          <Label>Password</Label>
                          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
                        </div>
                        <div>
                          <Label>Role</Label>
                          <Select value={newRole} onValueChange={setNewRole}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner (Full Access)</SelectItem>
                              <SelectItem value="staff">Staff (Sales Only)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleCreateUser} disabled={creating || !newEmail || !newPassword} className="w-full">
                          {creating ? "Creating..." : "Create User"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tenantUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                  ) : (
                    tenantUsers.map((tu) => (
                      <div key={tu.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tu.role === "owner" ? "bg-primary/10" : "bg-muted"}`}>
                            <Shield className={`h-4 w-4 ${tu.role === "owner" ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{tu.user_id.slice(0, 8)}...</p>
                            <p className="text-xs text-muted-foreground capitalize">{tu.role} • Joined {new Date(tu.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={tu.is_active ? "bg-[hsl(160,60%,45%)]/10 text-[hsl(160,60%,45%)]" : "bg-muted text-muted-foreground"}>
                            {tu.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {tu.user_id !== user?.id && (
                            <Button size="sm" variant="ghost" onClick={() => toggleUserActive(tu.user_id, tu.is_active)}>
                              {tu.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
