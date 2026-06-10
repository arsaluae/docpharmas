// Generate downloadable XLSX templates per entity. Two sheets:
// `Data` (header row + example rows) and `Instructions` (field guide).

import * as XLSX from "xlsx";
import { ENTITIES, EntityType } from "./types";

export function buildTemplate(entity: EntityType, filled = true): Blob {
  const spec = ENTITIES[entity];
  const headers = spec.fields.map(f => f.key);

  const dataRows: (string | number)[][] = [headers];
  if (filled) {
    for (const ex of spec.example) {
      dataRows.push(headers.map(h => (ex[h] ?? "") as string | number));
    }
  } else {
    dataRows.push(headers.map(() => ""));
  }
  const wsData = XLSX.utils.aoa_to_sheet(dataRows);
  wsData["!cols"] = headers.map(() => ({ wch: 20 }));

  const instr: (string | number)[][] = [
    ["Field", "Label", "Type", "Required", "Allowed values / Notes"],
    ...spec.fields.map(f => [
      f.key,
      f.label,
      f.type,
      f.required ? "YES" : "no",
      f.enumValues ? f.enumValues.join(" | ") : (f.help ?? ""),
    ]),
    [],
    ["About this importer", spec.description],
    spec.groupBy ? ["Grouped by", `Rows are grouped into one record by "${spec.groupBy}"`] : ["", ""],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instr);
  wsInstr["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, "Data");
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instructions");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadTemplate(entity: EntityType, filled = true) {
  const blob = buildTemplate(entity, filled);
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `${entity}_template${filled ? "_with_examples" : ""}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadFailedRowsCsv(
  entity: EntityType,
  rows: { rowNumber: number; raw: Record<string, unknown>; errors: { field: string; message: string }[] }[],
) {
  if (rows.length === 0) return;
  const fields = ENTITIES[entity].fields.map(f => f.key);
  const head = ["row_number", ...fields, "errors"];
  const lines = [head.join(",")];
  for (const r of rows) {
    const cells = [
      String(r.rowNumber),
      ...fields.map(f => csvEscape(r.raw[f])),
      csvEscape(r.errors.map(e => `${e.field}: ${e.message}`).join(" | ")),
    ];
    lines.push(cells.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `${entity}_failed_rows.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
