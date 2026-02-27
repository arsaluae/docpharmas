import type { CompanySettings } from "@/hooks/useCompanySettings";

interface PdfColumn { header: string; key: string; align?: "left" | "right" | "center"; }
interface PdfMeta { label: string; value: string; }
interface PdfOptions {
  title: string;
  documentNumber: string;
  date: string;
  partyLabel?: string;
  partyName?: string;
  partyAddress?: string;
  meta?: PdfMeta[];
  columns: PdfColumn[];
  rows: Record<string, any>[];
  totals?: PdfMeta[];
  notes?: string;
  settings: CompanySettings | null;
}

export function generatePdf(opts: PdfOptions) {
  const s = opts.settings;
  const logoHtml = s?.logo_url
    ? `<img src="${s.logo_url}" style="max-height:70px;max-width:180px;object-fit:contain;" />`
    : "";

  const companyHtml = `
    <div style="text-align:right;">
      <div style="font-size:18px;font-weight:bold;">${s?.company_name || "Company Name"}</div>
      ${s?.address ? `<div style="font-size:11px;color:#555;">${s.address}</div>` : ""}
      <div style="font-size:11px;color:#555;">
        ${[s?.phone, s?.email, s?.website].filter(Boolean).join(" | ")}
      </div>
      ${s?.ntn ? `<div style="font-size:10px;color:#888;">NTN: ${s.ntn}${s?.strn ? ` | STRN: ${s.strn}` : ""}</div>` : ""}
    </div>
  `;

  const metaHtml = [
    { label: opts.title + " #", value: opts.documentNumber },
    { label: "Date", value: opts.date },
    ...(opts.partyName ? [{ label: opts.partyLabel || "Party", value: opts.partyName }] : []),
    ...(opts.partyAddress ? [{ label: "Address", value: opts.partyAddress }] : []),
    ...(opts.meta || []),
  ].map(m => `<tr><td style="padding:2px 8px 2px 0;font-weight:600;font-size:12px;color:#333;">${m.label}:</td><td style="font-size:12px;">${m.value}</td></tr>`).join("");

  const thStyle = `style="border-bottom:2px solid #333;padding:8px 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#333;"`;
  const tdStyle = (align: string) => `style="padding:6px;font-size:12px;border-bottom:1px solid #eee;text-align:${align};"`;

  const headerRow = opts.columns.map(c => `<th ${thStyle} style="text-align:${c.align || 'left'};">${c.header}</th>`).join("");
  const bodyRows = opts.rows.map(row =>
    `<tr>${opts.columns.map(c => `<td ${tdStyle(c.align || 'left')}>${row[c.key] ?? ""}</td>`).join("")}</tr>`
  ).join("");

  const totalsHtml = opts.totals
    ? opts.totals.map(t => `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px;"><span>${t.label}</span><span style="font-family:monospace;">${t.value}</span></div>`).join("")
    : "";

  const html = `<!DOCTYPE html><html><head><title>${opts.title} - ${opts.documentNumber}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; padding:30px; color:#222; }
  @media print { body { padding:15px; } @page { margin:15mm; } }
  table { width:100%; border-collapse:collapse; }
</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:3px solid #333;padding-bottom:15px;">
    <div>${logoHtml}</div>
    ${companyHtml}
  </div>
  <h2 style="text-align:center;font-size:16px;text-transform:uppercase;letter-spacing:2px;margin:15px 0;color:#333;">${opts.title}</h2>
  <table style="margin-bottom:20px;"><tbody>${metaHtml}</tbody></table>
  <table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
  ${totalsHtml ? `<div style="margin-top:15px;border-top:2px solid #333;padding-top:10px;max-width:300px;margin-left:auto;">${totalsHtml}</div>` : ""}
  ${opts.notes ? `<div style="margin-top:20px;padding:10px;background:#f9f9f9;border-radius:4px;font-size:11px;"><strong>Notes:</strong> ${opts.notes}</div>` : ""}
  <div style="margin-top:40px;display:flex;justify-content:space-between;">
    <div style="border-top:1px solid #999;width:200px;text-align:center;padding-top:5px;font-size:11px;">Prepared By</div>
    <div style="border-top:1px solid #999;width:200px;text-align:center;padding-top:5px;font-size:11px;">Authorized Signature</div>
  </div>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}
