import { describe, expect, it } from "vitest";
import { isPosted, NOT_POSTED_IN_LITERAL, NOT_POSTED_STATUSES } from "@/lib/reports/posted";
import { buildReportCsv } from "@/lib/reports/csv";
import { buildReportWorkbook } from "@/lib/reports/excel";
import type { ReportMeta } from "@/lib/reports/meta";

const meta: ReportMeta = {
  company: "Acme Pharma",
  user: "tester@acme.test",
  generatedAt: "2026-06-10T20:00:00.000Z",
  dateRange: { from: "2026-05-01", to: "2026-06-01" },
};

const sampleRows = [
  { invoice: "INV-1", outstanding: 1000 },
  { invoice: "INV-2", outstanding: 250.5 },
  { invoice: "INV-3", outstanding: 749.5 },
];
const columns = [
  { key: "invoice", header: "Invoice", type: "text" as const },
  { key: "outstanding", header: "Outstanding", type: "currency" as const },
];
const onScreenTotal = sampleRows.reduce((s, r) => s + r.outstanding, 0);

describe("posted-only filter rule", () => {
  it("uses the locked draft/voided/cancelled allow-list", () => {
    expect(NOT_POSTED_STATUSES).toEqual(["draft", "voided", "cancelled"]);
    expect(NOT_POSTED_IN_LITERAL).toBe("(draft,voided,cancelled)");
  });

  it("rejects rows that should not appear in reports", () => {
    expect(isPosted({ status: "draft" })).toBe(false);
    expect(isPosted({ status: "voided" })).toBe(false);
    expect(isPosted({ status: "cancelled" })).toBe(false);
  });

  it("admits posted invoices, returns, payments", () => {
    for (const s of ["dispatched", "paid", "partial", "unpaid", "active", "posted"]) {
      expect(isPosted({ status: s })).toBe(true);
    }
  });

  it("treats missing status as posted (no leak from legacy rows)", () => {
    expect(isPosted({})).toBe(true);
    expect(isPosted({ status: null })).toBe(true);
  });
});

describe("report exporters preserve on-screen totals", () => {
  it("CSV totals row equals the sum of data rows", () => {
    const csv = buildReportCsv({
      title: "Receivables Aging",
      columns,
      rows: sampleRows,
      totalsRow: { invoice: "TOTAL", outstanding: onScreenTotal },
      meta,
    });
    const totalLine = csv.trim().split("\n").pop()!;
    expect(totalLine).toBe(`TOTAL,${onScreenTotal}`);
  });

  it("Excel workbook writes a bold totals row equal to on-screen totals", () => {
    const wb = buildReportWorkbook({
      title: "Receivables Aging",
      columns,
      rows: sampleRows,
      totalsRow: { invoice: "TOTAL", outstanding: onScreenTotal },
      meta,
    });
    const ws = wb.Sheets[wb.SheetNames[0]];
    // Header block = 5 rows, headers row = row 6 (0-indexed 5), data starts row 7 (idx 6)
    // 3 data rows + totals → totals row index = 5 + 1 + 3 = 9 (0-indexed)
    const totalsAddr = "B10";
    expect(ws[totalsAddr]).toBeDefined();
    expect(ws[totalsAddr].v).toBe(onScreenTotal);
    expect(ws[totalsAddr].t).toBe("n");
    expect(ws[totalsAddr].s?.font?.bold).toBe(true);
  });
});
