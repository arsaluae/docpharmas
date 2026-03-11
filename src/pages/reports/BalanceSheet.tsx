import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BalanceSheet() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split("T")[0]);
  const [bankTotal, setBankTotal] = useState(0);
  const [receivables, setReceivables] = useState(0);
  const [inventory, setInventory] = useState(0);
  const [payables, setPayables] = useState(0);
  const [printerPayables, setPrinterPayables] = useState(0);
  const [taxPayable, setTaxPayable] = useState(0);
  const [retainedEarnings, setRetainedEarnings] = useState(0);

  useEffect(() => { load(); }, [asOfDate]);

  const load = async () => {
    const [banks, custs, prods, sups, printers, salesInv, purchInv, expenses, payments, sReturns, pReturns, salaryPay] = await Promise.all([
      supabase.from("bank_accounts").select("opening_balance"),
      supabase.from("customers").select("opening_balance"),
      supabase.from("products").select("cost_price, stock_quantity"),
      supabase.from("suppliers").select("opening_balance"),
      supabase.from("printers").select("opening_balance"),
      supabase.from("sales_invoices").select("gst_amount, subtotal, total, customer_id").lte("date", asOfDate),
      supabase.from("purchase_invoices").select("gst, subtotal, total, supplier_id").lte("date", asOfDate),
      supabase.from("expenses").select("amount, expense_type, bank_account_id").lte("date", asOfDate),
      supabase.from("payments").select("type, amount, party_type, party_id, bank_account_id").lte("date", asOfDate),
      supabase.from("sales_returns").select("total, customer_id").lte("date", asOfDate),
      supabase.from("purchase_returns").select("total, supplier_id").lte("date", asOfDate),
      supabase.from("salary_payments").select("amount, bank_account_id").lte("date", asOfDate),
    ]);

    // Calculate bank balances from transactions
    const bankOpenings = (banks.data || []).reduce((s, b) => s + Number(b.opening_balance), 0);
    const bankPaymentsIn = (payments.data || []).filter(p => p.bank_account_id && p.type === "received").reduce((s, p) => s + Number(p.amount), 0);
    const bankPaymentsOut = (payments.data || []).filter(p => p.bank_account_id && p.type === "made").reduce((s, p) => s + Number(p.amount), 0);
    const bankExpenses = (expenses.data || []).filter(e => e.bank_account_id).reduce((s, e) => s + Number(e.amount), 0);
    const bankSalaries = (salaryPay.data || []).filter(s => s.bank_account_id).reduce((s, sal) => s + Number(sal.amount), 0);
    setBankTotal(bankOpenings + bankPaymentsIn - bankPaymentsOut - bankExpenses - bankSalaries);

    // Calculate receivables from transactions
    const custOpenings = (custs.data || []).reduce((s, c) => s + Number(c.opening_balance), 0);
    const custInvoices = (salesInv.data || []).reduce((s, i) => s + Number(i.total), 0);
    const custPayments = (payments.data || []).filter(p => p.party_type === "customer" && p.type === "received").reduce((s, p) => s + Number(p.amount), 0);
    const custReturns = (sReturns.data || []).reduce((s, r) => s + Number(r.total), 0);
    setReceivables(custOpenings + custInvoices - custPayments - custReturns);

    setInventory((prods.data || []).reduce((s, p) => s + Number(p.cost_price) * Number(p.stock_quantity), 0));

    // Calculate payables from transactions
    const supOpenings = (sups.data || []).reduce((s, su) => s + Number(su.opening_balance), 0);
    const supInvoices = (purchInv.data || []).reduce((s, i) => s + Number(i.total), 0);
    const supPayments = (payments.data || []).filter(p => p.party_type === "supplier" && p.type === "made").reduce((s, p) => s + Number(p.amount), 0);
    const supReturns = (pReturns.data || []).reduce((s, r) => s + Number(r.total), 0);
    setPayables(supOpenings + supInvoices - supPayments - supReturns);

    const prtOpenings = (printers.data || []).reduce((s, pr) => s + Number(pr.opening_balance), 0);
    const prtPayments = (payments.data || []).filter(p => p.party_type === "printer" && p.type === "made").reduce((s, p) => s + Number(p.amount), 0);
    setPrinterPayables(prtOpenings - prtPayments);

    const salesReturnTotal = (sReturns.data || []).reduce((s, i) => s + Number(i.total), 0);
    const purchReturnTotal = (pReturns.data || []).reduce((s, i) => s + Number(i.total), 0);

    const gstOut = (salesInv.data || []).reduce((s, i) => s + Number(i.gst_amount), 0);
    const gstIn = (purchInv.data || []).reduce((s, i) => s + Number(i.gst), 0);
    setTaxPayable((gstOut - salesReturnTotal * 0.17) - (gstIn - purchReturnTotal * 0.17));

    const totalRevenue = (salesInv.data || []).reduce((s, i) => s + Number(i.subtotal), 0);
    const totalCOGS = (purchInv.data || []).reduce((s, i) => s + Number(i.subtotal), 0);
    const totalBizExpenses = (expenses.data || []).filter(e => e.expense_type === 'business').reduce((s, e) => s + Number(e.amount), 0);
    const totalSalaries = (salaryPay.data || []).reduce((s, sal) => s + Number(sal.amount), 0);
    setRetainedEarnings((totalRevenue - salesReturnTotal) - (totalCOGS - purchReturnTotal) - totalBizExpenses - totalSalaries);
  };

  const totalAssets = bankTotal + receivables + inventory;
  const totalLiabilities = payables + printerPayables + Math.max(taxPayable, 0);
  const equity = retainedEarnings;

  const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
    <div className={`flex justify-between py-1 ${bold ? "font-semibold" : ""}`}>
      <span className="text-sm">{label}</span>
      <span className="font-mono text-sm">PKR {value.toLocaleString()}</span>
    </div>
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      <Label className="text-xs">As of</Label>
      <Input type="date" className="w-40" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
    </div>
  );

  return (
    <AppLayout title="Balance Sheet" headerActions={headerActions}>
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Assets</CardTitle></CardHeader>
          <CardContent>
            <Row label="Cash & Bank Balances" value={bankTotal} />
            <Row label="Accounts Receivable" value={receivables} />
            <Row label="Inventory (at cost)" value={inventory} />
            <Separator className="my-2" />
            <Row label="Total Assets" value={totalAssets} bold />
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Liabilities</CardTitle></CardHeader>
          <CardContent>
            <Row label="Accounts Payable (Suppliers)" value={payables} />
            <Row label="Accounts Payable (Printers)" value={printerPayables} />
            <Row label="GST Payable (net)" value={Math.max(taxPayable, 0)} />
            <Separator className="my-2" />
            <Row label="Total Liabilities" value={totalLiabilities} bold />
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Equity</CardTitle></CardHeader>
          <CardContent>
            <Row label="Retained Earnings" value={retainedEarnings} />
            <Separator className="my-2" />
            <Row label="Total Equity" value={equity} bold />
          </CardContent>
        </Card>
        <Card className={`glass-card border-2 ${Math.abs(totalAssets - totalLiabilities - equity) < 1 ? "border-primary/30" : "border-destructive/30"}`}>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold font-mono text-primary">PKR {totalAssets.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Liabilities + Equity</p>
                <p className="text-2xl font-bold font-mono text-primary">PKR {(totalLiabilities + equity).toLocaleString()}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">⚠️ Note: Bank balances, receivables, payables & inventory reflect current live balances. Only retained earnings are filtered by the "As of" date.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
