import { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Upload, Trash2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type TabType = "customers" | "suppliers" | "products" | "inventory";

const TAB_COLUMNS: Record<TabType, string[]> = {
  customers: ["name", "company", "ntn", "strn", "phone", "email", "address", "city", "area", "credit_limit", "credit_days", "opening_balance"],
  suppliers: ["name", "company", "ntn", "strn", "phone", "email", "address", "city", "payment_terms_days", "wht_rate", "opening_balance"],
  products: ["name", "sku", "category", "drap_reg_number", "pack_size", "unit", "cost_price", "selling_price", "gst_rate", "stock_quantity", "reorder_level"],
  inventory: ["product_name", "quantity", "batch_number", "notes"],
};

// Smart alias mapping: common Excel header variants → our column names
const COLUMN_ALIASES: Record<string, string> = {
  "customer name": "name", "party name": "name", "account name": "name",
  "supplier name": "name", "vendor name": "name", "item name": "name",
  "product name": "name", "product": "name", "customer": "name",
  "supplier": "name", "vendor": "name", "item": "name", "party": "name",
  "business name": "name", "first name": "name",
  "contact": "phone", "contact number": "phone", "mobile": "phone",
  "phone number": "phone", "telephone": "phone", "cell": "phone",
  "town": "city", "location": "city",
  "company name": "company", "firm": "company", "firm name": "company",
  "e-mail": "email", "email address": "email",
  "sku code": "sku", "item code": "sku", "product code": "sku", "code": "sku",
  "cost": "cost_price", "purchase price": "cost_price", "buy price": "cost_price", "cp": "cost_price",
  "price": "selling_price", "sale price": "selling_price", "sell price": "selling_price",
  "sp": "selling_price", "mrp": "selling_price", "retail price": "selling_price",
  "stock": "stock_quantity", "qty": "stock_quantity", "quantity": "stock_quantity",
  "opening stock": "stock_quantity", "current stock": "stock_quantity",
  "reorder": "reorder_level", "min stock": "reorder_level", "minimum stock": "reorder_level",
  "gst": "gst_rate", "tax rate": "gst_rate", "tax": "gst_rate",
  "credit limit": "credit_limit", "limit": "credit_limit",
  "credit days": "credit_days", "payment days": "credit_days", "days": "credit_days",
  "opening balance": "opening_balance", "balance": "opening_balance", "ob": "opening_balance",
  "opening": "opening_balance",
  "payment terms": "payment_terms_days", "payment terms days": "payment_terms_days",
  "wht": "wht_rate", "withholding tax": "wht_rate", "wht rate": "wht_rate",
  "drap": "drap_reg_number", "drap no": "drap_reg_number", "drap number": "drap_reg_number",
  "reg no": "drap_reg_number", "registration": "drap_reg_number",
  "pack": "pack_size", "packing": "pack_size",
  "batch": "batch_number", "batch no": "batch_number", "lot": "batch_number",
  "region": "area", "zone": "area",
  "last name": "__last_name",
};

function resolveColumnName(header: string, tabColumns: string[]): string | null {
  const h = header.toLowerCase().trim();
  if (tabColumns.includes(h)) return h;
  const alias = COLUMN_ALIASES[h];
  if (alias && tabColumns.includes(alias)) return alias;
  return null;
}

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

function isEmptyRow(row: string[]): boolean {
  return row.every(cell => !cell || cell.trim() === "");
}

export default function DataImport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = (searchParams.get("tab") as TabType) || "customers";
  const [tab, setTab] = useState<TabType>(defaultTab);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappedColumns, setMappedColumns] = useState<(string | null)[]>([]);
  const [importing, setImporting] = useState(false);
  const [lastBatchIds, setLastBatchIds] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const check = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };
    check();
  }, [navigate]);

  const processRows = (rawHeaders: string[], rawRows: string[][]) => {
    const cols = TAB_COLUMNS[tab];
    // Also allow "__last_name" to be resolved for first+last name concatenation
    const mapped = rawHeaders.map(h => {
      const resolved = resolveColumnName(h, cols);
      if (resolved) return resolved;
      // Check for special __last_name alias
      const alias = COLUMN_ALIASES[h.toLowerCase().trim()];
      if (alias === "__last_name") return "__last_name";
      return null;
    });
    const nonEmptyRows = rawRows.filter(r => !isEmptyRow(r));

    setHeaders(rawHeaders);
    setMappedColumns(mapped);
    setParsedRows(nonEmptyRows);
    setImportResult(null);
    setLastBatchIds([]);

    // Check if required "name" column is mapped
    const nameCol = tab === "inventory" ? "product_name" : "name";
    const hasNameCol = tab === "inventory"
      ? mapped.some(m => m === "product_name") || rawHeaders.some(h => h.toLowerCase().trim() === "product_name" || h.toLowerCase().trim() === "product name")
      : mapped.includes("name") || (mapped.includes("name") && mapped.includes("__last_name"));

    // Also check for "Business Name" fallback or "First Name" presence
    const hasFirstName = rawHeaders.some(h => h.toLowerCase().trim() === "first name");
    const hasBusinessName = rawHeaders.some(h => h.toLowerCase().trim() === "business name");
    const effectiveHasName = mapped.includes("name") || hasFirstName || hasBusinessName;

    if (!effectiveHasName && tab !== "inventory" && nonEmptyRows.length > 0) {
      setValidationWarning(`⚠️ No "${nameCol}" column detected. Found columns: ${rawHeaders.join(", ")}. Records without a name will be skipped.`);
    } else {
      setValidationWarning(null);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (rows.length > 0) {
          processRows(rows[0].map(String), rows.slice(1).map(r => r.map(String)));
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length > 0) {
          processRows(rows[0], rows.slice(1));
        }
      };
      reader.readAsText(file);
    }
  };

  const resetFile = () => { setParsedRows([]); setHeaders([]); setMappedColumns([]); setImportResult(null); setLastBatchIds([]); setValidationWarning(null); if (fileRef.current) fileRef.current.value = ""; };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    const cols = TAB_COLUMNS[tab];
    let success = 0, errors = 0;
    const importedIds: string[] = [];

    if (tab === "inventory") {
      const { data: products } = await supabase.from("products").select("id, name");
      const pMap = new Map((products || []).map(p => [p.name.toLowerCase(), p.id]));
      const batchId = crypto.randomUUID();

      for (const row of parsedRows) {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          const mapped = mappedColumns[i] || h.toLowerCase().trim();
          obj[mapped] = row[i] || "";
        });
        const pName = obj.product_name || obj.name || "";
        const productId = pMap.get(pName.toLowerCase());
        if (!productId || !pName.trim()) { errors++; continue; }
        const { data, error } = await supabase.from("stock_movements").insert({
          product_id: productId, quantity: Number(obj.quantity) || 0, movement_type: "adjustment",
          batch_number: obj.batch_number || null, notes: `IMPORT:${batchId}`,
        }).select("id").single();
        if (error) errors++; else { success++; if (data) importedIds.push(data.id); }
      }
    } else {
      const tableName = tab as "customers" | "suppliers" | "products";
      for (const row of parsedRows) {
        const obj: Record<string, any> = {};
        let lastName = "";
        headers.forEach((h, i) => {
          const mapped = mappedColumns[i];
          if (mapped === "__last_name") {
            lastName = row[i] || "";
            return;
          }
          if (mapped && cols.includes(mapped)) {
            obj[mapped] = row[i] || "";
          }
        });

        // Concatenate first + last name if last name exists
        if (lastName && obj.name) {
          obj.name = `${obj.name} ${lastName}`.trim();
        }

        // Skip rows without a name
        if (!obj.name || !String(obj.name).trim()) { errors++; continue; }

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

        const { data, error } = await supabase.from(tableName).insert(obj as any).select("id").single();
        if (error) { console.error(error); errors++; } else { success++; if (data) importedIds.push(data.id); }
      }
    }

    setLastBatchIds(importedIds);
    setImportResult({ success, errors });
    setImporting(false);
    toast.success(`Imported ${success} rows${errors > 0 ? `, ${errors} skipped/errors` : ""}`);
  };

  const handleDeleteBatch = async () => {
    if (lastBatchIds.length === 0) return;
    if (tab === "inventory") {
      // Inventory uses notes-based batch tracking
      await supabase.from("stock_movements").delete().in("id", lastBatchIds);
    } else {
      const tableName = tab as "customers" | "suppliers" | "products";
      await supabase.from(tableName).delete().in("id", lastBatchIds);
    }
    toast.success(`Deleted ${lastBatchIds.length} imported records`);
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
              <p className="text-sm text-muted-foreground">Import from CSV or Excel (.xlsx/.xls)</p>
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
                      <p className="text-xs text-muted-foreground">Accepts common variants like "Customer Name", "Party Name", "Contact", "Town", etc.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3">
                        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="text-sm" />
                        {parsedRows.length > 0 && <span className="text-xs text-muted-foreground">{parsedRows.length} rows parsed</span>}
                      </div>

                      {validationWarning && (
                        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>{validationWarning}</span>
                        </div>
                      )}

                      {parsedRows.length > 0 && mappedColumns.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {headers.map((h, i) => (
                            <span key={i} className={`text-xs px-2 py-1 rounded ${mappedColumns[i] ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                              {h} → {mappedColumns[i] || "ignored"}
                            </span>
                          ))}
                        </div>
                      )}

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
                          {importResult.errors > 0 && <div className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> {importResult.errors} skipped</div>}
                          {lastBatchIds.length > 0 && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm"><Trash2 className="h-3 w-3 mr-1" /> Delete This Batch</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete import batch?</AlertDialogTitle>
                                  <AlertDialogDescription>This will remove all {lastBatchIds.length} records created in this import.</AlertDialogDescription>
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
