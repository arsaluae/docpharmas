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
import { Progress } from "@/components/ui/progress";
import { Upload, Trash2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type TabType = "customers" | "suppliers" | "products" | "inventory";

const TAB_COLUMNS: Record<TabType, string[]> = {
  customers: ["name", "company", "ntn", "strn", "phone", "email", "address", "city", "area", "credit_limit", "credit_days", "opening_balance"],
  suppliers: ["name", "company", "ntn", "strn", "phone", "email", "address", "city", "payment_terms_days", "wht_rate", "opening_balance"],
  products: ["name", "sku", "category", "drap_reg_number", "pack_size", "unit", "cost_price", "selling_price", "gst_rate", "stock_quantity", "reorder_level"],
  inventory: ["product_name", "quantity", "batch_number", "notes"],
};

// Aliases that conflict on certain tabs — these get special handling
const SUPPLIER_ALIASES = new Set(["supplier", "supplier name", "vendor", "vendor name"]);

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

function resolveColumnName(header: string, tabColumns: string[], currentTab: TabType): string | null {
  const h = header.toLowerCase().trim();

  // On products tab, supplier-related headers should NOT map to "name"
  if (currentTab === "products" && SUPPLIER_ALIASES.has(h)) {
    return "__supplier_name";
  }

  if (tabColumns.includes(h)) return h;
  const alias = COLUMN_ALIASES[h];
  if (alias === "__last_name") return "__last_name";
  if (alias && tabColumns.includes(alias)) return alias;

  // For inventory tab, allow "product name" → "product_name"
  if (currentTab === "inventory") {
    if (h === "product name" || h === "product" || h === "item" || h === "item name") return "product_name";
  }

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

const CHUNK_SIZE = 100;

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
  const [importResult, setImportResult] = useState<{ success: number; errors: number; details: string[] } | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const check = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };
    check();
  }, [navigate]);

  const processRows = (rawHeaders: string[], rawRows: string[][]) => {
    const cols = TAB_COLUMNS[tab];
    const mapped = rawHeaders.map(h => resolveColumnName(h, cols, tab));
    const nonEmptyRows = rawRows.filter(r => !isEmptyRow(r));

    setHeaders(rawHeaders);
    setMappedColumns(mapped);
    setParsedRows(nonEmptyRows);
    setImportResult(null);
    setLastBatchIds([]);

    const nameCol = tab === "inventory" ? "product_name" : "name";
    const hasNameCol = mapped.includes(nameCol) || mapped.includes("name");
    const hasFirstName = rawHeaders.some(h => h.toLowerCase().trim() === "first name");
    const hasBusinessName = rawHeaders.some(h => h.toLowerCase().trim() === "business name");
    const effectiveHasName = hasNameCol || hasFirstName || hasBusinessName;

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

  const resetFile = () => {
    setParsedRows([]); setHeaders([]); setMappedColumns([]); setImportResult(null);
    setLastBatchIds([]); setValidationWarning(null); setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Build row objects from parsed data
  const buildRowObjects = () => {
    const cols = TAB_COLUMNS[tab];
    const numericFields: Record<TabType, string[]> = {
      customers: ["credit_limit", "credit_days", "opening_balance"],
      suppliers: ["payment_terms_days", "wht_rate", "opening_balance"],
      products: ["cost_price", "selling_price", "gst_rate", "stock_quantity", "reorder_level"],
      inventory: ["quantity"],
    };

    return parsedRows.map(row => {
      const obj: Record<string, any> = {};
      let lastName = "";
      let supplierName = "";

      headers.forEach((h, i) => {
        const mapped = mappedColumns[i];
        if (mapped === "__last_name") { lastName = row[i] || ""; return; }
        if (mapped === "__supplier_name") { supplierName = row[i] || ""; return; }
        if (mapped && (cols.includes(mapped) || mapped === "product_name")) {
          const val = row[i] || "";
          if (val || !obj[mapped]) obj[mapped] = val;
        }
      });

      if (lastName) {
        obj.name = obj.name ? `${obj.name} ${lastName}`.trim() : lastName.trim();
      }

      numericFields[tab]?.forEach(f => {
        if (obj[f] !== undefined && obj[f] !== "") obj[f] = Number(obj[f]) || 0;
      });

      return { obj, supplierName };
    });
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setProgress({ current: 0, total: parsedRows.length });
    const importedIds: string[] = [];
    let success = 0, errors = 0;
    const errorDetails: string[] = [];

    try {
      if (tab === "inventory") {
        await importInventory(importedIds, (s, e, d) => { success = s; errors = e; errorDetails.push(...d); });
      } else if (tab === "products") {
        await importProducts(importedIds, (s, e, d) => { success = s; errors = e; errorDetails.push(...d); });
      } else {
        await importCustomersOrSuppliers(importedIds, (s, e, d) => { success = s; errors = e; errorDetails.push(...d); });
      }
    } catch (err: any) {
      errorDetails.push(`Unexpected error: ${err.message}`);
    }

    setLastBatchIds(importedIds);
    setImportResult({ success, errors, details: errorDetails.slice(0, 10) });
    setImporting(false);
    setProgress(null);
    toast.success(`Imported ${success} rows${errors > 0 ? `, ${errors} skipped/errors` : ""}`);
  };

  const importProducts = async (
    importedIds: string[],
    report: (s: number, e: number, d: string[]) => void
  ) => {
    const rowData = buildRowObjects();
    let success = 0, errors = 0;
    const errorDetails: string[] = [];

    // 1. Auto-create suppliers from data
    const supplierNames = [...new Set(rowData.map(r => r.supplierName).filter(n => n.trim()))];
    let suppliersCreated = 0;

    if (supplierNames.length > 0) {
      const { data: existing } = await supabase.from("suppliers").select("name");
      const existingSet = new Set((existing || []).map(s => s.name.toLowerCase()));
      const newSuppliers = supplierNames
        .filter(n => !existingSet.has(n.toLowerCase()))
        .map(n => ({ name: n }));

      if (newSuppliers.length > 0) {
        for (let i = 0; i < newSuppliers.length; i += CHUNK_SIZE) {
          const chunk = newSuppliers.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from("suppliers").insert(chunk as any);
          if (!error) suppliersCreated += chunk.length;
        }
        if (suppliersCreated > 0) {
          toast.info(`Also created ${suppliersCreated} new suppliers from your data`);
        }
      }
    }

    // 2. Batch insert products
    const validRows: Record<string, any>[] = [];
    rowData.forEach((r, idx) => {
      if (!r.obj.name || !String(r.obj.name).trim()) {
        errors++;
        errorDetails.push(`Row ${idx + 2}: missing product name`);
        return;
      }
      validRows.push(r.obj);
    });

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase.from("products").insert(chunk as any).select("id");
      if (error) {
        errors += chunk.length;
        errorDetails.push(`Batch ${Math.floor(i / CHUNK_SIZE) + 1}: ${error.message}`);
      } else {
        success += (data?.length || 0);
        importedIds.push(...(data || []).map(d => d.id));
      }
      setProgress({ current: Math.min(i + CHUNK_SIZE, validRows.length + (rowData.length - validRows.length)), total: rowData.length });
    }

    report(success, errors, errorDetails);
  };

  const importCustomersOrSuppliers = async (
    importedIds: string[],
    report: (s: number, e: number, d: string[]) => void
  ) => {
    const tableName = tab as "customers" | "suppliers";
    const rowData = buildRowObjects();
    let success = 0, errors = 0;
    const errorDetails: string[] = [];

    const validRows: Record<string, any>[] = [];
    rowData.forEach((r, idx) => {
      if (!r.obj.name || !String(r.obj.name).trim()) {
        errors++;
        errorDetails.push(`Row ${idx + 2}: missing name`);
        return;
      }
      const obj = { ...r.obj };
      obj.balance = obj.opening_balance || 0;
      validRows.push(obj);
    });

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase.from(tableName).insert(chunk as any).select("id");
      if (error) {
        errors += chunk.length;
        errorDetails.push(`Batch ${Math.floor(i / CHUNK_SIZE) + 1}: ${error.message}`);
      } else {
        success += (data?.length || 0);
        importedIds.push(...(data || []).map(d => d.id));
      }
      setProgress({ current: Math.min(i + CHUNK_SIZE, validRows.length + (rowData.length - validRows.length)), total: rowData.length });
    }

    report(success, errors, errorDetails);
  };

  const importInventory = async (
    importedIds: string[],
    report: (s: number, e: number, d: string[]) => void
  ) => {
    const { data: products } = await supabase.from("products").select("id, name");
    const pMap = new Map((products || []).map(p => [p.name.toLowerCase(), p.id]));
    const batchId = crypto.randomUUID();
    const rowData = buildRowObjects();
    let success = 0, errors = 0;
    const errorDetails: string[] = [];

    // Auto-create missing products
    const missingProducts = new Set<string>();
    rowData.forEach(r => {
      const pName = r.obj.product_name || r.obj.name || "";
      if (pName.trim() && !pMap.has(pName.toLowerCase())) {
        missingProducts.add(pName.trim());
      }
    });

    if (missingProducts.size > 0) {
      const newProducts = [...missingProducts].map(n => ({ name: n }));
      for (let i = 0; i < newProducts.length; i += CHUNK_SIZE) {
        const chunk = newProducts.slice(i, i + CHUNK_SIZE);
        const { data } = await supabase.from("products").insert(chunk as any).select("id, name");
        if (data) data.forEach(p => pMap.set(p.name.toLowerCase(), p.id));
      }
      toast.info(`Auto-created ${missingProducts.size} new products for inventory`);
    }

    // Batch insert stock movements
    const validRows: any[] = [];
    rowData.forEach((r, idx) => {
      const pName = r.obj.product_name || r.obj.name || "";
      const productId = pMap.get(pName.toLowerCase());
      if (!productId || !pName.trim()) {
        errors++;
        errorDetails.push(`Row ${idx + 2}: product "${pName}" not found`);
        return;
      }
      validRows.push({
        product_id: productId,
        quantity: Number(r.obj.quantity) || 0,
        movement_type: "adjustment",
        batch_number: r.obj.batch_number || null,
        notes: `IMPORT:${batchId}`,
      });
    });

    for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
      const chunk = validRows.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase.from("stock_movements").insert(chunk).select("id");
      if (error) {
        errors += chunk.length;
        errorDetails.push(`Batch ${Math.floor(i / CHUNK_SIZE) + 1}: ${error.message}`);
      } else {
        success += (data?.length || 0);
        importedIds.push(...(data || []).map(d => d.id));
      }
      setProgress({ current: Math.min(i + CHUNK_SIZE, validRows.length + (rowData.length - validRows.length)), total: rowData.length });
    }

    report(success, errors, errorDetails);
  };

  const handleDeleteBatch = async () => {
    if (lastBatchIds.length === 0) return;
    if (tab === "inventory") {
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
              <p className="text-sm text-muted-foreground">Import from CSV or Excel (.xlsx/.xls) — batch processed for speed</p>
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
                      {t === "products" && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          ✨ If your file has a "Supplier" column, suppliers will be auto-created!
                        </p>
                      )}
                      {t === "inventory" && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          ✨ Missing products will be auto-created during inventory import
                        </p>
                      )}
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
                          {headers.map((h, i) => {
                            const m = mappedColumns[i];
                            const label = m === "__supplier_name" ? "→ auto-create supplier" :
                                          m === "__last_name" ? "→ append to name" :
                                          m ? `→ ${m}` : "→ ignored";
                            const isSpecial = m === "__supplier_name" || m === "__last_name";
                            return (
                              <span key={i} className={`text-xs px-2 py-1 rounded ${
                                isSpecial ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" :
                                m ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {h} {label}
                              </span>
                            );
                          })}
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

                          {progress && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Importing...</span>
                                <span>{progress.current} / {progress.total}</span>
                              </div>
                              <Progress value={(progress.current / progress.total) * 100} className="h-2" />
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <Button onClick={handleImport} disabled={importing}>
                              <Upload className="h-4 w-4 mr-1" /> {importing ? "Importing..." : "Import Batch"}
                            </Button>
                            <Button variant="outline" onClick={resetFile}>Clear</Button>
                          </div>
                        </>
                      )}

                      {importResult && (
                        <div className="space-y-2">
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
                          {importResult.details.length > 0 && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs space-y-1">
                              <p className="font-medium text-amber-800 dark:text-amber-200">Error details:</p>
                              {importResult.details.map((d, i) => (
                                <p key={i} className="text-amber-700 dark:text-amber-300">• {d}</p>
                              ))}
                            </div>
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
