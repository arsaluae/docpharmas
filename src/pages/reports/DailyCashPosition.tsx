import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAllRows } from "@/lib/batch-fetch";
import { Wallet, ArrowDownCircle, ArrowUpCircle, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface Bank { id: string; name: string; balance: number; account_type: string | null; }
interface Payment { id: string; bank_account_id: string | null; amount: number; type: string; date: string; }
interface Expense { id: string; bank_account_id: string | null; amount: number; date: string; }

export default function DailyCashPosition() {
 const [banks, setBanks] = useState<Bank[]>([]);
 const [payments, setPayments] = useState<Payment[]>([]);
 const [expenses, setExpenses] = useState<Expense[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => { (async () => {
 setLoading(true);
 const since = new Date(); since.setDate(since.getDate() - 30);
 const sinceStr = since.toISOString().slice(0, 10);
 const [b, p, e] = await Promise.all([
 fetchAllRows("bank_accounts", "id, name, balance, account_type"),
 fetchAllRows("payments", "id, bank_account_id, amount, type, date", [{ column: "date", op: "gte", value: sinceStr }]),
 fetchAllRows("expenses", "id, bank_account_id, amount, date", [{ column: "date", op: "gte", value: sinceStr }]),
 ]);
 setBanks(b); setPayments(p); setExpenses(e);
 setLoading(false);
 })(); }, []);

 const today = new Date().toISOString().slice(0, 10);
 const todayIn = payments.filter(p => p.date === today && p.type === "received").reduce((s, p) => s + Number(p.amount), 0);
 const todayOut = payments.filter(p => p.date === today && p.type !== "received").reduce((s, p) => s + Number(p.amount), 0)
 + expenses.filter(e => e.date === today).reduce((s, e) => s + Number(e.amount), 0);
 const totalCash = banks.reduce((s, b) => s + Number(b.balance), 0);

 const trend = useMemo(() => {
 const map = new Map<string, { date: string; in: number; out: number }>();
 for (let i = 29; i >= 0; i--) {
 const d = new Date(); d.setDate(d.getDate() - i);
 const k = d.toISOString().slice(0, 10);
 map.set(k, { date: k.slice(5), in: 0, out: 0 });
 }
 payments.forEach(p => {
 const k = p.date.slice(5);
 const cur = map.get(p.date); if (!cur) return;
 if (p.type === "received") cur.in += Number(p.amount); else cur.out += Number(p.amount);
 });
 expenses.forEach(e => {
 const cur = map.get(e.date); if (!cur) return;
 cur.out += Number(e.amount);
 });
 return Array.from(map.values());
 }, [payments, expenses]);

 return (
 <AppLayout title="Daily Cash Position" subtitle="Live bank balances + 30-day cash flow">
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
 <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><Wallet className="h-4 w-4 text-primary" /></div><div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Total Cash</p><p className="text-lg font-bold font-mono">PKR {Math.round(totalCash).toLocaleString()}</p></div></CardContent></Card>
 <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-success/10 flex items-center justify-center"><ArrowDownCircle className="h-4 w-4 text-success" /></div><div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Today In</p><p className="text-lg font-bold font-mono">PKR {Math.round(todayIn).toLocaleString()}</p></div></CardContent></Card>
 <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center"><ArrowUpCircle className="h-4 w-4 text-destructive" /></div><div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Today Out</p><p className="text-lg font-bold font-mono">PKR {Math.round(todayOut).toLocaleString()}</p></div></CardContent></Card>
 <Card className="glass-card"><CardContent className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-warning" /></div><div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Net Today</p><p className={`text-lg font-bold font-mono ${todayIn - todayOut >= 0 ? "text-success" : "text-destructive"}`}>PKR {Math.round(todayIn - todayOut).toLocaleString()}</p></div></CardContent></Card>
 </div>

 <Card className="glass-card mb-5"><CardContent className="p-5">
 <h3 className="text-sm font-semibold mb-3">30-Day Cash Flow</h3>
 <div className="h-72">
 <ResponsiveContainer><LineChart data={trend}>
 <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
 <XAxis dataKey="date" tick={{ fontSize: 10 }} />
 <YAxis tick={{ fontSize: 10 }} />
 <Tooltip />
 <Legend />
 <Line type="monotone" dataKey="in" name="Inflow" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
 <Line type="monotone" dataKey="out" name="Outflow" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
 </LineChart></ResponsiveContainer>
 </div>
 </CardContent></Card>

 <Card className="glass-card"><CardContent className="p-0">
 <Table>
 <TableHeader><TableRow>
 <TableHead>Bank Account</TableHead>
 <TableHead>Type</TableHead>
 <TableHead className="text-right">Balance (PKR)</TableHead>
 <TableHead className="text-right">% of Cash</TableHead>
 </TableRow></TableHeader>
 <TableBody>
 {loading ? <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
 : banks.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No bank accounts.</TableCell></TableRow>
 : [...banks].sort((a, b) => Number(b.balance) - Number(a.balance)).map(b => (
 <TableRow key={b.id}>
 <TableCell className="font-medium">{b.name}</TableCell>
 <TableCell className="text-xs text-muted-foreground">{b.account_type || "—"}</TableCell>
 <TableCell className="text-right font-mono">{Number(b.balance).toLocaleString()}</TableCell>
 <TableCell className="text-right font-mono text-muted-foreground">{totalCash > 0 ? ((Number(b.balance) / totalCash) * 100).toFixed(1) : "0"}%</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </CardContent></Card>
 </AppLayout>
 );
}
