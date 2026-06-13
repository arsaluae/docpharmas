import type { CompanySettings } from "@/hooks/useCompanySettings";
import type { DocumentTemplate } from "@/hooks/useDocumentTemplates";
import { WARRANTY_NOTE_TEXT } from "@/lib/warranty-declaration";

export interface PdfColumn { header: string; key: string; align?: "left" | "right" | "center"; }
export interface PdfMeta { label: string; value: string; }
export type StatusTheme = "draft" | "invoiced" | "dispatched" | "paid" | "ordered" | "confirmed" | "received";

export interface PdfOptions {
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
  partyCode?: string;
  partyMobile?: string;
  partyCity?: string;
  partyAccountCode?: string;
  salesAgentName?: string;
  salesAgentMobile?: string;
  validity?: string;
  paymentTerms?: string;
  deliveryStatus?: string;
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
  /** Page format. "auto" = half when rows ≤ HALF_PAGE_ROW_LIMIT, else full. Default "auto". */
  pageMode?: "half" | "full" | "auto";
}

export const HALF_PAGE_ROW_LIMIT = 5;
export const HALF_PAGE_WARRANTY_LIMIT = 4;

function resolvePageMode(mode: "half" | "full" | "auto" | undefined, itemCount: number, limit: number): "half" | "full" {
  if (mode === "half") return "half";
  if (mode === "full") return "full";
  return itemCount <= limit ? "half" : "full";
}

/* ════════════════════════════════════════════════════════════════════════════
   AMOUNT TO WORDS
════════════════════════════════════════════════════════════════════════════ */
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
    if (chunk !== 0) result = convert(chunk) + scales[scaleIdx] + " " + result;
    tempNum = Math.floor(tempNum / 1000);
    scaleIdx++;
  }
  result = result.trim() + " Rupees";
  if (decPart > 0) result += " and " + convert(decPart).trim() + " Paisa";
  return result + " Only";
}

/* ════════════════════════════════════════════════════════════════════════════
   THEME
════════════════════════════════════════════════════════════════════════════ */
const BASE_C = {
  primary: "#0e7490",
  primaryLight: "#cffafe",
  primaryDark: "#155e75",
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
  accent: "#0e7490",
};
const STATUS_THEMES: Record<StatusTheme, Partial<typeof BASE_C>> = {
  draft:      { primary: "#d97706", primaryDark: "#92400e", primaryLight: "#fef3c7", accent: "#d97706" },
  invoiced:   { primary: "#2563eb", primaryDark: "#1d4ed8", primaryLight: "#dbeafe", accent: "#2563eb" },
  dispatched: { primary: "#7c3aed", primaryDark: "#5b21b6", primaryLight: "#ede9fe", accent: "#7c3aed" },
  paid:       { primary: "#059669", primaryDark: "#047857", primaryLight: "#d1fae5", accent: "#059669" },
  ordered:    { primary: "#2563eb", primaryDark: "#1d4ed8", primaryLight: "#dbeafe", accent: "#2563eb" },
  confirmed:  { primary: "#7c3aed", primaryDark: "#5b21b6", primaryLight: "#ede9fe", accent: "#7c3aed" },
  received:   { primary: "#059669", primaryDark: "#047857", primaryLight: "#d1fae5", accent: "#059669" },
};
function getColors(theme?: StatusTheme) {
  if (!theme) return BASE_C;
  return { ...BASE_C, ...STATUS_THEMES[theme] };
}

/* ════════════════════════════════════════════════════════════════════════════
   COLUMN HELPERS
════════════════════════════════════════════════════════════════════════════ */
const SERIAL_KEYS = new Set(["srno", "sr", "sno", "serial", "idx", "__rowNum", "#", "s_no"]);
const SERIAL_HEADERS = new Set(["#", "sr", "sr#", "sr.", "s#", "sno", "s.no", "s.no.", "serial", "s/n"]);
const KEY_ALIASES: Record<string, string[]> = {
  product_name: ["product_name", "name", "item_name", "description", "product"],
  name: ["name", "product_name", "item_name", "description"],
  item_name: ["item_name", "product_name", "name", "description"],
  product_code: ["product_code", "code", "sku"],
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
  line_total: ["line_total", "amount", "total"],
  mrp: ["mrp", "mrp_price"],
  mrp_inc_tax: ["mrp_inc_tax", "mrp", "mrp_with_tax"],
  discount: ["discount", "disc", "discount_amount", "discount_pct"],
  discount_pct: ["discount_pct", "discount_percent", "disc_pct"],
  tax: ["tax", "gst", "gst_rate", "gst_amount"],
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/* ════════════════════════════════════════════════════════════════════════════
   CLASSIC A4 TEMPLATE (polished)
════════════════════════════════════════════════════════════════════════════ */
function buildA4Html(opts: PdfOptions): string {
  const C = getColors(opts.statusTheme);
  const s = opts.settings;
  const t = opts.template;
  const companyName = s?.company_name || "Company Name";
  const tagline = (s as any)?.tagline || "";
  const docTitle = t?.title || opts.title;

  const baseColumns = t?.columns_config?.length ? t.columns_config : opts.columns;
  const hasSerial = baseColumns.some(c => SERIAL_KEYS.has(c.key) || SERIAL_HEADERS.has(c.header.trim().toLowerCase()));
  const numbered = opts.numbered !== false && !hasSerial;
  const columns: PdfColumn[] = numbered
    ? [{ header: "#", key: "__rowNum", align: "center" }, ...baseColumns]
    : baseColumns;

  const signatureLabels = t?.signature_labels?.length ? t.signature_labels : ["Prepared By", "Authorized Signature"];
  const showBankDetails = t?.show_bank_details ?? false;
  const bankDetailsText = t?.bank_details_text || "";
  const footerText = t?.footer_text || "";

  /* ── HEADER: logo left · company right ── */
  const logoHtml = s?.logo_url
    ? `<img src="${s.logo_url}" alt="${escapeHtml(companyName)}" style="height:140px;max-height:140px;max-width:340px;width:auto;object-fit:contain;display:block;" />`
    : `<div style="font-size:46px;font-weight:800;color:${C.text};letter-spacing:-0.5px;">${escapeHtml(companyName)}</div>`;

  const addressLine = [s?.address, (s as any)?.city].filter(Boolean).join(", ");
  const phoneLine = [s?.phone ? `Tel: ${s.phone}` : null, (s as any)?.whatsapp_number ? `Mob: ${(s as any).whatsapp_number}` : null].filter(Boolean).join("  ·  ");
  const webLine = [s?.email, s?.website].filter(Boolean).join("  ·  ");
  const idLine = [s?.ntn ? `NTN: ${s.ntn}` : null, s?.strn ? `STRN: ${s.strn}` : null].filter(Boolean).join("  ·  ");

  const companyBlock = `
    <div style="text-align:right;">
      ${s?.logo_url ? `<div style="font-size:26px;font-weight:800;color:${C.text};letter-spacing:-0.2px;line-height:1.2;">${escapeHtml(companyName)}</div>` : ""}
      ${tagline ? `<div style="font-size:14px;font-style:italic;color:${C.textMuted};margin-top:3px;">${escapeHtml(tagline)}</div>` : ""}
      ${[addressLine, phoneLine, webLine, idLine].filter(Boolean).map(l => `<div style="font-size:14px;color:${C.textMuted};line-height:1.65;margin-top:2px;word-break:break-word;">${escapeHtml(l)}</div>`).join("")}
    </div>`;

  /* ── DOCUMENT TITLE (centered) ── */
  const titleBlock = `
    <div style="text-align:center;margin-top:22px;padding-top:16px;border-top:2px solid ${C.text};">
      <div style="font-size:26px;font-weight:800;color:${C.text};letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(docTitle)}</div>
      <div style="height:2px;width:90px;background:${C.primary};margin:7px auto 0;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>
    </div>`;

  /* ── DOC INFO (left) + CUSTOMER (right) ── */
  const infoRows: { label: string; value: string }[] = [
    { label: "Document #", value: opts.documentNumber },
    { label: "Date", value: opts.date },
  ];
  if (opts.salesAgentName) infoRows.push({ label: "Sales Agent", value: opts.salesAgentName + (opts.salesAgentMobile ? `  ·  ${opts.salesAgentMobile}` : "") });
  if (opts.validity) infoRows.push({ label: "Validity", value: opts.validity });
  if (opts.paymentTerms) infoRows.push({ label: "Payment Terms", value: opts.paymentTerms });
  if (opts.deliveryStatus) infoRows.push({ label: "Delivery", value: opts.deliveryStatus });
  (opts.meta || []).forEach(m => infoRows.push({ label: m.label, value: m.value }));

  const infoHtml = infoRows.map(r => `
    <div style="display:flex;gap:10px;font-size:15px;line-height:1.7;">
      <span style="min-width:120px;color:${C.textMuted};font-weight:600;">${escapeHtml(r.label)}:</span>
      <span style="color:${C.text};font-weight:600;flex:1;">${escapeHtml(r.value)}</span>
    </div>`).join("");

  // Always show mobile + phone from the party record when available.
  const phoneBits: string[] = [];
  if (opts.partyMobile) phoneBits.push(`📱 ${escapeHtml(opts.partyMobile)}`);
  if (opts.partyPhone && opts.partyPhone !== opts.partyMobile) phoneBits.push(`☎ ${escapeHtml(opts.partyPhone)}`);
  const cityArea = [opts.partyCity, opts.partyArea].filter(Boolean).join(" · ");

  const partyHtml = `
    <div style="border:1px solid ${C.border};border-radius:4px;overflow:hidden;background:#fff;">
      <div style="background:${C.cardBg};padding:8px 16px;border-bottom:1px solid ${C.border};font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.8px;color:${C.primary};-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escapeHtml(opts.partyLabel || "Bill To")}</div>
      <div style="padding:14px 16px;word-wrap:break-word;overflow-wrap:anywhere;">
        ${opts.partyName ? `<div style="font-size:19px;font-weight:700;color:${C.text};line-height:1.25;">${escapeHtml(opts.partyName)}</div>` : ""}
        ${phoneBits.length ? `<div style="font-size:15px;color:${C.text};margin-top:9px;font-weight:600;">${phoneBits.join("  ·  ")}</div>` : ""}
        ${cityArea ? `<div style="font-size:15px;color:${C.text};margin-top:5px;">${escapeHtml(cityArea)}</div>` : ""}
        ${opts.partyAddress ? `<div style="font-size:15px;color:${C.textMuted};margin-top:5px;line-height:1.55;">${escapeHtml(opts.partyAddress)}</div>` : ""}
        ${opts.partyNtn ? `<div style="font-size:13px;color:${C.textMuted};margin-top:7px;">NTN: ${escapeHtml(opts.partyNtn)}</div>` : ""}
        ${t?.show_party_license && opts.partyLicense ? `<div style="font-size:13px;color:${C.textMuted};">License: ${escapeHtml(opts.partyLicense)}</div>` : ""}
        ${t?.show_party_cnic && opts.partyCnic ? `<div style="font-size:13px;color:${C.textMuted};">CNIC: ${escapeHtml(opts.partyCnic)}</div>` : ""}
        ${opts.partyAccountCode ? `<div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:${C.textLight};margin-top:7px;">A/C: ${escapeHtml(opts.partyAccountCode)}</div>` : ""}
      </div>
    </div>`;

  const metaBlock = `
    <div style="display:flex;gap:18px;margin-top:18px;align-items:flex-start;">
      <div style="flex:1;min-width:0;">${infoHtml}</div>
      <div style="flex:1;min-width:0;">${partyHtml}</div>
    </div>`;

  /* ── ITEMS TABLE ── */
  // Detect "logistics-style" tables (Delivery Note / Sales Return without prices)
  // so the Product Name column gets the slack instead of leaving a giant gap.
  const hasMoneyCol = columns.some(c => {
    const k = c.key.toLowerCase();
    return k === "rate" || k === "tp_rate" || k === "amount" || k === "line_total" || k === "mrp" || k === "mrp_inc_tax" || k === "price";
  });
  const thAlign = (c: PdfColumn) => c.align || "left";
  const colWidth = (c: PdfColumn) => {
    const k = c.key.toLowerCase();
    const isProductName = c.key === "product_name" || c.key === "name" || c.key === "item_name" || c.key === "description";
    if (SERIAL_KEYS.has(c.key)) return "width:36px;";
    if (isProductName) return hasMoneyCol ? "width:32%;" : "width:55%;";
    if (k === "product_code" || k === "code" || k === "sku") return "width:90px;";
    if (k === "batch_number" || k === "batch") return hasMoneyCol ? "width:88px;" : "width:14%;";
    if (k === "expiry_date" || k === "expiry") return hasMoneyCol ? "width:78px;" : "width:12%;";
    if (k === "quantity" || k === "qty") return hasMoneyCol ? "width:64px;" : "width:12%;";
    if (k === "rate" || k === "tp_rate" || k === "price") return "width:84px;";
    if (k === "mrp" || k === "mrp_inc_tax") return "width:110px;";
    if (k === "discount" || k === "discount_pct" || k === "disc") return "width:70px;";
    if (k === "tax" || k === "gst_rate" || k === "gst") return "width:64px;";
    if (k === "amount" || k === "line_total" || k === "total") return "width:104px;";
    return "";
  };

  const headerCells = columns.map(c => `
    <th style="padding:11px 10px;text-align:${thAlign(c)};font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:${C.text};background:#eef0f3;border-bottom:2px solid ${C.text};${colWidth(c)}white-space:nowrap;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escapeHtml(c.header)}</th>`).join("");

  const bodyRows = opts.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#ffffff" : "#fafbfc";
    const cells = columns.map(c => {
      const isNum = c.align === "right";
      const isSerial = SERIAL_KEYS.has(c.key);
      const isProductName = c.key === "product_name" || c.key === "name" || c.key === "item_name" || c.key === "description";
      const value = resolveCell(row, c.key, i);
      const valStr = value === null || value === undefined ? "" : String(value);
      const fontFamily = isNum || isSerial || /batch|code|expiry/i.test(c.key) ? "'JetBrains Mono','Courier New',monospace" : "'Inter',sans-serif";
      const fontWeight = isProductName ? "600" : isNum ? "600" : "400";
      const wrap = isProductName ? "white-space:normal;word-break:break-word;line-height:1.45;" : "white-space:nowrap;";
      return `<td style="padding:10px;font-size:15px;text-align:${thAlign(c)};border-bottom:1px solid ${C.border};color:${C.text};font-family:${fontFamily};font-weight:${fontWeight};${wrap}${colWidth(c)}">${escapeHtml(valStr)}</td>`;
    }).join("");
    return `<tr style="background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">${cells}</tr>`;
  }).join("");

  const itemsTable = `
    <div style="margin-top:18px;border:1px solid ${C.border};border-radius:3px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows || `<tr><td colspan="${columns.length}" style="padding:24px;text-align:center;font-size:13px;color:${C.textLight};font-style:italic;">No items</td></tr>`}</tbody>
      </table>
    </div>`;

  /* ── TOTALS (bottom-right) ── */
  const totals = opts.totals || [];
  const grandTotal = totals[totals.length - 1];
  const subRows = totals.slice(0, -1);
  const totalAmount = grandTotal ? parseFloat(grandTotal.value.replace(/[^0-9.]/g, "")) : 0;

  const totalsCard = totals.length ? `
    <div style="display:flex;margin-top:22px;">
      <div style="flex:1;"></div>
      <div class="totals-card" style="width:380px;max-width:58%;border:1px solid ${C.border};border-radius:3px;overflow:hidden;background:#fff;">
        ${subRows.map(r => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;font-size:15px;border-bottom:1px solid ${C.borderLight};">
            <span style="color:${C.textMuted};">${escapeHtml(r.label)}</span>
            <span style="color:${C.text};font-family:'JetBrains Mono',monospace;font-weight:600;font-size:16px;">${escapeHtml(r.value)}</span>
          </div>`).join("")}
        ${grandTotal ? `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 18px;background:${C.text};color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
            <span style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1.6px;">${escapeHtml(grandTotal.label || "Grand Total")}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:30px;font-weight:800;letter-spacing:0.4px;">${escapeHtml(grandTotal.value)}</span>
          </div>` : ""}
      </div>
    </div>` : "";

  const totalInWordsHtml = totalAmount ? `
    <div style="margin-top:12px;padding:10px 14px;border-left:3px solid ${C.primary};background:${C.cardBg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <span style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:${C.textMuted};">Amount in Words: </span>
      <span style="font-size:15px;color:${C.text};font-style:italic;">${escapeHtml(numberToWords(totalAmount))}</span>
    </div>` : "";

  /* ── FOOTER ── */
  const bankHtml = showBankDetails && bankDetailsText ? `
    <div style="margin-top:12px;padding:9px 14px;border:1px solid ${C.border};border-radius:3px;background:${C.cardBg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${C.primary};">Bank: </span>
      <span style="font-size:13px;color:${C.text};">${escapeHtml(bankDetailsText)}</span>
    </div>` : "";

  const footerCert = footerText ? `
    <div style="margin-top:12px;padding:10px 14px;border-left:3px solid ${C.border};background:${C.cardBg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${C.textMuted};margin-bottom:4px;">Certification</div>
      <div style="font-size:11.5px;color:${C.textMuted};line-height:1.6;font-style:italic;">${escapeHtml(footerText)}</div>
    </div>` : "";

  const notesHtml = opts.notes ? `
    <div style="margin-top:12px;padding:9px 14px;border:1px solid ${C.border};border-radius:3px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${C.textMuted};">Notes</div>
      <div style="font-size:13px;color:${C.text};line-height:1.55;margin-top:3px;">${escapeHtml(opts.notes)}</div>
    </div>` : "";

  const signatures = `
    <div class="signatures" style="margin-top:42px;display:flex;justify-content:space-between;gap:30px;page-break-inside:avoid;">
      ${signatureLabels.map(l => `
        <div style="flex:1;text-align:center;max-width:240px;">
          <div style="border-top:1.5px solid ${C.text};padding-top:6px;margin-top:42px;">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:${C.textMuted};">${escapeHtml(l)}</div>
          </div>
        </div>`).join("")}
    </div>`;

  return `<!DOCTYPE html><html><head>
<title>${escapeHtml(docTitle)} — ${escapeHtml(opts.documentNumber)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter','Segoe UI',sans-serif; color:${C.text}; background:#e2e8f0; -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums; }
  .toolbar { position:fixed; top:0; left:0; right:0; z-index:1000;
    background:${C.text}; padding:10px 20px; display:flex; align-items:center; justify-content:space-between;
    box-shadow:0 4px 18px rgba(0,0,0,0.18); }
  .toolbar-title { color:#fff; font-size:13px; font-weight:600; letter-spacing:0.3px; }
  .toolbar-btn { background:${C.primary}; color:#fff; border:none; padding:8px 18px; font-size:12.5px; font-weight:600; border-radius:4px; cursor:pointer; }
  .page-frame { max-width:794px; margin:32px auto 0; padding:24px 28px 20px; background:#fff; border:1px solid ${C.border}; box-shadow:0 8px 30px rgba(0,0,0,0.08); page-break-after:avoid; break-after:avoid; }
  .doc-header { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; }
  .doc-header > div:first-child { flex:0 0 340px; min-width:260px; }
  /* Pagination-safe defaults (apply during html2canvas snapshot too, not only @media print) */
  table { page-break-inside:auto; }
  thead { display:table-header-group; }
  tfoot { display:table-footer-group; }
  tr { page-break-inside:avoid; break-inside:avoid; }
  .totals-card, .signatures, [data-pdf-section] { page-break-inside:avoid; break-inside:avoid; }
  @media print {
    body { background:#fff; }
    *, *::before, *::after { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    .toolbar { display:none !important; }
    .page-frame { border:none; box-shadow:none; max-width:100%; margin:0; padding:0; page-break-after:avoid !important; }
    html, body { height:auto !important; }
    @page { margin:8mm 10mm; size:A4; }
  }
</style></head><body>
<div class="toolbar">
  <div class="toolbar-title">${escapeHtml(docTitle)} — ${escapeHtml(opts.documentNumber)}</div>
  <button class="toolbar-btn" onclick="window.print()">Download / Print</button>
</div>

<div class="page-frame">
  <div class="doc-header">
    <div style="flex-shrink:0;">${logoHtml}</div>
    <div style="min-width:0;">${companyBlock}</div>
  </div>
  ${titleBlock}
  ${metaBlock}
  ${itemsTable}
  ${totalsCard}
  ${totalInWordsHtml}
  ${notesHtml}
  ${bankHtml}
  ${footerCert}
  ${signatures}
</div>
</body></html>`;
}

/* ════════════════════════════════════════════════════════════════════════════
   HALF-PAGE TRANSFORMER
   Wraps already-built A4 HTML so the document occupies only the top half of an
   A4 sheet. Lower half remains blank. Preview, Print and PDF all honor it via
   the same CSS (size:A4, .page-frame constrained to 138mm + overflow hidden).
════════════════════════════════════════════════════════════════════════════ */
const HALF_PAGE_CSS = `
  /* === Half-A4 overrides — top 138mm of an A4 sheet === */
  @page { size: A4 portrait; margin: 10mm; }
  html, body { background:#fff !important; }
  body { margin:0 !important; padding:0 !important; }
  .toolbar { display:none !important; }
  .page-frame, .warranty-document, .page {
    width: 190mm !important;
    max-width: 190mm !important;
    height: 138mm !important;
    max-height: 138mm !important;
    margin: 0 auto !important;
    padding: 4mm 5mm !important;
    border: none !important;
    box-shadow: none !important;
    background: #fff !important;
    overflow: hidden !important;
    page-break-after: always !important;
    box-sizing: border-box !important;
    display: flex; flex-direction: column;
  }
  /* Density pass — preserve layout, shrink chrome */
  .page-frame img { max-height: 100px !important; }
  .page-frame [style*="font-size:46px"],
  .page-frame [style*="font-size:42px"],
  .page-frame [style*="font-size:26px"] { font-size: 15pt !important; }
  .page-frame [style*="font-size:24px"] { font-size: 12pt !important; }
  .page-frame [style*="font-size:19px"] { font-size: 10.5pt !important; }
  .page-frame [style*="font-size:16px"],
  .page-frame [style*="font-size:15px"] { font-size: 9pt !important; line-height: 1.35 !important; }
  .page-frame [style*="font-size:14px"] { font-size: 8.5pt !important; line-height: 1.3 !important; }
  .page-frame [style*="font-size:13px"],
  .page-frame [style*="font-size:13.5px"] { font-size: 8pt !important; line-height: 1.3 !important; }
  .page-frame [style*="font-size:12px"],
  .page-frame [style*="font-size:12.5px"],
  .page-frame [style*="font-size:11px"] { font-size: 7.5pt !important; }
  .page-frame [style*="font-size:30px"] { font-size: 13pt !important; }
  /* Tight spacing */
  .page-frame [style*="margin-top:42px"],
  .page-frame [style*="margin-top:22px"],
  .page-frame [style*="margin-top:18px"],
  .page-frame [style*="margin-top:16px"],
  .page-frame [style*="margin-top:14px"],
  .page-frame [style*="margin-top:12px"] { margin-top: 3pt !important; }
  .page-frame [style*="padding:11px 10px"],
  .page-frame [style*="padding:10px"] { padding: 3pt 4pt !important; }
  .page-frame [style*="padding:14px 16px"],
  .page-frame [style*="padding:16px 18px"],
  .page-frame [style*="padding:8px 16px"] { padding: 4pt 6pt !important; }
  /* Totals card narrower */
  .page-frame [style*="width:380px"] { width: 220pt !important; max-width: 60% !important; }
  /* Signatures squeeze */
  .page-frame [style*="margin-top:42px"] { margin-top: 8pt !important; }
  /* Inline notice for auto-promoted docs (only rendered when full) */
  .half-overflow-banner { display:none; }
  @media screen {
    body { background:#e2e8f0 !important; padding: 12px 0 !important; }
    .page-frame, .warranty-document, .page {
      box-shadow: 0 4px 18px rgba(0,0,0,0.08) !important;
      outline: 1px dashed #cbd5e1;
    }
  }
`;

function wrapHalfPage(html: string): string {
  const styleBlock = `<style data-half-page="1">${HALF_PAGE_CSS}</style>`;
  if (/<html\b/i.test(html)) {
    html = html.replace(/<html\b([^>]*)>/i, `<html$1 data-page-mode="half">`);
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${styleBlock}</head>`);
  }
  return styleBlock + html;
}

function tagFullPage(html: string): string {
  if (/<html\b/i.test(html)) {
    return html.replace(/<html\b([^>]*)>/i, `<html$1 data-page-mode="full">`);
  }
  return html;
}

function applyPageMode(html: string, opts: PdfOptions): string {
  const mode = resolvePageMode(opts.pageMode ?? (opts.settings as any)?.document_page_mode, opts.rows?.length || 0, HALF_PAGE_ROW_LIMIT);
  return mode === "half" ? wrapHalfPage(html) : tagFullPage(html);
}

/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC API
════════════════════════════════════════════════════════════════════════════ */
export function generatePdfHtml(opts: PdfOptions): string {
  return applyPageMode(buildA4Html(opts), opts);
}

/** Kept for backward compatibility — returns same polished A4 HTML. */
export function generateWhatsAppHtml(opts: PdfOptions): string {
  return applyPageMode(buildA4Html(opts), opts);
}

export interface PdfViewSpec { key: string; label: string; color: string; html: string; disabled?: boolean; }

/** Single polished A4 view. Single-item array → PdfPreviewDialog hides the switcher. */
export function generateDocumentViews(opts: PdfOptions): PdfViewSpec[] {
  const mode = resolvePageMode(opts.pageMode ?? (opts.settings as any)?.document_page_mode, opts.rows?.length || 0, HALF_PAGE_ROW_LIMIT);
  const label = mode === "half" ? "Half A4" : "A4 Print";
  return [
    { key: "a4", label, color: "bg-slate-900 text-white border-slate-900", html: applyPageMode(buildA4Html(opts), opts) },
  ];
}

export function generatePdf(opts: PdfOptions) {
  const html = applyPageMode(buildA4Html(opts), opts);
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

/* ════════════════════════════════════════════════════════════════════════════
   WARRANTY NOTE — DEDICATED RENDERER (matches statutory Pakistani format)
════════════════════════════════════════════════════════════════════════════ */
export interface WarrantyNoteItem {
  product_name: string;
  product_description?: string;
  batch_number?: string;
  expiry_date?: string;
  quantity: number;
  tp_rate: number;
  mrp?: number;
  discount?: number;
  amount: number;
}

export interface WarrantyNoteOptions {
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  createdBy?: string;
  /** Distributor (Warranty Address) — NEVER the customer's own address */
  distributor: {
    name: string;
    address?: string | null;
    phone?: string | null;
    licenseNumber?: string | null;
    licenseExpiry?: string | null;
    ntn?: string | null;
    cnic?: string | null;
  };
  items: WarrantyNoteItem[];
  subtotal: number;
  discountLabel?: string;
  discountAmount?: number;
  total: number;
  /** @deprecated Kept for back-compat; ignored when settings.warranty_declaration_enabled is true. */
  noteText?: string | null;
  /** Sales Representative who signs the warranty declaration. */
  salesRep?: {
    name?: string | null;
    fatherName?: string | null;
    cnic?: string | null;
    licenseNumber?: string | null;
    licenseExpiry?: string | null;
    signatureUrl?: string | null;
    stampUrl?: string | null;
  } | null;
  settings: CompanySettings | null;
  pageMode?: "half" | "full" | "auto";
}

function fmtMoney(n: number): string {
  return Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtExpiryMMYY(iso?: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return iso;
  return `${m[2]}-${m[1].slice(2)}`;
}

function buildWarrantyNoteHtml(opts: WarrantyNoteOptions): string {
  const s = opts.settings;
  const company = s?.company_name || "Company Name";
  const companyLines = [
    s?.address,
    s?.phone ? `Mobile: ${s.phone}` : null,
    s?.email ? s.email : null,
    s?.ntn ? `NTN: ${s.ntn}` : null,
  ].filter(Boolean) as string[];

  const logo = s?.logo_url
    ? `<img src="${s.logo_url}" alt="${escapeHtml(company)}" style="max-height:80px;max-width:180px;object-fit:contain;display:block;" />`
    : "";

  const d = opts.distributor;
  const leftPairs: [string, string][] = [
    ["Mobile", d.phone || "—"],
    ["Warranty Address", [d.name, d.address].filter(Boolean).join(" — ") || "—"],
    ["Licence No", d.licenseNumber || "—"],
    ["Licence Valid Up To", d.licenseExpiry || "—"],
    ["NTN", d.ntn || "—"],
    ["CNIC", d.cnic || "—"],
  ];
  const leftBlock = leftPairs.map(([k, v]) => `
    <tr>
      <td style="padding:3pt 8pt 3pt 0;color:#475569;font-weight:600;font-size:9.5pt;white-space:nowrap;vertical-align:top;">${escapeHtml(k)}</td>
      <td style="padding:3pt 0;color:#0f172a;font-size:9.5pt;word-break:break-word;">${escapeHtml(v)}</td>
    </tr>`).join("");

  const rightPairs: [string, string][] = [
    ["Warranty Note No.", opts.invoiceNumber],
    ["Date", opts.date],
    ["Due Date", opts.dueDate || opts.date],
  ];
  if (opts.createdBy) rightPairs.push(["Created By", opts.createdBy]);
  const rightBlock = rightPairs.map(([k, v]) => `
    <tr>
      <td style="padding:3pt 8pt 3pt 0;color:#475569;font-weight:600;font-size:9.5pt;white-space:nowrap;vertical-align:top;">${escapeHtml(k)}</td>
      <td style="padding:3pt 0;color:#0f172a;font-size:9.5pt;font-weight:600;word-break:break-word;">${escapeHtml(v)}</td>
    </tr>`).join("");

  const cols = [
    { h: "Sr",           w: "7%",  a: "center" },
    { h: "Product Name", w: "18%", a: "left"   },
    { h: "Description",  w: "22%", a: "left"   },
    { h: "Qty",          w: "8%",  a: "center" },
    { h: "Rate",         w: "8%",  a: "right"  },
    { h: "Batch No.",    w: "9%",  a: "center" },
    { h: "Batch Expiry", w: "9%",  a: "center" },
    { h: "Disc.",        w: "7%",  a: "right"  },
    { h: "Amount",       w: "8%",  a: "right"  },
    { h: "MRP Inc. Tax", w: "8%",  a: "right"  },
  ];
  const colgroup = `<colgroup>${cols.map(c => `<col style="width:${c.w};" />`).join("")}</colgroup>`;
  const headerCells = cols.map(c =>
    `<th style="background:#0f172a;color:#fff;padding:7pt 5pt;font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;text-align:${c.a};border:0.5pt solid #0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escapeHtml(c.h)}</th>`
  ).join("");

  const rows = opts.items.map((it, idx) => {
    const desc = it.product_description && it.product_description !== it.product_name ? it.product_description : it.product_name;
    const mrp = Number(it.mrp || 0);
    const wrap = "word-break:break-word;white-space:normal;";
    const num = "font-variant-numeric:tabular-nums;font-family:'JetBrains Mono','Courier New',monospace;";
    const cells = [
      { v: String(idx + 1), s: num },
      { v: it.product_name || "", s: `font-weight:600;${wrap}` },
      { v: desc || "", s: wrap },
      { v: String(it.quantity ?? ""), s: num },
      { v: fmtMoney(Number(it.tp_rate || 0)), s: num },
      { v: it.batch_number || "", s: num + wrap },
      { v: fmtExpiryMMYY(it.expiry_date), s: num },
      { v: fmtMoney(Number(it.discount || 0)), s: num },
      { v: fmtMoney(Number(it.amount || 0)), s: num + "font-weight:600;" },
      { v: mrp > 0 ? fmtMoney(mrp) : "—", s: num },
    ];
    return `<tr>${cells.map((c, i) =>
      `<td style="padding:6pt 5pt;font-size:9pt;color:#0f172a;text-align:${cols[i].a};border:0.5pt solid #cbd5e1;${c.s}">${escapeHtml(String(c.v))}</td>`
    ).join("")}</tr>`;
  }).join("");

  const totalWords = numberToWords(opts.total);

  const declarationEnabled = s?.warranty_declaration_enabled !== false;
  const declarationSource = (s?.warranty_note_text && s.warranty_note_text.trim()) || WARRANTY_NOTE_TEXT;
  const declarationBlocks = declarationSource
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);
  const declarationInner = declarationBlocks.map(block => {
    const m = block.match(/^(\d+)\.\s+([\s\S]+)$/);
    if (m) {
      return `<div style="display:flex;gap:8pt;margin:4pt 0;text-align:justify;">
        <span style="font-weight:700;min-width:14pt;flex-shrink:0;">${m[1]}.</span>
        <span style="flex:1;">${escapeHtml(m[2])}</span>
      </div>`;
    }
    return `<p style="margin:5pt 0;text-align:justify;">${escapeHtml(block)}</p>`;
  }).join("");
  const declarationHtml = declarationEnabled ? `
    <section class="no-break" data-pdf-section="declaration" style="margin-top:10pt;padding:8pt 10pt;border:0.5pt solid #cbd5e1;border-left:2pt solid #0f172a;">
      <div style="font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:#475569;margin-bottom:5pt;">Warranty Declaration</div>
      <div style="font-size:9.5pt;line-height:1.5;color:#0f172a;font-family:'Inter',sans-serif;">${declarationInner}</div>
    </section>` : "";

  const signatureHtml = `
    <section class="no-break" data-pdf-section="signatures" style="margin-top:18pt;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:50%;padding-right:16pt;vertical-align:bottom;">
            <div style="height:36pt;"></div>
            <div style="border-top:0.75pt solid #0f172a;padding-top:4pt;font-size:9pt;font-weight:700;color:#0f172a;text-align:center;text-transform:uppercase;letter-spacing:0.08em;">Prepared By</div>
          </td>
          <td style="width:50%;padding-left:16pt;vertical-align:bottom;">
            <div style="height:36pt;"></div>
            <div style="border-top:0.75pt solid #0f172a;padding-top:4pt;font-size:9pt;font-weight:700;color:#0f172a;text-align:center;text-transform:uppercase;letter-spacing:0.08em;">Stamp / Authorised Signature</div>
          </td>
        </tr>
      </table>
    </section>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Warranty Note — ${escapeHtml(opts.invoiceNumber)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:#fff; color:#0f172a;
    font-family:'Inter','Segoe UI',sans-serif;
    -webkit-print-color-adjust:exact; print-color-adjust:exact;
    -webkit-font-smoothing:antialiased;
  }
  .warranty-document {
    width: 190mm;
    max-width: 190mm;
    margin: 0 auto;
    padding: 0;
    overflow: visible;
    box-sizing: border-box;
  }
  table { border-collapse: collapse; }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    page-break-inside: auto;
  }
  .items-table tr { page-break-inside: avoid; page-break-after: auto; }
  .items-table thead { display: table-header-group; }
  .items-table tfoot { display: table-footer-group; }
  .no-break { page-break-inside: avoid; }
  @media print {
    html, body { width: 210mm; margin:0; padding:0; overflow:visible; }
    .warranty-document { width: 190mm; max-width: 190mm; margin:0 auto; }
  }
</style></head><body><div class="warranty-document">

  <section data-pdf-section="header" class="no-break">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:35%;vertical-align:top;">${logo}</td>
        <td style="width:65%;vertical-align:top;text-align:right;">
          <div style="font-size:18pt;font-weight:800;letter-spacing:-0.3px;color:#0f172a;line-height:1.15;">${escapeHtml(company)}</div>
          ${companyLines.map(l => `<div style="font-size:9pt;color:#475569;line-height:1.5;margin-top:1pt;">${escapeHtml(l)}</div>`).join("")}
        </td>
      </tr>
    </table>
  </section>

  <section data-pdf-section="title" class="no-break" style="margin:10pt 0 8pt;padding:6pt 0;border-top:1.5pt solid #0f172a;border-bottom:1.5pt solid #0f172a;text-align:center;">
    <div style="font-size:18pt;font-weight:800;letter-spacing:1.4pt;text-transform:uppercase;color:#0f172a;">Warranty Note</div>
  </section>

  <section data-pdf-section="details" class="no-break" style="margin-bottom:8pt;">
    <table style="width:100%;border-collapse:collapse;border:0.5pt solid #cbd5e1;">
      <tr>
        <td style="width:60%;padding:8pt 10pt;vertical-align:top;border-right:0.5pt solid #cbd5e1;">
          <table style="width:100%;border-collapse:collapse;">${leftBlock}</table>
        </td>
        <td style="width:40%;padding:8pt 10pt;vertical-align:top;background:#f8fafc;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <table style="width:100%;border-collapse:collapse;">${rightBlock}</table>
        </td>
      </tr>
    </table>
  </section>

  <section data-pdf-section="products">
    <table class="items-table">
      ${colgroup}
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows || `<tr><td colspan="${cols.length}" style="padding:12pt;text-align:center;color:#94a3b8;font-style:italic;font-size:9pt;border:0.5pt solid #cbd5e1;">No items</td></tr>`}</tbody>
    </table>
  </section>

  <section data-pdf-section="totals" class="no-break" style="margin-top:8pt;display:flex;justify-content:flex-end;">
    <table style="border-collapse:collapse;min-width:200pt;">
      ${opts.discountAmount && opts.discountAmount > 0 ? `
      <tr>
        <td style="padding:3pt 14pt 3pt 0;font-size:9.5pt;color:#475569;text-align:right;">${escapeHtml(opts.discountLabel || "Discount")}:</td>
        <td style="padding:3pt 0;font-size:10pt;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;font-family:'JetBrains Mono',monospace;">- Rs. ${fmtMoney(opts.discountAmount)}</td>
      </tr>` : ""}
      <tr>
        <td style="padding:6pt 14pt 6pt 0;font-size:11pt;font-weight:700;text-align:right;color:#0f172a;border-top:1.5pt solid #0f172a;">Total:</td>
        <td style="padding:6pt 0;font-size:13pt;font-weight:800;text-align:right;font-variant-numeric:tabular-nums;font-family:'JetBrains Mono',monospace;border-top:1.5pt solid #0f172a;">Rs. ${fmtMoney(opts.total)}</td>
      </tr>
    </table>
  </section>

  ${declarationHtml}

  <section data-pdf-section="words" class="no-break" style="margin-top:8pt;font-size:9pt;line-height:1.55;">
    <div><span style="color:#475569;font-weight:600;">Total in Words:</span> <span style="color:#0f172a;">${escapeHtml(totalWords)}.</span></div>
    <div style="margin-top:2pt;"><span style="color:#475569;font-weight:600;">Invoice Balance in Words:</span> <span style="color:#0f172a;">${escapeHtml(totalWords)}.</span></div>
  </section>

  ${signatureHtml}

  <section data-pdf-section="footer" class="no-break" style="margin-top:14pt;padding-top:6pt;border-top:0.5pt solid #cbd5e1;text-align:center;">
    <div style="font-size:8pt;color:#94a3b8;font-style:italic;">This is a system generated document and does not require any signatures.</div>
  </section>

</div></body></html>`;
}

function applyWarrantyPageMode(html: string, opts: WarrantyNoteOptions): string {
  const mode = resolvePageMode(opts.pageMode ?? (opts.settings as any)?.document_page_mode, opts.items?.length || 0, HALF_PAGE_WARRANTY_LIMIT);
  return mode === "half" ? wrapHalfPage(html) : tagFullPage(html);
}

export function generateWarrantyNoteHtml(opts: WarrantyNoteOptions): string {
  return applyWarrantyPageMode(buildWarrantyNoteHtml(opts), opts);
}

export function generateWarrantyNoteViews(opts: WarrantyNoteOptions): PdfViewSpec[] {
  const mode = resolvePageMode(opts.pageMode ?? (opts.settings as any)?.document_page_mode, opts.items?.length || 0, HALF_PAGE_WARRANTY_LIMIT);
  const label = mode === "half" ? "Half A4" : "A4 Print";
  return [
    { key: "a4", label, color: "bg-slate-900 text-white border-slate-900", html: applyWarrantyPageMode(buildWarrantyNoteHtml(opts), opts) },
  ];
}


