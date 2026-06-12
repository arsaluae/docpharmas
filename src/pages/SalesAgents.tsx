import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, Trash2, Pencil, Users, UserPlus, BarChart3, Banknote, CheckCircle, LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { useTenant } from "@/hooks/useTenant";

interface SalesAgent {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; status: string; commission_type: string; commission_rate: number;
  user_id: string | null;
  father_name: string | null; cnic: string | null;
  license_number: string | null; license_expiry: string | null;
  signature_url: string | null; stamp_url: string | null;
}
interface AgentCustomer { id: string; agent_id: string; customer_id: string; }
interface Customer { id: string; name: string; company: string | null; }
interface TenantUser { user_id: string; email: string | null; role: string; is_active: boolean; }

export default function SalesAgents() {
  const [activeTab, setActiveTab] = useState("agents");
  const [agents, setAgents] = useState<SalesAgent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allocations, setAllocations] = useState<AgentCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilterAgents, setStatusFilterAgents] = useState("all");

  // Agent form
  const [agentOpen, setAgentOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [commType, setCommType] = useState("percentage");
  const [commRate, setCommRate] = useState("");
  const [agentStatus, setAgentStatus] = useState("active");
  const [linkedUserId, setLinkedUserId] = useState<string>("");
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { tenantId } = useTenant();

  // Invite-new-agent flow
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);

  // Allocation form
  const [allocAgent, setAllocAgent] = useState("");
  const [allocCustomers, setAllocCustomers] = useState<string[]>([]);
  const [allocSearch, setAllocSearch] = useState("");

  // Commission report
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [commissionData, setCommissionData] = useState<Array<{
    agent: SalesAgent; total_sales: number; commission: number; status: string; commission_id?: string;
  }>>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => { load(); }, [activeTab]);
  
  // Load commission data on mount AND when reportMonth changes
  useEffect(() => { 
    if (agents.length > 0) loadCommissionReport(); 
  }, [reportMonth, agents]);

  const load = async () => {
    const [agRes, custRes, allocRes] = await Promise.all([
      supabase.from("sales_agents").select("*").order("name"),
      supabase.from("customers").select("id, name, company"),
      supabase.from("agent_customers").select("*"),
    ]);
    if (agRes.data) setAgents(agRes.data as any);
    if (custRes.data) setCustomers(custRes.data as any);
    if (allocRes.data) setAllocations(allocRes.data as any);
    // Load tenant users for linking dropdown (owner-only edge function)
    if (tenantId) {
      try {
        const { data: tuRes } = await supabase.functions.invoke("manage-tenant", {
          body: { action: "list_tenant_users", tenant_id: tenantId },
        });
        if (tuRes?.users) setTenantUsers(tuRes.users);
      } catch { /* non-owner — ignore */ }
    }
  };

  // Agent CRUD
  const handleSaveAgent = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const payload: any = {
      name, phone: phone || null, email: email || null, address: address || null,
      commission_type: commType, commission_rate: Number(commRate) || 0,
      status: agentStatus,
      user_id: linkedUserId || null,
    };
    if (editId) {
      const { error } = await supabase.from("sales_agents").update(payload).eq("id", editId);
      if (error) { toast.error(error.message); return; }
      toast.success("Agent updated");
    } else {
      const { error } = await supabase.from("sales_agents").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Agent added");
    }
    resetForm(); load();
  };

  const handleEdit = (a: SalesAgent) => {
    setEditId(a.id); setName(a.name); setPhone(a.phone || ""); setEmail(a.email || "");
    setAddress(a.address || ""); setCommType(a.commission_type); setCommRate(String(a.commission_rate));
    setAgentStatus(a.status);
    setLinkedUserId(a.user_id || "");
    setAgentOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("sales_agents").delete().eq("id", deleteId);
    if (error) toast.error(error.message); else toast.success("Agent deleted");
    setDeleteId(null); load();
  };

  const resetForm = () => {
    setAgentOpen(false); setEditId(null); setName(""); setPhone(""); setEmail("");
    setAddress(""); setCommType("percentage"); setCommRate(""); setAgentStatus("active");
    setLinkedUserId("");
  };

  const handleInviteAgent = async () => {
    if (!inviteEmail || !invitePassword || invitePassword.length < 6 || !inviteName.trim()) {
      toast.error("Name, email and a password (min 6 chars) are required"); return;
    }
    if (!tenantId) { toast.error("Tenant not loaded"); return; }
    setInviteBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-tenant", {
        body: { action: "owner_create_user", tenant_id: tenantId, email: inviteEmail, password: invitePassword, role: "sales_agent" },
      });
      if (error || data?.error) { toast.error(error?.message || data?.error || "Failed to invite"); return; }
      const newUserId = data?.user_id;
      // Create the linked sales_agents row in the same step
      const { error: insErr } = await supabase.from("sales_agents").insert({
        name: inviteName, email: inviteEmail, user_id: newUserId, status: "active",
        commission_type: "percentage", commission_rate: 0,
      } as any);
      if (insErr) { toast.error(insErr.message); return; }
      toast.success(`Invited ${inviteName} and linked to ${inviteEmail}`);
      setInviteOpen(false); setInviteEmail(""); setInvitePassword(""); setInviteName("");
      load();
    } finally { setInviteBusy(false); }
  };

  // Allocation
  const handleAllocate = async () => {
    if (!allocAgent || allocCustomers.length === 0) { toast.error("Select agent and customers"); return; }
    for (const cid of allocCustomers) {
      await supabase.from("agent_customers").delete().eq("customer_id", cid);
    }
    const rows = allocCustomers.map(cid => ({ agent_id: allocAgent, customer_id: cid }));
    const { error } = await supabase.from("agent_customers").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${allocCustomers.length} customer(s) allocated`);
    setAllocCustomers([]); load();
  };

  const handleRemoveAlloc = async (id: string) => {
    await supabase.from("agent_customers").delete().eq("id", id);
    toast.success("Allocation removed"); load();
  };

  // Commission report
  const loadCommissionReport = async () => {
    setLoadingReport(true);
    const monthStart = `${reportMonth}-01`;
    const [y, m] = reportMonth.split("-").map(Number);
    const nextMonth = new Date(y, m, 1);
    const monthEnd = nextMonth.toISOString().split("T")[0];

    const { data: invoices } = await supabase.from("sales_invoices")
      .select("agent_id, total")
      .not("agent_id", "is", null)
      .gte("date", monthStart)
      .lt("date", monthEnd);

    const { data: existingComm } = await supabase.from("agent_commissions")
      .select("*").eq("month", reportMonth);

    const salesByAgent: Record<string, number> = {};
    (invoices || []).forEach((inv: any) => {
      salesByAgent[inv.agent_id] = (salesByAgent[inv.agent_id] || 0) + Number(inv.total);
    });

    const commMap = new Map((existingComm || []).map((c: any) => [c.agent_id, c]));

    const report = agents.map(agent => {
      const totalSales = salesByAgent[agent.id] || 0;
      const commission = agent.commission_type === "percentage"
        ? totalSales * agent.commission_rate / 100
        : totalSales > 0 ? agent.commission_rate : 0;
      const existing = commMap.get(agent.id) as any;
      return {
        agent, total_sales: totalSales, commission,
        status: existing?.status || "pending",
        commission_id: existing?.id,
      };
    }).filter(r => r.total_sales > 0 || r.commission_id);

    setCommissionData(report);
    setLoadingReport(false);
  };

  const issueCommission = async (agentId: string, totalSales: number, commission: number, agent: SalesAgent) => {
    // Duplicate check
    const { data: existing } = await supabase.from("agent_commissions")
      .select("id").eq("agent_id", agentId).eq("month", reportMonth).eq("status", "paid").limit(1);
    if (existing && existing.length > 0) {
      toast.error(`Commission already paid to ${agent.name} for ${reportMonth}`);
      return;
    }
    const { error } = await supabase.from("agent_commissions").insert({
      agent_id: agentId, month: reportMonth, total_sales: totalSales,
      commission_amount: commission, commission_type: agent.commission_type,
      commission_rate: agent.commission_rate, status: "paid",
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Commission PKR ${commission.toLocaleString()} issued to ${agent.name}`);
    loadCommissionReport();
  };

  const agentNameMap = new Map(agents.map(a => [a.id, a.name]));
  const customerNameMap = new Map(customers.map(c => [c.id, c.name]));
  const allocatedCustomerIds = new Set(allocations.map(a => a.customer_id));

  const filteredAgents = agents.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilterAgents === "all" || a.status === statusFilterAgents;
    return matchesSearch && matchesStatus;
  });

  const filteredAllocations = allocations.filter(a => {
    const q = search.toLowerCase();
    return (agentNameMap.get(a.agent_id) || "").toLowerCase().includes(q) ||
      (customerNameMap.get(a.customer_id) || "").toLowerCase().includes(q);
  });

  const filteredAllocCustomers = customers.filter(c => {
    if (!allocSearch) return true;
    const q = allocSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q);
  });

  const linkedUserIds = new Set(agents.map(a => a.user_id).filter(Boolean) as string[]);
  const linkableUsers = tenantUsers.filter(u =>
    u.is_active && (u.role === "sales_agent" || u.role === "staff") &&
    (!linkedUserIds.has(u.user_id) || u.user_id === linkedUserId)
  );

  const agentActions = (
    <div className="flex gap-2">
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline"><UserPlus className="h-4 w-4 mr-1" /> Invite New Agent</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a new Sales Agent</DialogTitle>
            <DialogDescription>Creates a login + an agent profile, linked automatically. The agent will see only their assigned customers.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2"><Label>Display name *</Label><Input value={inviteName} onChange={e => setInviteName(e.target.value)} /></div>
            <div><Label>Email *</Label><Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></div>
            <div><Label>Temporary password *</Label><Input type="text" value={invitePassword} onChange={e => setInvitePassword(e.target.value)} placeholder="min 6 chars" /></div>
          </div>
          <Button onClick={handleInviteAgent} disabled={inviteBusy} className="w-full mt-4">
            {inviteBusy ? "Inviting…" : "Create login & agent"}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={agentOpen} onOpenChange={o => { if (!o) resetForm(); else setAgentOpen(true); }}>
        <DialogTrigger asChild>
          <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Agent</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Agent" : "Add Sales Agent"}</DialogTitle>
            <DialogDescription>Manage your sales commission agents. Link to a login so RLS can scope their data.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><Label>Address</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
            <div className="col-span-2">
              <Label className="flex items-center gap-1.5"><LinkIcon className="h-3 w-3" /> Linked Login (required for agent to see their data)</Label>
              <Select value={linkedUserId || "__none"} onValueChange={v => setLinkedUserId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Pick an unlinked sales-agent login..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— No login linked —</SelectItem>
                  {linkableUsers.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.email ?? u.user_id} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Only logins with role <b>sales_agent</b> appear here. Use "Invite New Agent" above to create a login on the fly.</p>
            </div>
            <div>
              <Label>Commission Type</Label>
              <Select value={commType} onValueChange={setCommType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{commType === "percentage" ? "Rate (%)" : "Fixed Amount (PKR)"}</Label>
              <Input type="number" value={commRate} onChange={e => setCommRate(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={agentStatus} onValueChange={setAgentStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSaveAgent} className="w-full mt-4">{editId ? "Update" : "Add"} Agent</Button>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <AppLayout title="Sales Agents" headerActions={agentActions}>
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 stagger-children">
          <div className="summary-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Active Agents</p>
              <p className="text-lg font-bold font-mono tabular-nums text-foreground">{agents.filter(a => a.status === "active").length}</p>
            </div>
          </div>
          <div className="summary-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Allocated Customers</p>
              <p className="text-lg font-bold font-mono tabular-nums text-foreground">{allocatedCustomerIds.size}</p>
            </div>
          </div>
          <div className="summary-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Commission This Month</p>
              <p className="text-lg font-bold font-mono tabular-nums text-foreground">PKR {commissionData.reduce((s, c) => s + c.commission, 0).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setSearch(""); }}>
          <TabsList>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="allocation">Customer Allocation</TabsTrigger>
            <TabsTrigger value="report">Commission Report</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3">
          <div className="relative max-w-sm search-pill flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-10 rounded-full border-0 shadow-none bg-transparent" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {activeTab === "agents" && (
            <Select value={statusFilterAgents} onValueChange={setStatusFilterAgents}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {activeTab === "agents" && (
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Linked Login</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />No agents found.
                    </TableCell></TableRow>
                  ) : filteredAgents.map(a => {
                    const linkedEmail = tenantUsers.find(u => u.user_id === a.user_id)?.email;
                    return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{a.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{a.email || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {a.user_id ? (
                          <Badge variant="outline" className="text-[10px] gap-1"><LinkIcon className="h-2.5 w-2.5" /> {linkedEmail ?? "linked"}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">Not linked</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {a.commission_type === "percentage" ? `${a.commission_rate}%` : `PKR ${Number(a.commission_rate).toLocaleString()}`}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant={a.status === "active" ? "default" : "secondary"} className="capitalize">{a.status}</Badge></TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(a.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "allocation" && (
          <div className="space-y-4">
            <Card className="glass-card">
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-semibold">Assign Customers to Agent</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <Label className="text-xs text-muted-foreground">Agent</Label>
                    <SearchableSelect
                      options={agents.filter(a => a.status === "active").map(a => ({ value: a.id, label: a.name }))}
                      value={allocAgent} onChange={setAllocAgent} placeholder="Select agent..."
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">Customers (select multiple)</Label>
                    <Input
                      placeholder="Filter customers..."
                      value={allocSearch}
                      onChange={e => setAllocSearch(e.target.value)}
                      className="mb-2 h-8 text-xs"
                    />
                    <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                      {filteredAllocCustomers.map(c => (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                          <Checkbox
                            checked={allocCustomers.includes(c.id)}
                            onCheckedChange={checked => {
                              setAllocCustomers(prev => checked ? [...prev, c.id] : prev.filter(id => id !== c.id));
                            }}
                          />
                          <span>{c.name}</span>
                          {allocations.some(a => a.customer_id === c.id) && (
                            <Badge variant="outline" className="text-[9px] ml-auto">
                              {agentNameMap.get(allocations.find(a => a.customer_id === c.id)?.agent_id || "") || "Assigned"}
                            </Badge>
                          )}
                        </label>
                      ))}
                      {filteredAllocCustomers.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">No customers match filter</p>
                      )}
                    </div>
                  </div>
                </div>
                <Button onClick={handleAllocate} size="sm" disabled={!allocAgent || allocCustomers.length === 0}>
                  <UserPlus className="h-4 w-4 mr-1" /> Allocate {allocCustomers.length} Customer(s)
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-center w-16">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAllocations.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                        No allocations yet.
                      </TableCell></TableRow>
                    ) : filteredAllocations.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{agentNameMap.get(a.agent_id) || "—"}</TableCell>
                        <TableCell>{customerNameMap.get(a.customer_id) || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveAlloc(a.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "report" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium">Month</Label>
              <Input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="w-48" />
            </div>
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Commission Rate</TableHead>
                      <TableHead className="text-right">Total Sales</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center w-32">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingReport ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : commissionData.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-40" />No commission data for this month.
                      </TableCell></TableRow>
                    ) : commissionData.map(c => (
                      <TableRow key={c.agent.id}>
                        <TableCell className="font-medium">{c.agent.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {c.agent.commission_type === "percentage" ? `${c.agent.commission_rate}%` : `PKR ${Number(c.agent.commission_rate).toLocaleString()}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">PKR {c.total_sales.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-primary">PKR {Math.round(c.commission).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={c.status === "paid" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {c.status !== "paid" && c.commission > 0 && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                              onClick={() => issueCommission(c.agent.id, c.total_sales, Math.round(c.commission), c.agent)}>
                              <CheckCircle className="h-3 w-3" /> Issue
                            </Button>
                          )}
                          {c.status === "paid" && <span className="text-xs text-muted-foreground">✓ Paid</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the agent and all their customer allocations and commission records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
