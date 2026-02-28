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
  partyPhone?: string;
  partyNtn?: string;
  meta?: PdfMeta[];
  columns: PdfColumn[];
  rows: Record<string, any>[];
  totals?: PdfMeta[];
  notes?: string;
  settings: CompanySettings | null;
}

export function generatePdf(opts: PdfOptions) {
  const s = opts.settings;
  const companyName = s?.company_name || "Company Name";

  const logoHtml = s?.logo_url
    ? `<img src="${s.logo_url}" style="max-height:80px;max-width:200px;object-fit:contain;" />`
    : `<div style="font-size:28px;font-weight:800;color:#1a1a2e;font-family:'Georgia',serif;letter-spacing:1px;">${companyName}</div>`;

  const companyDetails = [
    s?.address,
    [s?.phone, s?.email].filter(Boolean).join(" • "),
    s?.website,
    s?.ntn ? `NTN: ${s.ntn}` : null,
    s?.strn ? `STRN: ${s.strn}` : null,
  ].filter(Boolean);

  const partyRows = [
    opts.partyName ? `<div style="font-size:15px;font-weight:700;color:#1a1a2e;">${opts.partyName}</div>` : "",
    opts.partyAddress ? `<div style="font-size:12px;color:#555;margin-top:2px;">${opts.partyAddress}</div>` : "",
    opts.partyPhone ? `<div style="font-size:12px;color:#555;">${opts.partyPhone}</div>` : "",
    opts.partyNtn ? `<div style="font-size:11px;color:#888;margin-top:2px;">${opts.partyNtn}</div>` : "",
  ].filter(Boolean).join("");

  const metaItems = [
    { label: "Document #", value: opts.documentNumber },
    { label: "Date", value: opts.date },
    ...(opts.meta || []),
  ];

  const thAlign = (c: PdfColumn) => c.align || "left";

  const headerCells = opts.columns.map(c =>
    `<th style="padding:10px 8px;text-align:${thAlign(c)};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#fff;border-bottom:2px solid #c9a84c;">${c.header}</th>`
  ).join("");

  const bodyRows = opts.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8f7f4";
    const cells = opts.columns.map(c =>
      `<td style="padding:8px;font-size:12px;text-align:${thAlign(c)};border-bottom:1px solid #e8e6e1;color:#333;">${row[c.key] ?? ""}</td>`
    ).join("");
    return `<tr style="background:${bg};">${cells}</tr>`;
  }).join("");

  const totalsHtml = opts.totals
    ? opts.totals.map((t, i) => {
        const isLast = i === opts.totals!.length - 1;
        const weight = isLast ? "800" : "500";
        const size = isLast ? "15px" : "12px";
        const border = isLast ? "border-top:2px solid #1a1a2e;" : "";
        const bg = isLast ? "background:#f0efe8;" : "";
        return `<div style="display:flex;justify-content:space-between;padding:6px 12px;font-size:${size};font-weight:${weight};${border}${bg}">
          <span style="color:#555;">${t.label}</span>
          <span style="color:#1a1a2e;font-family:'Courier New',monospace;">${t.value}</span>
        </div>`;
      }).join("")
    : "";

  const html = `<!DOCTYPE html><html><head>
<title>${opts.title} - ${opts.documentNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter','Segoe UI',sans-serif; color:#222; background:#fff; }
  
  .page-frame {
    max-width:800px; margin:0 auto; padding:40px 45px;
    border:1px solid #d4d0c8;
    position:relative;
  }
  .page-frame::before {
    content:''; position:absolute; top:4px; left:4px; right:4px; bottom:4px;
    border:1px solid #e8e6e1; pointer-events:none;
  }

  @media print {
    body { padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page-frame { border:none; padding:20px 25px; max-width:100%; }
    .page-frame::before { display:none; }
    @page { margin:12mm 10mm; size:A4; }
  }
</style>
</head><body>
<div class="page-frame">

  <!-- LETTERHEAD -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;">
    <div>${logoHtml}</div>
    <div style="text-align:right;">
      ${!s?.logo_url ? "" : `<div style="font-size:20px;font-weight:800;color:#1a1a2e;font-family:'Georgia',serif;letter-spacing:0.5px;">${companyName}</div>`}
      ${companyDetails.map((d, i) => `<div style="font-size:${i === 0 ? '11' : '10'}px;color:#666;line-height:1.6;">${d}</div>`).join("")}
    </div>
  </div>
  <!-- Gold accent line -->
  <div style="height:3px;background:linear-gradient(90deg,#c9a84c,#e8d48b,#c9a84c);margin-bottom:20px;border-radius:2px;"></div>

  <!-- DOCUMENT TITLE -->
  <div style="text-align:center;margin-bottom:20px;">
    <div style="display:inline-block;padding:8px 30px;border:2px solid #1a1a2e;position:relative;">
      <div style="position:absolute;top:-1px;left:20%;right:20%;height:3px;background:#c9a84c;"></div>
      <div style="font-size:16px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:#1a1a2e;">${opts.title}</div>
    </div>
  </div>

  <!-- PARTY INFO + META — Two columns -->
  <div style="display:flex;gap:20px;margin-bottom:24px;">
    <!-- Left: Document meta -->
    <div style="flex:1;">
      <table style="width:100%;">
        ${metaItems.map(m => `<tr>
          <td style="padding:4px 10px 4px 0;font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;width:100px;">${m.label}</td>
          <td style="padding:4px 0;font-size:13px;font-weight:600;color:#1a1a2e;">${m.value}</td>
        </tr>`).join("")}
      </table>
    </div>
    <!-- Right: Party details -->
    ${partyRows ? `<div style="flex:1;border:1px solid #e8e6e1;border-left:3px solid #c9a84c;padding:12px 16px;border-radius:0 4px 4px 0;">
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#c9a84c;margin-bottom:6px;">${opts.partyLabel || "Party"}</div>
      ${partyRows}
    </div>` : ""}
  </div>

  <!-- ITEMS TABLE -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr style="background:#1a1a2e;">${headerCells}</tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <!-- TOTALS -->
  ${totalsHtml ? `<div style="margin-left:auto;max-width:280px;border:1px solid #e8e6e1;border-radius:4px;overflow:hidden;">${totalsHtml}</div>` : ""}

  <!-- NOTES -->
  ${opts.notes ? `<div style="margin-top:24px;padding:12px 16px;background:#faf9f6;border-left:3px solid #c9a84c;border-radius:0 4px 4px 0;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#c9a84c;margin-bottom:4px;">Notes / Terms</div>
    <div style="font-size:11px;color:#555;line-height:1.5;">${opts.notes}</div>
  </div>` : ""}

  <!-- SIGNATURE LINES -->
  <div style="display:flex;justify-content:space-between;margin-top:50px;padding-top:0;">
    <div style="text-align:center;width:200px;">
      <div style="border-top:1.5px solid #1a1a2e;padding-top:8px;">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;">Prepared By</div>
      </div>
    </div>
    <div style="text-align:center;width:200px;">
      <div style="border-top:1.5px solid #1a1a2e;padding-top:8px;">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;">Authorized Signature</div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="margin-top:30px;text-align:center;">
    <div style="height:1px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin-bottom:8px;"></div>
    <div style="font-size:9px;color:#aaa;letter-spacing:0.5px;">This is a computer-generated document. ${companyName} — All rights reserved.</div>
  </div>

</div>
</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  }
}
