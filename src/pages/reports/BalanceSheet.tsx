import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function BalanceSheet() {
  const [bankTotal, setBankTotal] = useState(0);
  const [receivables, setReceivables] = useState(0);
  const [inventory, setInventory] = useState(0);
  const [payables, setPayables] = useState(0);
  const [printerPayables, setPrinterPayables] = useState(0);
  const [taxPayable, setTaxPayable] = useState(0);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [banks, custs, prods, sups, printers, salesInv, purchInv] = await Promise.all([
      supabase.from("bank_accounts").select("balance"),
      supabase.from("customers").select("balance"),
      supabase.from("products").select("cost_price, stock_quantity"),
      supabase.from("suppliers").select("balance"),
      supabase.from("printers").select("balance"),
      supabase.from("sales_invoices").select("gst_amount").in("status", ["unpaid", "partial"]),
      supabase.from("purchase_invoices").select("gst, wht_amount").in("status", ["unpaid", "partial"]),
    ]);
    setBankTotal((banks.data || []).reduce((s, b) => s + Number(b.balance), 0));
    setReceivables((custs.data || []).reduce((s, c) => s + Number(c.balance), 0));
    setInventory((prods.data || []).reduce((s, p) => s + Number(p.cost_price) * Number(p.stock_quantity), 0));
    setPayables((sups.data || []).reduce((s, su) => s + Number(su.balance), 0));
    setPrinterPayables((printers.data || []).reduce((s, pr) => s + Number(pr.balance), 0));
    const gstOut = (salesInv.data || []).reduce((s, i) => s + Number(i.gst_amount), 0);
    const gstIn = (purchInv.data || []).reduce((s, i) => s + Number(i.gst), 0);
    setTaxPayable(gstOut - gstIn);
  };

  const totalAssets = bankTotal + receivables + inventory;
  const totalLiabilities = payables + printerPayables + Math.max(taxPayable, 0);
  const equity = totalAssets - totalLiabilities;

  const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
    <div className={`flex justify-between py-1 ${bold ? "font-semibold" : ""}`}>
      <span className="text-sm">{label}</span>
      <span className="font-mono text-sm">PKR {value.toLocaleString()}</span>
    </div>
  );

  return (
    <AppLayout title="Balance Sheet">
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
        <Card className={`glass-card border-2 ${equity >= 0 ? "border-primary/30" : "border-destructive/30"}`}>
          <CardHeader><CardTitle className="text-base">Equity</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold font-mono ${equity >= 0 ? "text-primary" : "text-destructive"}`}>PKR {equity.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Assets − Liabilities</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
