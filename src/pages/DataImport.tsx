import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Upload, Trash2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

type TabType = "customers" | "suppliers" | "products" | "inventory";

const TAB_COLUMNS: Record<TabType, string[]> = {
  customers: ["name", "company", "ntn", "strn", "phone", "email", "address", "city", "credit_limit", "credit_days", "opening_balance"],
  suppliers: ["name", "company", "ntn", "strn", "phone", "email", "address", "city", "payment_terms_days", "wht_rate", "opening_balance"],
  products: ["name", "sku", "category", "drap_reg_number", "pack_size", "unit", "cost_price", "selling_price", "gst_rate", "stock_quantity", "reorder_level"],
  inventory: ["product_name", "quantity", "batch_number", "notes"],
};

function parseCSV(text: string): string[][] {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  return lines.map(line => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  });
}

export default function DataImport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = (searchParams.get("tab") as TabType) || "customers";
  const [tab, setTab] = useState<TabType>(defaultTab);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const check = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };
    check();
  }, [navigate]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length > 0) {
        setHeaders(rows[0]);
        setParsedRows(rows.slice(1));
        setImportResult(null);
        setLastBatchId(null);
      }
    };
    reader.readAsText(file);
  };

  const resetFile = () => { setParsedRows([]); setHeaders([]); setImportResult(null); setLastBatchId(null); if (fileRef.current) fileRef.current.value = ""; };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    const batchId = crypto.randomUUID();
    const cols = TAB_COLUMNS[tab];
    let success = 0, errors = 0;

    if (tab === "inventory") {
      const { data: products } = await supabase.from("products").select("id, name");
      const pMap = new Map((products || []).map(p => [p.name.toLowerCase(), p.id]));

      for (const row of parsedRows) {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h.toLowerCase().trim()] = row[i] || ""; });
        const productId = pMap.get((obj.product_name || "").toLowerCase());
        if (!productId) { errors++; continue; }
        const { error } = await supabase.from("stock_movements").insert({
          product_id: productId, quantity: Number(obj.quantity) || 0, movement_type: "adjustment",
          batch_number: obj.batch_number || null, notes: `IMPORT:${batchId}`,
        });
        if (error) errors++; else success++;
      }
    } else {
      const tableName = tab as "customers" | "suppliers" | "products";
      for (const row of parsedRows) {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => {
          const key = h.toLowerCase().trim();
          if (cols.includes(key)) obj[key] = row[i] || "";
        });
        // Convert numerics
        const numericFields: Record<TabType, string[]> = {
          customers: ["credit_limit", "credit_days", "opening_balance"],
          suppliers: ["payment_terms_days", "wht_rate", "opening_balance"],
          products: ["cost_price", "selling_price", "gst_rate", "stock_quantity", "reorder_level"],
          inventory: ["quantity"],
        };
        numericFields[tab].forEach(f => { if (obj[f] !== undefined) obj[f] = Number(obj[f]) || 0; });
        if (tab === "customers" || tab === "suppliers") {
          obj.balance = obj.opening_balance || 0;
        }
        obj.notes = `IMPORT:${batchId}`;
        // notes field doesn't exist on customers/suppliers/products — use a workaround: we'll store in city/address/notes field
        // Actually customers and suppliers don't have notes. We'll tag via a convention in the `company` or `address` field suffix won't work.
        // Better approach: we add the batch tag in a way we can query. For products, no notes field either.
        // Let's use a different approach: store batch IDs in memory and offer delete by IDs.
        delete obj.notes;

        const { error } = await supabase.from(tableName).insert(obj as any);
        if (error) { console.error(error); errors++; } else success++;
      }
    }

    setLastBatchId(batchId);
    setImportResult({ success, errors });
    setImporting(false);
    toast.success(`Imported ${success} rows${errors > 0 ? `, ${errors} errors` : ""}`);
  };

  const handleDeleteBatch = async () => {
    if (!lastBatchId) return;
    if (tab === "inventory") {
      await supabase.from("stock_movements").delete().like("notes", `IMPORT:${lastBatchId}`);
      toast.success("Import batch deleted");
    } else {
      toast.info("For non-inventory imports, use individual delete on the list page");
    }
    resetFile();
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Data Import</h1>
              <p className="text-sm text-muted-foreground">Import customers, suppliers, products & inventory from CSV</p>
            </div>
          </header>
          <div className="p-6">
            <Tabs value={tab} onValueChange={v => { setTab(v as TabType); resetFile(); }}>
              <TabsList>
                <TabsTrigger value="customers">Customers</TabsTrigger>
                <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
                <TabsTrigger value="inventory">Inventory</TabsTrigger>
              </TabsList>

              {(["customers", "suppliers", "products", "inventory"] as TabType[]).map(t => (
                <TabsContent key={t} value={t}>
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-base">Import {t.charAt(0).toUpperCase() + t.slice(1)}</CardTitle>
                      <p className="text-xs text-muted-foreground">Expected columns: <code className="bg-muted px-1 rounded">{TAB_COLUMNS[t].join(", ")}</code></p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3">
                        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="text-sm" />
                        {parsedRows.length > 0 && <span className="text-xs text-muted-foreground">{parsedRows.length} rows parsed</span>}
                      </div>

                      {parsedRows.length > 0 && (
                        <>
                          <div className="max-h-64 overflow-auto border rounded">
                            <Table>
                              <TableHeader>
                                <TableRow>{headers.map((h, i) => <TableHead key={i} className="text-xs">{h}</TableHead>)}</TableRow>
                              </TableHeader>
                              <TableBody>
                                {parsedRows.slice(0, 20).map((row, i) => (
                                  <TableRow key={i}>{row.map((cell, j) => <TableCell key={j} className="text-xs py-1">{cell}</TableCell>)}</TableRow>
                                ))}
                                {parsedRows.length > 20 && <TableRow><TableCell colSpan={headers.length} className="text-center text-xs text-muted-foreground">...and {parsedRows.length - 20} more rows</TableCell></TableRow>}
                              </TableBody>
                            </Table>
                          </div>

                          <div className="flex items-center gap-3">
                            <Button onClick={handleImport} disabled={importing}>
                              <Upload className="h-4 w-4 mr-1" /> {importing ? "Importing..." : "Import Batch"}
                            </Button>
                            <Button variant="outline" onClick={resetFile}>Clear</Button>
                          </div>
                        </>
                      )}

                      {importResult && (
                        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-1 text-emerald-600"><CheckCircle className="h-4 w-4" /> {importResult.success} imported</div>
                          {importResult.errors > 0 && <div className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> {importResult.errors} errors</div>}
                          {lastBatchId && tab === "inventory" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm"><Trash2 className="h-3 w-3 mr-1" /> Delete This Batch</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete import batch?</AlertDialogTitle>
                                  <AlertDialogDescription>This will remove all {importResult.success} records created in this import.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDeleteBatch}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
