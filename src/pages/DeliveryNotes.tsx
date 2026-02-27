import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileText, Download } from "lucide-react";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";

interface DeliveryNote {
  id: string; dn_number: string; date: string; reference_type: string;
  reference_id: string; customer_id: string | null; supplier_id: string | null;
  items: any; notes: string | null; status: string; created_at: string;
}

export default function DeliveryNotes() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [search, setSearch] = useState("");
  const { settings } = useCompanySettings();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const { data } = await supabase.from("delivery_notes").select("*").order("created_at", { ascending: false });
    if (data) setNotes(data as any);
  };

  const printDN = (dn: DeliveryNote) => {
    const items = typeof dn.items === "string" ? JSON.parse(dn.items) : dn.items;
    generatePdf({
      title: "DELIVERY NOTE",
      documentNumber: dn.dn_number,
      date: dn.date,
      columns: [
        { header: "#", key: "idx" },
        { header: "Product", key: "product_name" },
        { header: "Batch #", key: "batch_number" },
        { header: "Expiry", key: "expiry_date" },
        { header: "Quantity", key: "quantity", align: "right" },
      ],
      rows: items.map((i: any, idx: number) => ({ ...i, idx: idx + 1 })),
      notes: dn.notes || undefined,
      settings,
    });
  };

  const filtered = notes.filter(n => n.dn_number.toLowerCase().includes(search.toLowerCase()));

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Delivery Notes</h1>
              <p className="text-sm text-muted-foreground">Track dispatched goods — no pricing, just batch/qty/expiry</p>
            </div>
          </header>

          <div className="p-6">
            <div className="mb-4 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search delivery notes..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DN #</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead>
                      <TableHead>Status</TableHead><TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />No delivery notes yet.
                      </TableCell></TableRow>
                    ) : filtered.map(dn => (
                      <TableRow key={dn.id}>
                        <TableCell className="font-medium font-mono">{dn.dn_number}</TableCell>
                        <TableCell className="text-muted-foreground">{dn.date}</TableCell>
                        <TableCell className="capitalize">{dn.reference_type.replace("_", " ")}</TableCell>
                        <TableCell><span className="status-pill bg-emerald-50 text-emerald-700">{dn.status}</span></TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => printDN(dn)} className="text-xs">
                            <Download className="h-3 w-3 mr-1" /> PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
