import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { InvoiceCard } from "@/components/invoicing/InvoiceCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface LineItem {
  name: string;
  qty: number;
  rate: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_ntn: string;
  items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  fbr_qr_data: string | null;
}

export default function Invoicing() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerNtn, setCustomerNtn] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ name: "", qty: 1, rate: 0 }]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setInvoices(data as unknown as Invoice[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchInvoices();
  }, [user]);

  const handleCreate = async () => {
    const subtotal = items.reduce((s, i) => s + i.qty * i.rate, 0);
    const tax = Math.round(subtotal * 0.17);
    const total = subtotal + tax;
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

    const { error } = await supabase.from("invoices").insert({
      invoice_number: invoiceNumber,
      customer_name: customerName,
      customer_ntn: customerNtn,
      items: items as any,
      subtotal,
      tax,
      total,
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Invoice created");
      setShowForm(false);
      setCustomerName("");
      setCustomerNtn("");
      setItems([{ name: "", qty: 1, rate: 0 }]);
      fetchInvoices();
    }
  };

  const handleFinalize = async (inv: Invoice) => {
    setFinalizingId(inv.id);
    const qrData = `FBR|${inv.invoice_number}|NTN:${inv.customer_ntn}|PKR:${inv.total}|TS:${new Date().toISOString()}`;
    const { error } = await supabase
      .from("invoices")
      .update({ status: "finalized", fbr_qr_data: qrData, finalized_at: new Date().toISOString(), finalized_by: user!.id })
      .eq("id", inv.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Sent to FBR — Invoice finalized");
      fetchInvoices();
    }
    setFinalizingId(null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
            <div className="flex items-center gap-3">
              <SidebarTrigger><Menu className="h-5 w-5 text-muted-foreground" /></SidebarTrigger>
              <div>
                <h1 className="font-heading font-semibold text-foreground text-sm">Invoicing</h1>
                <p className="text-[11px] text-muted-foreground">FBR Integration & Billing</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
              {showForm ? <><X className="h-3.5 w-3.5" /> Cancel</> : <><Plus className="h-3.5 w-3.5" /> New Invoice</>}
            </Button>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            {showForm && (
              <div className="glass-card p-6 mb-6 space-y-4 animate-fade-in">
                <h2 className="font-heading font-semibold text-foreground">Create Invoice</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input placeholder="Customer Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  <Input placeholder="NTN Number" value={customerNtn} onChange={(e) => setCustomerNtn(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Line Items</p>
                  {items.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-2">
                      <Input placeholder="Item name" value={item.name} onChange={(e) => { const n = [...items]; n[i].name = e.target.value; setItems(n); }} />
                      <Input type="number" placeholder="Qty" value={item.qty} onChange={(e) => { const n = [...items]; n[i].qty = +e.target.value; setItems(n); }} />
                      <Input type="number" placeholder="Rate" value={item.rate} onChange={(e) => { const n = [...items]; n[i].rate = +e.target.value; setItems(n); }} />
                      <Button size="icon" variant="ghost" onClick={() => setItems(items.filter((_, j) => j !== i))} disabled={items.length === 1}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setItems([...items, { name: "", qty: 1, rate: 0 }])}>
                    <Plus className="h-3 w-3 mr-1" /> Add Item
                  </Button>
                </div>
                <Button onClick={handleCreate} disabled={!customerName || items.some((i) => !i.name)}>
                  Create Invoice
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {invoices.map((inv) => (
                <InvoiceCard
                  key={inv.id}
                  invoiceNumber={inv.invoice_number}
                  customerName={inv.customer_name}
                  customerNtn={inv.customer_ntn}
                  items={inv.items}
                  subtotal={inv.subtotal}
                  tax={inv.tax}
                  total={inv.total}
                  status={inv.status}
                  fbrQrData={inv.fbr_qr_data}
                  onFinalize={() => handleFinalize(inv)}
                  finalizing={finalizingId === inv.id}
                />
              ))}
              {invoices.length === 0 && !showForm && (
                <div className="col-span-full glass-card p-10 text-center text-muted-foreground text-sm">
                  No invoices yet. Create your first invoice.
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
