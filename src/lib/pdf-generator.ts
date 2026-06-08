import type { CompanySettings } from "@/hooks/useCompanySettings";
import type { DocumentTemplate } from "@/hooks/useDocumentTemplates";

interface PdfColumn { header: string; key: string; align?: "left" | "right" | "center"; }
interface PdfMeta { label: string; value: string; }
type StatusTheme = "draft" | "invoiced" | "dispatched" | "paid" | "ordered" | "confirmed" | "received";

interface PdfOptions {
  title: string;
  documentNumber: string;
  date: string;
  partyLabel?: string;
  partyName?: string;
  partyAddress?: string;
  partyPhone?: string;
  partyNtn?: string;
  partyArea?: string;
  partyLicense?: string;
  partyCnic?: string;
  meta?: PdfMeta[];
  columns: PdfColumn[];
  rows: Record<string, any>[];
  totals?: PdfMeta[];
  totalInWords?: string;
  notes?: string;
  settings: CompanySettings | null;
  template?: DocumentTemplate | null;
  statusTheme?: StatusTheme;
  numbered?: boolean;
}

function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const scales = ["","Thousand","Million","Billion"];
  
  const convert = (n: number): string => {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + " " + convert(n % 10);
    return ones[Math.floor(n / 100)] + " Hundred " + convert(n % 100);
  };
  
  const intPart = Math.floor(Math.abs(num));
  const decPart = Math.round((Math.abs(num) - intPart) * 100);
  
  let result = "";
  let tempNum = intPart;
  let scaleIdx = 0;
  while (tempNum > 0) {
    const chunk = tempNum % 1000;
    if (chunk !== 0) {
      result = convert(chunk) + scales[scaleIdx] + " " + result;
    }
    tempNum = Math.floor(tempNum / 1000);
    scaleIdx++;
  }
  
  result = result.trim() + " Rupees";
  if (decPart > 0) result += " and " + convert(decPart).trim() + " Paisa";
  return result + " Only";
}

// Premium Pharma Palette — base
const BASE_C = {
  primary: "#0e7490",
  primaryLight: "#99f6e4",
  primaryMid: "#14b8a6",
  headerBg: "#0f172a",
  headerBgEnd: "#1e293b",
  text: "#0f172a",
  textMuted: "#475569",
  textLight: "#94a3b8",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  rowAlt: "#f8fafc",
  cardBg: "#f8fafc",
  cardBgEnd: "#f1f5f9",
};

const STATUS_THEMES: Record<StatusTheme, Partial<typeof BASE_C>> = {
  draft: { primary: "#d97706", primaryLight: "#fef3c7", primaryMid: "#f59e0b", headerBg: "#451a03", headerBgEnd: "#78350f" },
  invoiced: { primary: "#2563eb", primaryLight: "#dbeafe", primaryMid: "#3b82f6", headerBg: "#1e1b4b", headerBgEnd: "#312e81" },
  dispatched: { primary: "#7c3aed", primaryLight: "#ede9fe", primaryMid: "#8b5cf6", headerBg: "#2e1065", headerBgEnd: "#4c1d95" },
  paid: { primary: "#059669", primaryLight: "#d1fae5", primaryMid: "#10b981", headerBg: "#022c22", headerBgEnd: "#064e3b" },
  ordered: { primary: "#2563eb", primaryLight: "#dbeafe", primaryMid: "#3b82f6", headerBg: "#1e1b4b", headerBgEnd: "#312e81" },
  confirmed: { primary: "#7c3aed", primaryLight: "#ede9fe", primaryMid: "#8b5cf6", headerBg: "#2e1065", headerBgEnd: "#4c1d95" },
  received: { primary: "#059669", primaryLight: "#d1fae5", primaryMid: "#10b981", headerBg: "#022c22", headerBgEnd: "#064e3b" },
};

function getColors(theme?: StatusTheme) {
  if (!theme) return BASE_C;
  return { ...BASE_C, ...STATUS_THEMES[theme] };
}

// Aliases so callers using one key (e.g. "name") still render in templates that expect another (e.g. "product_name").
const SERIAL_KEYS = new Set(["srno", "sr", "sno", "serial", "idx", "__rowNum", "#", "s_no"]);
const SERIAL_HEADERS = new Set(["#", "sr", "sr#", "sr.", "s#", "sno", "s.no", "s.no.", "serial", "s/n"]);
const KEY_ALIASES: Record<string, string[]> = {
  product_name: ["product_name", "name", "item_name", "description", "product"],
  name: ["name", "product_name", "item_name", "description"],
  item_name: ["item_name", "product_name", "name", "description"],
  quantity: ["quantity", "qty", "quantity_requested", "quantity_received", "quantity_ordered", "quantity_confirmed", "convert_quantity"],
  qty: ["qty", "quantity", "quantity_requested", "quantity_received"],
  quantity_requested: ["quantity_requested", "quantity", "qty"],
  quantity_received: ["quantity_received", "quantity", "qty"],
  quantity_ordered: ["quantity_ordered", "quantity", "qty"],
  quantity_confirmed: ["quantity_confirmed", "quantity", "qty"],
  batch_number: ["batch_number", "batch", "batch_no"],
  expiry_date: ["expiry_date", "expiry", "exp"],
  rate: ["rate", "price", "unit_price", "tp_rate"],
  tp_rate: ["tp_rate", "rate", "price"],
  amount: ["amount", "total", "line_total"],
  mrp: ["mrp", "mrp_price"],
  mrp_inc_tax: ["mrp_inc_tax", "mrp", "mrp_with_tax"],
  discount: ["discount", "disc", "discount_amount", "discount_pct"],
  discount_pct: ["discount_pct", "discount_percent", "disc_pct"],
  gst_rate: ["gst_rate", "gst", "tax_rate"],
};

function resolveCell(row: Record<string, any>, key: string, rowIndex: number): any {
  if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  const aliases = KEY_ALIASES[key];
  if (aliases) {
    for (const a of aliases) {
      if (row[a] !== undefined && row[a] !== null && row[a] !== "") return row[a];
    }
  }
  if (SERIAL_KEYS.has(key)) return String(rowIndex + 1);
  return "";
}

function buildPdfHtml(opts: PdfOptions): string {
  const C = getColors(opts.statusTheme);
  const s = opts.settings;
  const t = opts.template;
  const companyName = s?.company_name || "Company Name";

  const docTitle = t?.title || opts.title;
  const baseColumns = t?.columns_config?.length ? t.columns_config : opts.columns;
  // Detect existing serial column so we don't duplicate it
  const hasSerial = baseColumns.some(c => SERIAL_KEYS.has(c.key) || SERIAL_HEADERS.has(c.header.trim().toLowerCase()));
  const numbered = opts.numbered !== false && !hasSerial;
  const columns: PdfColumn[] = numbered
    ? [{ header: "#", key: "__rowNum", align: "left" }, ...baseColumns]
    : baseColumns;
  const signatureLabels = t?.signature_labels?.length ? t.signature_labels : ["Prepared By", "Authorized Signature"];
  // Always show total in figures + words on financial docs
  const showTotalInWords = true;
  const showBankDetails = t?.show_bank_details ?? false;
  const bankDetailsText = t?.bank_details_text || "";
  const footerText = t?.footer_text || "";

  const logoHtml = s?.logo_url
    ? `<img src="${s.logo_url}" style="max-height:120px;max-width:280px;object-fit:contain;" />`
    : `<div style="font-family:'Inter',sans-serif;font-size:28px;font-weight:800;color:${C.text};letter-spacing:-0.5px;line-height:1.1;">${companyName}</div>`;

  const companyDetails = [
    s?.address,
    [s?.phone, s?.email].filter(Boolean).join(" · "),
    s?.website,
    s?.ntn ? `NTN: ${s.ntn}` : null,
    s?.strn ? `STRN: ${s.strn}` : null,
  ].filter(Boolean);

  const partyLines = [
    opts.partyName ? `<div style="font-size:14px;font-weight:700;color:${C.text};letter-spacing:-0.2px;">${opts.partyName}</div>` : "",
    opts.partyAddress ? `<div style="font-size:11px;color:${C.textMuted};margin-top:3px;line-height:1.5;">${opts.partyAddress}</div>` : "",
    opts.partyPhone ? `<div style="font-size:11px;color:${C.textMuted};">Tel: ${opts.partyPhone}</div>` : "",
    opts.partyNtn ? `<div style="font-size:10px;color:${C.textLight};margin-top:2px;letter-spacing:0.3px;">${opts.partyNtn}</div>` : "",
    t?.show_party_area && opts.partyArea ? `<div style="font-size:10px;color:${C.textLight};">Area: ${opts.partyArea}</div>` : "",
    t?.show_party_license && opts.partyLicense ? `<div style="font-size:10px;color:${C.textLight};">License No: ${opts.partyLicense}</div>` : "",
    t?.show_party_cnic && opts.partyCnic ? `<div style="font-size:10px;color:${C.textLight};">CNIC: ${opts.partyCnic}</div>` : "",
  ].filter(Boolean).join("");

  const metaItems = [
    { label: "Document #", value: opts.documentNumber },
    { label: "Date", value: opts.date },
    ...(opts.meta || []),
  ];

  const thAlign = (c: PdfColumn) => c.align || "left";

  const colMinWidth = (c: PdfColumn, idx: number) => {
    if (idx === 0) return 'min-width:40px;max-width:50px;';
    if (idx === 1) return 'min-width:160px;';
    return '';
  };

  const headerCells = columns.map((c, idx) =>
    `<th class="items-th" style="padding:10px 10px;text-align:${thAlign(c)};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#ffffff;background:${C.headerBg};border-bottom:2px solid ${C.primary};-webkit-print-color-adjust:exact;print-color-adjust:exact;${colMinWidth(c, idx)}">${c.header}</th>`
  ).join("");
  const bodyRows = opts.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#ffffff" : C.rowAlt;
    const cells = columns.map((c, cIdx) => {
      const isNum = c.align === "right";
      const isSerial = SERIAL_KEYS.has(c.key);
      const widthCss = isSerial ? "min-width:28px;max-width:36px;" : colMinWidth(c, cIdx);
      const value = resolveCell(row, c.key, i);
      return `<td style="padding:9px 10px;font-size:11.5px;text-align:${thAlign(c)};border-bottom:1px solid ${C.border};color:${C.text};${widthCss}${isNum || isSerial ? "font-family:'Courier New',monospace;font-weight:500;letter-spacing:0.5px;" : "font-weight:400;"}">${value ?? ""}</td>`;
    }).join("");
    return `<tr style="background:${bg};">${cells}</tr>`;
  }).join("");

  const totalsHtml = opts.totals
    ? opts.totals.map((tot, i) => {
        const isLast = i === opts.totals!.length - 1;
        const weight = isLast ? "700" : "400";
        const size = isLast ? "14px" : "11.5px";
        const border = isLast ? `border-top:2px solid ${C.text};` : `border-bottom:1px solid ${C.border};`;
        const bg = isLast ? `background:linear-gradient(135deg,${C.cardBg},${C.cardBgEnd});` : "";
        const labelColor = isLast ? C.text : C.textMuted;
        return `<div style="display:flex;justify-content:space-between;padding:7px 14px;font-size:${size};font-weight:${weight};${border}${bg}">
          <span style="color:${labelColor};letter-spacing:0.3px;">${tot.label}</span>
          <span style="color:${C.text};font-family:'Courier New',monospace;letter-spacing:0.5px;">${tot.value}</span>
        </div>`;
      }).join("")
    : "";

  const totalAmount = opts.totals?.length ? parseFloat(opts.totals[opts.totals.length - 1].value.replace(/[^0-9.]/g, "")) : 0;
  const totalInWordsHtml = showTotalInWords && totalAmount
    ? `<div style="margin-top:14px;padding:10px 14px;background:linear-gradient(135deg,${C.cardBg},${C.cardBgEnd});border:1px solid ${C.border};border-radius:4px;">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.primary};">Amount in Words </span>
        <span style="font-size:11px;color:${C.text};font-style:italic;line-height:1.5;">${numberToWords(totalAmount)}</span>
      </div>`
    : "";

  const bankDetailsHtml = showBankDetails && bankDetailsText
    ? `<div style="margin-top:14px;padding:10px 14px;background:linear-gradient(135deg,${C.cardBgEnd},${C.border});border-radius:4px;border-left:3px solid ${C.primary};">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.primary};">Bank Details </span>
        <span style="font-size:11px;color:${C.text};">${bankDetailsText}</span>
      </div>`
    : "";

  const footerTextHtml = footerText
    ? `<div style="margin-top:18px;padding:14px 18px;background:linear-gradient(135deg,${C.cardBg},${C.cardBgEnd});border-left:3px solid ${C.primary};border-radius:0 4px 4px 0;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.primary};margin-bottom:6px;">Certification</div>
        <div style="font-size:10px;color:${C.textMuted};line-height:1.7;font-style:italic;">${footerText}</div>
      </div>`
    : "";

  const signaturesHtml = signatureLabels.map(label =>
    `<div style="text-align:center;min-width:180px;">
      <div style="border-top:1.5px solid ${C.text};padding-top:10px;margin-top:60px;">
        <div style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:${C.textLight};">${label}</div>
      </div>
    </div>`
  ).join("");

  return `<!DOCTYPE html><html><head>
<title>${docTitle} — ${opts.documentNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter','Segoe UI',sans-serif; color:${C.text}; background:#e2e8f0; -webkit-font-smoothing:antialiased; }
  
  /* Toolbar */
  .toolbar {
    position:fixed; top:0; left:0; right:0; z-index:1000;
    background:linear-gradient(135deg,${C.headerBg},${C.headerBgEnd});
    padding:14px 28px;
    display:flex; align-items:center; justify-content:space-between;
    box-shadow:0 4px 24px rgba(0,0,0,0.18);
  }
  .toolbar-title { color:#e2e8f0; font-size:14px; font-weight:600; letter-spacing:0.5px; }
  .toolbar-btn {
    background:${C.primary}; color:#fff; border:none; padding:10px 28px;
    font-size:13px; font-weight:600; letter-spacing:0.5px; border-radius:6px;
    cursor:pointer; transition:all 0.2s;
    display:inline-flex; align-items:center; gap:8px;
  }
  .toolbar-btn:hover { background:#0c6980; transform:translateY(-1px); box-shadow:0 4px 16px rgba(14,116,144,0.4); }
  .toolbar-btn svg { width:16px; height:16px; }

  .page-frame {
    max-width:800px; margin:80px auto 40px; padding:44px 48px;
    background:#fff;
    border:1px solid ${C.border};
    box-shadow:0 8px 40px rgba(0,0,0,0.08);
    position:relative;
  }
  .page-frame::before {
    content:''; position:absolute; top:5px; left:5px; right:5px; bottom:5px;
    border:0.5px solid ${C.border}; pointer-events:none;
  }
  /* Corner ornaments */
  .corner { position:absolute; width:16px; height:16px; }
  .corner::before, .corner::after { content:''; position:absolute; background:${C.primary}; }
  .corner-tl { top:10px; left:10px; }
  .corner-tl::before { width:16px; height:1.5px; top:0; left:0; }
  .corner-tl::after { width:1.5px; height:16px; top:0; left:0; }
  .corner-tr { top:10px; right:10px; }
  .corner-tr::before { width:16px; height:1.5px; top:0; right:0; }
  .corner-tr::after { width:1.5px; height:16px; top:0; right:0; }
  .corner-bl { bottom:10px; left:10px; }
  .corner-bl::before { width:16px; height:1.5px; bottom:0; left:0; }
  .corner-bl::after { width:1.5px; height:16px; bottom:0; left:0; }
  .corner-br { bottom:10px; right:10px; }
  .corner-br::before { width:16px; height:1.5px; bottom:0; right:0; }
  .corner-br::after { width:1.5px; height:16px; bottom:0; right:0; }

  @media print {
    body { padding:0; background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    *, *::before, *::after { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    .toolbar { display:none !important; }
    .page-frame { border:none; padding:20px 25px; max-width:100%; margin:0; box-shadow:none; }
    .page-frame::before { display:none; }
    .corner { display:none; }
    table { page-break-inside:auto; }
    thead { display:table-header-group; }
    tfoot { display:table-footer-group; }
    tr { page-break-inside:avoid; }
    thead tr { background:${C.headerBg} !important; }
    .items-th { color:#ffffff !important; background:${C.headerBg} !important; }
    @page { margin:10mm 8mm; size:A4; }
  }
</style>
</head><body>

<!-- Floating Toolbar -->
<div class="toolbar">
  <div class="toolbar-title">${docTitle} — ${opts.documentNumber}</div>
  <button class="toolbar-btn" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
    Download / Print
  </button>
</div>

<div class="page-frame">
  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>

  <!-- LETTERHEAD -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;">
    <div>${logoHtml}</div>
    <div style="text-align:right;">
      ${!s?.logo_url ? "" : `<div style="font-size:18px;font-weight:800;color:${C.text};letter-spacing:-0.3px;">${companyName}</div>`}
      ${companyDetails.map((d, i) => `<div style="font-size:${i === 0 ? '10.5' : '9.5'}px;color:${C.textMuted};line-height:1.7;letter-spacing:0.2px;">${d}</div>`).join("")}
    </div>
  </div>
  
  <!-- Teal accent divider -->
  <div style="height:3px;background:linear-gradient(90deg,${C.primary},${C.primaryLight} 40%,${C.primaryMid} 60%,${C.primaryLight} 80%,${C.primary});margin-bottom:22px;border-radius:2px;"></div>

  <!-- DOCUMENT TITLE -->
  <div style="text-align:center;margin-bottom:22px;">
    <div style="display:inline-block;padding:9px 36px;border:1.5px solid ${C.text};position:relative;">
      <div style="position:absolute;top:-1.5px;left:15%;right:15%;height:3px;background:linear-gradient(90deg,transparent,${C.primary},transparent);"></div>
      <div style="position:absolute;bottom:-1.5px;left:15%;right:15%;height:3px;background:linear-gradient(90deg,transparent,${C.primary},transparent);"></div>
      <div style="font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:4px;color:${C.text};">${docTitle}</div>
    </div>
  </div>

  <!-- PARTY INFO + META -->
  <div style="display:flex;gap:22px;margin-bottom:26px;">
    <div style="flex:1;">
      <table style="width:100%;">
        ${metaItems.map(m => `<tr>
          <td style="padding:4px 12px 4px 0;font-size:9px;font-weight:600;color:${C.textLight};text-transform:uppercase;letter-spacing:1.5px;white-space:nowrap;width:100px;">${m.label}</td>
          <td style="padding:4px 0;font-size:13px;font-weight:600;color:${C.text};font-family:'Courier New',monospace;letter-spacing:0.3px;">${m.value}</td>
        </tr>`).join("")}
      </table>
    </div>
    ${partyLines ? `<div style="flex:1;border:1px solid ${C.border};border-left:3px solid ${C.primary};padding:14px 18px;border-radius:0 4px 4px 0;background:linear-gradient(135deg,#fff,${C.cardBg});">
      <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.primary};margin-bottom:8px;">${opts.partyLabel || "Party"}</div>
      ${partyLines}
    </div>` : ""}
  </div>

  <!-- ITEMS TABLE -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
    <thead>
      <tr style="background:linear-gradient(135deg,${C.headerBg},${C.headerBgEnd});">${headerCells}</tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <!-- TOTALS -->
  ${totalsHtml ? `<div style="margin-left:auto;max-width:300px;border:1px solid ${C.border};border-radius:4px;overflow:hidden;background:#fff;">${totalsHtml}</div>` : ""}

  ${totalInWordsHtml}
  ${bankDetailsHtml}

  <!-- NOTES -->
  ${opts.notes ? `<div style="margin-top:22px;padding:14px 18px;background:linear-gradient(135deg,${C.cardBg},${C.cardBgEnd});border-left:3px solid ${C.primary};border-radius:0 4px 4px 0;">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.primary};margin-bottom:5px;">Notes / Terms</div>
    <div style="font-size:10.5px;color:${C.textMuted};line-height:1.6;">${opts.notes}</div>
  </div>` : ""}

  ${footerTextHtml}

  <!-- SIGNATURE LINES -->
  <div style="display:flex;justify-content:space-between;margin-top:40px;padding:0 10px;">
    ${signaturesHtml}
  </div>

  <!-- FOOTER -->
  <div style="margin-top:34px;text-align:center;">
    <div style="height:1px;background:linear-gradient(90deg,transparent 5%,${C.primary} 35%,${C.primaryLight} 50%,${C.primary} 65%,transparent 95%);margin-bottom:10px;"></div>
    <div style="font-size:8px;color:${C.textLight};letter-spacing:1px;text-transform:uppercase;">This is a computer-generated document · ${companyName} · All rights reserved</div>
  </div>

</div>
</body></html>`;
}

/** Returns the full HTML string for in-app preview */
export function generatePdfHtml(opts: PdfOptions): string {
  return buildPdfHtml(opts);
}

/** Opens PDF in a new tab (legacy) */
export function generatePdf(opts: PdfOptions) {
  const html = buildPdfHtml(opts);
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
