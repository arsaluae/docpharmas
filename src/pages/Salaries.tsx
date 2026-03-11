import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, UserCheck, Wallet, Trash2, Pencil, Users, BadgeDollarSign } from "lucide-react";
import { toast } from "sonner";

const METHODS = ["cash", "cheque", "bank_transfer", "online"];

interface Staff {
  id: string; name: string; designation: string | null; phone: string | null;
  salary: number; joining_date: string | null; status: string;
}
interface SalaryPayment {
  id: string; salary_number: string; staff_id: string; amount: number;
  month: string; payment_method: string; bank_account_id: string | null;
  date: string; notes: string | null;
}
interface BankAccount { id: string; name: string; bank_name: string; }

export default function Salaries() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("staff");
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [search, setSearch] = useState("");
  const pagination = usePagination();

  // Staff form
  const [staffOpen, setStaffOpen] = useState(false);
  const [editStaffId, setEditStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffDesignation, setStaffDesignation] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffSalary, setStaffSalary] = useState("");
  const [staffJoining, setStaffJoining] = useState("");
  const [deleteStaffId, setDeleteStaffId] = useState<string | null>(null);

  // Payment form
  const [payOpen, setPayOpen] = useState(false);
  const [payStaffId, setPayStaffId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMonth, setPayMonth] = useState(new Date().toISOString().substring(0, 7));
  const [payMethod, setPayMethod] = useState("cash");
  const [payBankId, setPayBankId] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payNotes, setPayNotes] = useState("");
  const [deletePayId, setDeletePayId] = useState<string | null>(null);

  useEffect(() => { load(); }, [pagination.page, activeTab]);

  const load = async () => {
    const [staffRes, bankRes] = await Promise.all([
      supabase.from("staff").select("*").order("name"),
      supabase.from("bank_accounts").select("id, name, bank_name"),
    ]);
    if (staffRes.data) setStaffList(staffRes.data as Staff[]);
    if (bankRes.data) setBankAccounts(bankRes.data);

    if (activeTab === "payments") {
      const payRes = await supabase.from("salary_payments").select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(pagination.from, pagination.to);
      if (payRes.data) setPayments(payRes.data as SalaryPayment[]);
      if (payRes.count !== null && payRes.count !== undefined) pagination.setTotalCount(payRes.count);
    }
  };

  // Staff CRUD
  const handleSaveStaff = async () => {
    if (!staffName.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: staffName,
      designation: staffDesignation || null,
      phone: staffPhone || null,
      salary: Number(staffSalary) || 0,
      joining_date: staffJoining || null,
    };
    if (editStaffId) {
      const { error } = await supabase.from("staff").update(payload).eq("id", editStaffId);
      if (error) { toast.error(error.message); return; }
      toast.success("Staff updated");
    } else {
      const { error } = await supabase.from("staff").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Staff added");
    }
    resetStaffForm(); load();
  };

  const handleEditStaff = (s: Staff) => {
    setEditStaffId(s.id); setStaffName(s.name); setStaffDesignation(s.designation || "");
    setStaffPhone(s.phone || ""); setStaffSalary(String(s.salary)); setStaffJoining(s.joining_date || "");
    setStaffOpen(true);
  };

  const handleDeleteStaff = async () => {
    if (!deleteStaffId) return;
    const { error } = await supabase.from("staff").delete().eq("id", deleteStaffId);
    if (error) { toast.error(error.message); } else { toast.success("Staff deleted"); }
    setDeleteStaffId(null); load();
  };

  const resetStaffForm = () => {
    setStaffOpen(false); setEditStaffId(null); setStaffName(""); setStaffDesignation("");
    setStaffPhone(""); setStaffSalary(""); setStaffJoining("");
  };

  // Payment
  const handlePaySalary = async () => {
    if (!payStaffId) { toast.error("Select staff"); return; }
    if (!payAmount || Number(payAmount) <= 0) { toast.error("Amount is required"); return; }

    const { data: salNum } = await supabase.rpc("generate_document_number", { p_document_type: "salary" });
    if (!salNum) { toast.error("Failed to generate salary number"); return; }

    const { error } = await supabase.from("salary_payments").insert({
      salary_number: salNum,
      staff_id: payStaffId,
      amount: Number(payAmount),
      month: payMonth,
      payment_method: payMethod,
      bank_account_id: payBankId || null,
      date: payDate,
      notes: payNotes || null,
    });

    if (error) { toast.error(error.message); return; }
    toast.success(`Salary ${salNum} paid`);
    resetPayForm(); load();
  };

  const handleDeletePay = async () => {
    if (!deletePayId) return;
    const { error } = await supabase.from("salary_payments").delete().eq("id", deletePayId);
    if (error) { toast.error(error.message); } else { toast.success("Payment deleted & bank balance reversed"); }
    setDeletePayId(null); load();
  };

  const resetPayForm = () => {
    setPayOpen(false); setPayStaffId(""); setPayAmount(""); setPayMethod("cash");
    setPayBankId(""); setPayNotes("");
  };

  const openPayDialog = (staffId?: string) => {
    if (staffId) {
      setPayStaffId(staffId);
      const s = staffList.find(st => st.id === staffId);
      if (s) setPayAmount(String(s.salary));
    }
    setPayOpen(true);
  };

  const staffNameMap = new Map(staffList.map(s => [s.id, s.name]));
  const totalMonthlySalary = staffList.filter(s => s.status === "active").reduce((sum, s) => sum + Number(s.salary), 0);
  const totalPaidThisMonth = payments.filter(p => p.month === payMonth).reduce((sum, p) => sum + Number(p.amount), 0);

  const filteredStaff = staffList.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.designation || "").toLowerCase().includes(search.toLowerCase()));
  const filteredPayments = payments.filter(p => (staffNameMap.get(p.staff_id) || "").toLowerCase().includes(search.toLowerCase()) || p.salary_number.toLowerCase().includes(search.toLowerCase()));

  const staffActions = (
    <div className="flex gap-2">
      <Dialog open={payOpen} onOpenChange={o => { if (!o) resetPayForm(); else setPayOpen(true); }}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" onClick={() => openPayDialog()}><Wallet className="h-4 w-4 mr-1" /> Pay Salary</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Salary</DialogTitle>
            <DialogDescription>Record a salary payment for a staff member</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Staff *</Label>
                <Select value={payStaffId} onValueChange={v => { setPayStaffId(v); const s = staffList.find(st => st.id === v); if (s) setPayAmount(String(s.salary)); }}>
                  <SelectTrigger><SelectValue placeholder="Select staff..." /></SelectTrigger>
                  <SelectContent>{staffList.filter(s => s.status === "active").map(s => <SelectItem key={s.id} value={s.id}>{s.name} — {s.designation || "Staff"}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Amount (PKR) *</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
              <div><Label>Month</Label><Input type="month" value={payMonth} onChange={e => setPayMonth(e.target.value)} /></div>
              <div><Label>Date</Label><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
              <div>
                <Label>Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(payMethod === "bank_transfer" || payMethod === "cheque") && (
                <div className="col-span-2">
                  <Label>Bank Account</Label>
                  <Select value={payBankId} onValueChange={setPayBankId}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name} — {b.bank_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2"><Label>Notes</Label><Input value={payNotes} onChange={e => setPayNotes(e.target.value)} /></div>
            </div>
          </div>
          <Button onClick={handlePaySalary} className="w-full mt-2">Record Payment</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={staffOpen} onOpenChange={o => { if (!o) resetStaffForm(); else setStaffOpen(true); }}>
        <DialogTrigger asChild>
          <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Staff</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editStaffId ? "Edit Staff" : "Add Staff"}</DialogTitle>
            <DialogDescription>Manage your team members and their salary details</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div><Label>Name *</Label><Input value={staffName} onChange={e => setStaffName(e.target.value)} /></div>
            <div><Label>Designation</Label><Input value={staffDesignation} onChange={e => setStaffDesignation(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={staffPhone} onChange={e => setStaffPhone(e.target.value)} /></div>
            <div><Label>Monthly Salary</Label><Input type="number" value={staffSalary} onChange={e => setStaffSalary(e.target.value)} /></div>
            <div><Label>Joining Date</Label><Input type="date" value={staffJoining} onChange={e => setStaffJoining(e.target.value)} /></div>
          </div>
          <Button onClick={handleSaveStaff} className="w-full mt-4">{editStaffId ? "Update" : "Add"} Staff</Button>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <AppLayout title="Staff & Salaries" headerActions={staffActions}>
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 stagger-children">
          <div className="summary-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Active Staff</p>
              <p className="text-lg font-bold font-mono tabular-nums text-foreground">{staffList.filter(s => s.status === "active").length}</p>
            </div>
          </div>
          <div className="summary-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Monthly Payroll</p>
              <p className="text-lg font-bold font-mono tabular-nums text-foreground">PKR {totalMonthlySalary.toLocaleString()}</p>
            </div>
          </div>
          <div className="summary-card p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Paid This Month</p>
              <p className="text-lg font-bold font-mono tabular-nums text-foreground">PKR {totalPaidThisMonth.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setSearch(""); }}>
          <TabsList>
            <TabsTrigger value="staff">Staff List</TabsTrigger>
            <TabsTrigger value="payments">Payment History</TabsTrigger>
            <TabsTrigger value="commissions" onClick={() => navigate("/sales-agents")}>
              <BadgeDollarSign className="h-3.5 w-3.5 mr-1" /> Sales Commissions
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative max-w-sm search-pill">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-10 rounded-full border-0 shadow-none bg-transparent" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {activeTab === "staff" ? (
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Joining</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead className="text-center w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />No staff added yet.
                    </TableCell></TableRow>
                  ) : filteredStaff.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.designation || "—"}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{s.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s.joining_date || "—"}</TableCell>
                      <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">{s.status}</Badge></TableCell>
                      <TableCell className="text-right font-mono font-medium">PKR {Number(s.salary).toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPayDialog(s.id)} title="Pay Salary">
                            <Wallet className="h-3.5 w-3.5 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditStaff(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteStaffId(s.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment #</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />No salary payments yet.
                    </TableCell></TableRow>
                  ) : filteredPayments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium font-mono">{p.salary_number}</TableCell>
                      <TableCell className="font-medium">{staffNameMap.get(p.staff_id) || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.month}</TableCell>
                      <TableCell className="text-muted-foreground capitalize">{p.payment_method.replace("_", " ")}</TableCell>
                      <TableCell className="text-muted-foreground">{p.date}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-destructive">PKR {Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletePayId(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                page={pagination.page} totalPages={pagination.totalPages} totalCount={pagination.totalCount}
                hasNext={pagination.hasNext} hasPrev={pagination.hasPrev}
                onNext={pagination.nextPage} onPrev={pagination.prevPage} pageSize={pagination.pageSize}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deleteStaffId} onOpenChange={o => { if (!o) setDeleteStaffId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Staff?</AlertDialogTitle>
            <AlertDialogDescription>This will delete the staff member and all their salary payment records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStaff} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePayId} onOpenChange={o => { if (!o) setDeletePayId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment?</AlertDialogTitle>
            <AlertDialogDescription>This will delete this salary payment and reverse any bank balance changes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePay} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
