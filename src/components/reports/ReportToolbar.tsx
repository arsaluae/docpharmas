import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Printer, Copy } from "lucide-react";
import { toast } from "sonner";
import { exportReportToExcel } from "@/lib/reports/excel";
import { exportReportToCsv, copyReportToClipboard } from "@/lib/reports/csv";
import { getReportMeta } from "@/lib/reports/meta";
import type { ReportColumn } from "@/lib/reports/excel";

interface Props {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  totalsRow?: Record<string, any>;
  dateRange?: { from?: string; to?: string };
  filters?: { label: string; value: string }[];
}

export function ReportToolbar({ title, columns, rows, totalsRow, dateRange, filters }: Props) {
  const build = async () => ({
    title,
    columns,
    rows,
    totalsRow,
    meta: await getReportMeta({ dateRange, filters }),
  });

  const onExcel = async () => {
    try { exportReportToExcel(await build()); }
    catch (e: any) { toast.error("Excel export failed: " + (e?.message || "unknown")); }
  };
  const onCsv = async () => {
    try { exportReportToCsv(await build()); }
    catch (e: any) { toast.error("CSV export failed"); }
  };
  const onCopy = async () => {
    try { await copyReportToClipboard(await build()); toast.success("Copied"); }
    catch { toast.error("Copy failed"); }
  };
  const onPrint = () => window.print();

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onExcel}><FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Excel</Button>
      <Button variant="outline" size="sm" onClick={onCsv}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
      <Button variant="outline" size="sm" onClick={onCopy}><Copy className="h-3.5 w-3.5 mr-1" />Copy</Button>
      <Button variant="outline" size="sm" onClick={onPrint}><Printer className="h-3.5 w-3.5 mr-1" />Print</Button>
    </div>
  );
}
