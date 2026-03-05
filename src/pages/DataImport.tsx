import { useEffect, useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Trash2, CheckCircle, XCircle, AlertTriangle, FileSpreadsheet, ChevronDown, Sparkles, ArrowRight, CloudUpload, X, FileCheck } from "lucide-react";
import { toast } from "sonner";

type TabType = "customers" | "suppliers" | "products" | "inventory";

const TAB_COLUMNS: Record<TabType, string[]> = {
  customers: ["name", "company", "ntn", "strn", "phone", "email", "address", "city", "area", "credit_limit", "credit_days", "opening_balance"],
  suppliers: ["name", "company", "ntn", "strn", "phone", "email", "address", "city", "payment_terms_days", "wht_rate", "opening_balance"],
  products: ["name", "sku", "category", "drap_reg_number", "pack_size", "unit", "cost_price", "selling_price", "gst_rate", "stock_quantity", "reorder_level"],
  inventory: ["product_name", "quantity", "batch_number", "notes"],
};

const VALID_CATEGORIES = new Set(["tablet", "capsule", "syrup", "injection", "cream", "ointment", "drops", "sachet", "other"]);
const SUPPLIER_ALIASES = new Set(["supplier", "supplier name", "vendor", "vendor name"]);

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
  if (currentTab === "products" && SUPPLIER_ALIASES.has(h)) return "__supplier_name";
  if (tabColumns.includes(h)) return h;
  const alias = COLUMN_ALIASES[h];
  if (alias === "__last_name") return "__last_name";
  if (alias && tabColumns.includes(alias)) return alias;
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

const TAB_INFO: Record<TabType, { icon: string; desc: string }> = {
  customers: { icon: "👥", desc: "Customer records with contact & credit info" },
  suppliers: { icon: "🏭", desc: "Supplier records with payment terms" },
  products: { icon: "💊", desc: "Product catalog with pricing & stock" },
  inventory: { icon: "📦", desc: "Stock adjustments by product & batch" },
};

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
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [errorsOpen, setErrorsOpen] = useState(false);
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
      setValidationWarning(`No "${nameCol}" column detected. Found: ${rawHeaders.join(", ")}. Records without a name will be skipped.`);
    } else {
      setValidationWarning(null);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [tab]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const resetFile = () => {
    setParsedRows([]); setHeaders([]); setMappedColumns([]); setImportResult(null);
    setLastBatchIds([]); setValidationWarning(null); setProgress(null);
    setFileName(""); setErrorsOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  };

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

      // Category normalization for products
      if (tab === "products" && obj.category) {
        const lower = String(obj.category).toLowerCase().trim();
        obj.category = VALID_CATEGORIES.has(lower) ? lower : "other";
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
    toast.success(`Imported ${success} rows${errors > 0 ? `, ${errors} skipped` : ""}`);
  };

  const importProducts = async (
    importedIds: string[],
    report: (s: number, e: number, d: string[]) => void
  ) => {
    const rowData = buildRowObjects();
    let success = 0, errors = 0;
    const errorDetails: string[] = [];

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

  const mappedCount = mappedColumns.filter(m => m && m !== "__last_name" && m !== "__supplier_name").length;
  const specialCount = mappedColumns.filter(m => m === "__last_name" || m === "__supplier_name").length;
  const ignoredCount = mappedColumns.filter(m => !m).length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          {/* Premium Header */}
          <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-8 py-5">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-foreground font-heading tracking-tight">Data Import</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Batch-process CSV & Excel files with intelligent column mapping</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
                <span className="text-xs text-muted-foreground font-medium">Ready</span>
              </div>
            </div>
          </header>

          <div className="p-8 max-w-5xl mx-auto">
            <Tabs value={tab} onValueChange={v => { setTab(v as TabType); resetFile(); }}>
              {/* Premium Tab Pills */}
              <TabsList className="bg-secondary/50 p-1 rounded-xl mb-8 border border-border/50">
                {(["customers", "suppliers", "products", "inventory"] as TabType[]).map(t => (
                  <TabsTrigger
                    key={t}
                    value={t}
                    className="data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-foreground rounded-lg px-5 py-2.5 text-sm font-medium transition-all"
                  >
                    <span className="mr-1.5">{TAB_INFO[t].icon}</span>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>

              {(["customers", "suppliers", "products", "inventory"] as TabType[]).map(t => (
                <TabsContent key={t} value={t} className="space-y-6 animate-fade-in">

                  {/* Upload Zone */}
                  {parsedRows.length === 0 ? (
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onClick={() => fileRef.current?.click()}
                      className={`
                        relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-12
                        ${isDragging
                          ? "border-primary bg-primary/5 scale-[1.01]"
                          : "border-border/60 hover:border-primary/40 hover:bg-accent/30"
                        }
                      `}
                    >
                      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
                      <div className="flex flex-col items-center text-center space-y-4">
                        <div className={`
                          w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
                          ${isDragging ? "bg-primary/10 text-primary scale-110" : "bg-secondary text-muted-foreground"}
                        `}>
                          <CloudUpload className="h-8 w-8" />
                        </div>
                        <div>
                          <p className="text-base font-semibold text-foreground font-heading">
                            {isDragging ? "Drop your file here" : "Upload your spreadsheet"}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Drag & drop or click to browse · CSV, XLSX, XLS
                          </p>
                        </div>

                        {/* Expected columns preview */}
                        <div className="pt-4 border-t border-border/40 w-full max-w-lg">
                          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Expected columns</p>
                          <div className="flex flex-wrap justify-center gap-1.5">
                            {TAB_COLUMNS[t].map(col => (
                              <span key={col} className="text-[11px] px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">
                                {col}
                              </span>
                            ))}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-3">
                            Also accepts common variants: "Customer Name", "Party Name", "Contact", "Town", etc.
                          </p>
                          {t === "products" && (
                            <p className="text-[11px] text-primary font-medium mt-2 flex items-center justify-center gap-1">
                              <Sparkles className="h-3 w-3" /> "Supplier" column auto-creates supplier records
                            </p>
                          )}
                          {t === "inventory" && (
                            <p className="text-[11px] text-primary font-medium mt-2 flex items-center justify-center gap-1">
                              <Sparkles className="h-3 w-3" /> Missing products auto-created during import
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* File Info Card */}
                      <div className="glass-card rounded-2xl p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                              <FileSpreadsheet className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{fileName}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground">{parsedRows.length} rows</span>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground">{headers.length} columns</span>
                                <span className="text-xs text-muted-foreground">·</span>
                                <span className="text-xs text-primary font-medium">{mappedCount} mapped</span>
                                {specialCount > 0 && (
                                  <>
                                    <span className="text-xs text-muted-foreground">·</span>
                                    <span className="text-xs text-warning font-medium">{specialCount} special</span>
                                  </>
                                )}
                                {ignoredCount > 0 && (
                                  <>
                                    <span className="text-xs text-muted-foreground">·</span>
                                    <span className="text-xs text-muted-foreground">{ignoredCount} ignored</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={resetFile} className="text-muted-foreground hover:text-destructive">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Validation Warning */}
                      {validationWarning && (
                        <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-xl">
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                          <span className="text-sm text-destructive">{validationWarning}</span>
                        </div>
                      )}

                      {/* Column Mapping Badges */}
                      <div className="glass-card rounded-2xl p-5">
                        <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3 font-heading">Column Mapping</p>
                        <div className="flex flex-wrap gap-2">
                          {headers.map((h, i) => {
                            const m = mappedColumns[i];
                            const isSpecial = m === "__supplier_name" || m === "__last_name";
                            const label = m === "__supplier_name" ? "auto-create supplier" :
                                          m === "__last_name" ? "append to name" :
                                          m ? m : "ignored";
                            return (
                              <div
                                key={i}
                                className={`
                                  inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all
                                  ${isSpecial
                                    ? "bg-warning/10 text-warning border border-warning/20"
                                    : m
                                      ? "bg-primary/8 text-primary border border-primary/15"
                                      : "bg-muted text-muted-foreground border border-border/50"
                                  }
                                `}
                              >
                                <span className="opacity-70">{h}</span>
                                <ArrowRight className="h-3 w-3 opacity-50" />
                                <span>{label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Data Preview Table */}
                      <div className="glass-card rounded-2xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground uppercase tracking-wider font-heading">Data Preview</p>
                          <span className="text-[11px] text-muted-foreground">
                            Showing {Math.min(20, parsedRows.length)} of {parsedRows.length}
                          </span>
                        </div>
                        <ScrollArea className="max-h-72">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                                {headers.map((h, i) => (
                                  <TableHead key={i} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {parsedRows.slice(0, 20).map((row, i) => (
                                <TableRow key={i} className={i % 2 === 0 ? "bg-transparent" : "bg-secondary/20"}>
                                  {row.map((cell, j) => (
                                    <TableCell key={j} className="text-xs py-2 whitespace-nowrap">{cell}</TableCell>
                                  ))}
                                </TableRow>
                              ))}
                              {parsedRows.length > 20 && (
                                <TableRow>
                                  <TableCell colSpan={headers.length} className="text-center text-xs text-muted-foreground py-3">
                                    ...and {parsedRows.length - 20} more rows
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>

                      {/* Progress Bar */}
                      {progress && (
                        <div className="glass-card rounded-2xl p-5 space-y-3">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
                              <span className="text-sm font-medium text-foreground">Importing data...</span>
                            </div>
                            <span className="text-sm font-semibold text-primary tabular-nums">
                              {progress.current} / {progress.total}
                            </span>
                          </div>
                          <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
                              style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Import Actions */}
                      {!progress && !importResult && (
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={handleImport}
                            disabled={importing}
                            size="lg"
                            className="rounded-xl px-8 shadow-md hover:shadow-lg transition-all"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {importing ? "Processing..." : `Import ${parsedRows.length} Records`}
                          </Button>
                          <Button variant="outline" onClick={resetFile} size="lg" className="rounded-xl">
                            Cancel
                          </Button>
                        </div>
                      )}

                      {/* Import Results */}
                      {importResult && (
                        <div className="space-y-4">
                          <div className="glass-card-glow rounded-2xl p-6">
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                  <FileCheck className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <p className="text-2xl font-bold text-primary tabular-nums font-heading">{importResult.success}</p>
                                  <p className="text-xs text-muted-foreground font-medium">Records imported</p>
                                </div>
                              </div>

                              {importResult.errors > 0 && (
                                <div className="flex items-center gap-3 pl-6 border-l border-border">
                                  <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                                    <XCircle className="h-5 w-5 text-destructive" />
                                  </div>
                                  <div>
                                    <p className="text-2xl font-bold text-destructive tabular-nums font-heading">{importResult.errors}</p>
                                    <p className="text-xs text-muted-foreground font-medium">Skipped</p>
                                  </div>
                                </div>
                              )}

                              <div className="flex-1" />

                              {lastBatchIds.length > 0 && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="rounded-xl text-destructive border-destructive/20 hover:bg-destructive/5">
                                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Undo Import
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete import batch?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will remove all {lastBatchIds.length} records created in this import.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={handleDeleteBatch}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}

                              <Button variant="outline" size="sm" className="rounded-xl" onClick={resetFile}>
                                Import More
                              </Button>
                            </div>
                          </div>

                          {/* Error Details Collapsible */}
                          {importResult.details.length > 0 && (
                            <Collapsible open={errorsOpen} onOpenChange={setErrorsOpen}>
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center justify-between p-4 rounded-xl border border-destructive/15 bg-destructive/5 hover:bg-destructive/8 transition-colors cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                    <span className="text-sm font-medium text-destructive">
                                      {importResult.details.length} error{importResult.details.length > 1 ? "s" : ""} — click to expand
                                    </span>
                                  </div>
                                  <ChevronDown className={`h-4 w-4 text-destructive transition-transform ${errorsOpen ? "rotate-180" : ""}`} />
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="mt-2 p-4 rounded-xl border border-destructive/15 bg-destructive/5 space-y-1.5">
                                  {importResult.details.map((d, i) => (
                                    <p key={i} className="text-xs text-destructive/80 font-mono">• {d}</p>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
