import type { CompanySettings } from "@/hooks/useCompanySettings";
import type { DocumentTemplate } from "@/hooks/useDocumentTemplates";
// NOTE: Warranty Invoice now lives in its own module under
// src/components/warranty/WarrantyInvoiceTemplate.tsx and is rendered via the
// dedicated route /print-preview/warranty-invoice/:id. The old hardcoded
// warranty layout / declaration template was removed from this file.

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

  /* ── HEADER: logo left · company right ──
     Logo uses crossorigin + onerror fallback so a broken/blocked image swaps to
     a large branded text block instead of leaving the left side blank. */
  const safeCompany = escapeHtml(companyName);
  const logoHtml = s?.logo_url
    ? `<img src="${s.logo_url}" alt="${safeCompany}" crossorigin="anonymous"
            style="height:216px !important;width:auto !important;max-width:675px !important;object-fit:contain;display:block;vertical-align:middle;"
            onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block';" /><div style="display:none;font-size:26px;font-weight:800;color:${C.text};letter-spacing:-0.3px;line-height:1;">${safeCompany}</div>`
    : `<div style="font-size:26px;font-weight:800;color:${C.text};letter-spacing:-0.3px;line-height:1;">${safeCompany}</div>`;

  const addressLine = [s?.address, (s as any)?.city].filter(Boolean).join(", ");
  const phoneLine = [s?.phone ? `Tel: ${s.phone}` : null, (s as any)?.whatsapp_number ? `Mob: ${(s as any).whatsapp_number}` : null].filter(Boolean).join("  ·  ");
  const webLine = [s?.email, s?.website].filter(Boolean).join("  ·  ");
  const idLine = [s?.ntn ? `NTN: ${s.ntn}` : null, s?.strn ? `STRN: ${s.strn}` : null].filter(Boolean).join("  ·  ");

  const companyBlock = `
    <div style="text-align:right;">
      <div style="font-size:19px;font-weight:800;color:${C.text};letter-spacing:-0.2px;line-height:1.15;">${safeCompany}</div>
      ${tagline ? `<div style="font-size:13px;font-style:italic;color:${C.textMuted};margin-top:2px;">${escapeHtml(tagline)}</div>` : ""}
      ${[addressLine, phoneLine, webLine, idLine].filter(Boolean).map(l => `<div style="font-size:12.5px;color:${C.textMuted};line-height:1.45;margin-top:1px;word-break:break-word;">${escapeHtml(l)}</div>`).join("")}
    </div>`;

  /* ── DOCUMENT TITLE (centered) ── */
  const titleBlock = `
    <div style="text-align:center;margin-top:10px;">
      <div style="font-size:24px;font-weight:800;color:${C.text};letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(docTitle)}</div>
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
      <div style="background:${C.cardBg};padding:6px 12px;border-bottom:1px solid ${C.border};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.6px;color:${C.primary};-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escapeHtml(opts.partyLabel || "Bill To")}</div>
      <div style="padding:10px 12px;word-wrap:break-word;overflow-wrap:anywhere;">
        ${opts.partyName ? `<div style="font-size:15px;font-weight:700;color:${C.text};line-height:1.25;">${escapeHtml(opts.partyName)}</div>` : ""}
        ${phoneBits.length ? `<div style="font-size:13px;color:${C.text};margin-top:5px;font-weight:600;">${phoneBits.join("  ·  ")}</div>` : ""}
        ${cityArea ? `<div style="font-size:13px;color:${C.text};margin-top:3px;">${escapeHtml(cityArea)}</div>` : ""}
        ${opts.partyAddress ? `<div style="font-size:12px;color:${C.textMuted};margin-top:3px;line-height:1.45;">${escapeHtml(opts.partyAddress)}</div>` : ""}
        ${opts.partyNtn ? `<div style="font-size:11.5px;color:${C.textMuted};margin-top:4px;">NTN: ${escapeHtml(opts.partyNtn)}</div>` : ""}
        ${t?.show_party_license && opts.partyLicense ? `<div style="font-size:11.5px;color:${C.textMuted};">License: ${escapeHtml(opts.partyLicense)}</div>` : ""}
        ${t?.show_party_cnic && opts.partyCnic ? `<div style="font-size:11.5px;color:${C.textMuted};">CNIC: ${escapeHtml(opts.partyCnic)}</div>` : ""}
        ${opts.partyAccountCode ? `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:${C.textLight};margin-top:4px;">A/C: ${escapeHtml(opts.partyAccountCode)}</div>` : ""}
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
    if (SERIAL_KEYS.has(c.key)) return "width:6%;";
    if (isProductName) return hasMoneyCol ? "width:28%;" : "width:46%;";
    if (k === "product_code" || k === "code" || k === "sku") return "width:10%;";
    if (k === "batch_number" || k === "batch") return hasMoneyCol ? "width:11%;" : "width:16%;";
    if (k === "expiry_date" || k === "expiry") return hasMoneyCol ? "width:10%;" : "width:14%;";
    if (k === "quantity" || k === "qty") return hasMoneyCol ? "width:11%;" : "width:14%;";
    if (k === "rate" || k === "tp_rate" || k === "price") return "width:8%;";
    if (k === "mrp" || k === "mrp_inc_tax") return "width:11%;";
    if (k === "discount" || k === "discount_pct" || k === "disc") return "width:7%;";
    if (k === "tax" || k === "gst_rate" || k === "gst") return "width:7%;";
    if (k === "amount" || k === "line_total" || k === "total") return "width:12%;";
    return "";
  };

  const headerCells = columns.map(c => {
    return `
    <th style="padding:8px 4px;text-align:${thAlign(c)};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0;color:${C.text};background:#eef0f3;border-bottom:2px solid ${C.text};${colWidth(c)}white-space:normal;line-height:1.2;word-break:normal;overflow-wrap:normal;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escapeHtml(c.header)}</th>`;
  }).join("");

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
      const wrap = "white-space:normal;word-break:break-word;overflow-wrap:anywhere;line-height:1.35;";
      return `<td style="padding:7px 6px;font-size:12.5px;text-align:${thAlign(c)};border-bottom:1px solid ${C.border};color:${C.text};font-family:${fontFamily};font-weight:${fontWeight};${wrap}${colWidth(c)}">${escapeHtml(valStr)}</td>`;
    }).join("");
    return `<tr data-row="item" style="background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;">${cells}</tr>`;
  }).join("");

  const itemsTable = `
    <div data-pdf-section="items" style="margin-top:14px;border:1px solid ${C.border};border-radius:3px;">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows || `<tr><td colspan="${columns.length}" style="padding:20px;text-align:center;font-size:12px;color:${C.textLight};font-style:italic;">No items</td></tr>`}</tbody>
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

  const docKind = /delivery\s*note/i.test(docTitle) ? "delivery-note"
    : /sales\s*order|proforma/i.test(docTitle) ? "sales-order"
    : /invoice/i.test(docTitle) ? "sales-invoice"
    : "document";

  return `<!DOCTYPE html><html><head>
<meta name="doc-kind" content="${docKind}">
<meta name="item-count" content="${opts.rows.length}">
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
  .page-frame { position:relative; max-width:794px; margin:0 auto; padding:6px 24px 18px; background:#fff; border:1px solid ${C.border}; box-shadow:0 8px 30px rgba(0,0,0,0.08); page-break-after:avoid; break-after:avoid; }
  table.doc-header { width:100%; border-collapse:collapse; border-bottom:1px solid ${C.border}; margin-bottom:4px; }
  table.doc-header td { vertical-align:middle; padding:8px 0; }
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
</style></head><body data-doc-kind="${docKind}" data-item-count="${opts.rows.length}">
<div class="toolbar">
  <div class="toolbar-title">${escapeHtml(docTitle)} — ${escapeHtml(opts.documentNumber)}</div>
  <button class="toolbar-btn" onclick="window.print()">Download / Print</button>
</div>

<div class="page-frame" data-doc-kind="${docKind}" data-item-count="${opts.rows.length}">
  
  <table class="doc-header"><tr>
    <td style="width:55%;text-align:left;">${logoHtml}</td>
    <td style="width:45%;text-align:right;">${companyBlock}</td>
  </tr></table>
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
  /* === Half-A4 overrides — content in top half of A4, lower half blank === */
  @page { size: A4 portrait; margin: 0; }
  html, body { background:#fff !important; margin:0 !important; padding:0 !important; }
  .toolbar { display:none !important; }
  /* The sheet IS one full A4 page; only padding-bottom keeps the lower half empty */
  .page-frame, .warranty-document, .page {
    width: 210mm !important;
    max-width: 210mm !important;
    min-height: auto !important;
    height: auto !important;
    max-height: none !important;
    margin: 0 auto !important;
    padding: 8mm 10mm 4mm 10mm !important;
    border: none !important;
    box-shadow: none !important;
    background: #fff !important;
    overflow: visible !important;
    box-sizing: border-box !important;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  /* Density pass — preserve layout, shrink chrome to fit upper half (~138mm content) */
  .page-frame .doc-header { padding-bottom: 6pt !important; }
  .page-frame img { height: 135px !important; max-height: 135px !important; max-width: 360px !important; }
  .page-frame [style*="font-size:46px"],
  .page-frame [style*="font-size:42px"],
  .page-frame [style*="font-size:38px"] { font-size: 22pt !important; line-height: 1.05 !important; }
  .page-frame [style*="font-size:26px"] { font-size: 14pt !important; }
  .page-frame [style*="font-size:24px"] { font-size: 12pt !important; }
  .page-frame [style*="font-size:19px"] { font-size: 10.5pt !important; }
  .page-frame [style*="font-size:16px"],
  .page-frame [style*="font-size:15px"] { font-size: 9pt !important; line-height: 1.3 !important; }
  .page-frame [style*="font-size:14px"] { font-size: 8.5pt !important; line-height: 1.25 !important; }
  .page-frame [style*="font-size:13.5px"],
  .page-frame [style*="font-size:13px"] { font-size: 8pt !important; line-height: 1.25 !important; }
  .page-frame [style*="font-size:12.5px"],
  .page-frame [style*="font-size:12px"],
  .page-frame [style*="font-size:11px"] { font-size: 7.5pt !important; }
  .page-frame [style*="font-size:30px"] { font-size: 14pt !important; }
  /* Tight spacing */
  .page-frame [style*="margin-top:42px"] { margin-top: 6pt !important; }
  .page-frame [style*="margin-top:22px"],
  .page-frame [style*="margin-top:18px"] { margin-top: 5pt !important; }
  .page-frame [style*="margin-top:16px"],
  .page-frame [style*="margin-top:14px"],
  .page-frame [style*="margin-top:12px"] { margin-top: 3pt !important; }
  .page-frame [style*="padding:11px 10px"],
  .page-frame [style*="padding:10px"] { padding: 3pt 5pt !important; }
  .page-frame [style*="padding:14px 16px"] { padding: 4pt 6pt !important; }
  .page-frame [style*="padding:16px 18px"] { padding: 5pt 8pt !important; }
  .page-frame [style*="padding:8px 16px"] { padding: 3pt 6pt !important; }
  /* Totals card narrower */
  .page-frame [style*="width:380px"] { width: 230pt !important; max-width: 62% !important; }
  @media screen {
    body { background:#e2e8f0 !important; padding: 12px 0 !important; }
    .page-frame, .warranty-document, .page {
      box-shadow: 0 4px 18px rgba(0,0,0,0.08) !important;
      outline: 1px dashed #cbd5e1;
    }
  }
  @media print {
    body { background:#fff !important; padding:0 !important; }
    .page-frame, .warranty-document, .page { box-shadow:none !important; outline:none !important; }
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

/* ── A5 PAGE TRANSFORMER (Delivery Note default) ─────────────────────────── */
const A5_PAGE_CSS = `
  @page { size: A5 portrait; margin: 0; }
  html, body { background:#fff !important; margin:0 !important; padding:0 !important; }
  .toolbar { display:none !important; }
  .page-frame, .warranty-document, .page {
    width: 148mm !important; max-width: 148mm !important;
    min-height: 210mm !important; height: 210mm !important;
    margin: 0 auto !important; padding: 7mm 9mm 9mm 9mm !important;
    border: none !important; box-shadow: none !important; background:#fff !important;
    overflow: hidden !important; box-sizing: border-box !important;
    display: flex !important; flex-direction: column !important;
    page-break-after: avoid !important;
  }
  .page-frame .doc-header td:first-child { padding-left:0 !important; }
  .page-frame .doc-header td:last-child { padding-right:0 !important; }
  .page-frame img { height:80px !important; max-height:80px !important; max-width:210px !important; width:auto !important; }
  .page-frame [style*="font-size:46px"],
  .page-frame [style*="font-size:42px"],
  .page-frame [style*="font-size:38px"] { font-size:18pt !important; line-height:1.05 !important; }
  .page-frame [style*="font-size:26px"] { font-size:13pt !important; }
  .page-frame [style*="font-size:24px"] { font-size:12pt !important; }
  .page-frame [style*="font-size:19px"] { font-size:10.5pt !important; }
  .page-frame [style*="font-size:16px"],
  .page-frame [style*="font-size:15px"] { font-size:9.5pt !important; line-height:1.3 !important; }
  .page-frame [style*="font-size:14px"] { font-size:9pt !important; line-height:1.25 !important; }
  .page-frame [style*="font-size:13.5px"],
  .page-frame [style*="font-size:13px"] { font-size:8.5pt !important; line-height:1.25 !important; }
  .page-frame [style*="font-size:12.5px"],
  .page-frame [style*="font-size:12px"] { font-size:8pt !important; }
  .page-frame [style*="font-size:11.5px"],
  .page-frame [style*="font-size:11px"] { font-size:7.5pt !important; }
  .page-frame [style*="font-size:30px"] { font-size:14pt !important; }
  .page-frame [style*="margin-top:42px"] { margin-top:10pt !important; }
  .page-frame [style*="margin-top:22px"],
  .page-frame [style*="margin-top:18px"] { margin-top:6pt !important; }
  .page-frame [style*="margin-top:16px"],
  .page-frame [style*="margin-top:14px"],
  .page-frame [style*="margin-top:12px"] { margin-top:5pt !important; }
  .page-frame .signatures { margin-top:auto !important; padding-top:14pt !important; }
  .page-frame .signatures > div > div { margin-top:22pt !important; }
  @media screen {
    body { background:#e2e8f0 !important; padding:12px 0 !important; }
    .page-frame { box-shadow:0 4px 18px rgba(0,0,0,0.08) !important; outline:1px dashed #cbd5e1; }
  }
  @media print {
    body { background:#fff !important; padding:0 !important; }
    .page-frame { box-shadow:none !important; outline:none !important; }
  }
`;

function wrapA5Page(html: string): string {
  const styleBlock = `<style data-a5-page="1">${A5_PAGE_CSS}</style>`;
  if (/<html\b/i.test(html)) {
    html = html.replace(/<html\b([^>]*)>/i, `<html$1 data-page-mode="a5" data-doc-format="a5">`);
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${styleBlock}</head>`);
  }
  return styleBlock + html;
}

const A5_DELIVERY_ROW_LIMIT = 10;
const isDeliveryNoteTitle = (t?: string) => !!t && /delivery\s*note/i.test(t);
function applyDeliveryPageMode(html: string, opts: PdfOptions): string {
  const rows = opts.rows?.length || 0;
  return rows <= A5_DELIVERY_ROW_LIMIT ? wrapA5Page(html) : tagFullPage(html);
}

/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC API
════════════════════════════════════════════════════════════════════════════ */
export function generatePdfHtml(opts: PdfOptions): string {
  if (isDeliveryNoteTitle(opts.title)) return applyDeliveryPageMode(buildA4Html(opts), opts);
  return applyPageMode(buildA4Html(opts), opts);
}

export function generateWhatsAppHtml(opts: PdfOptions): string {
  if (isDeliveryNoteTitle(opts.title)) return applyDeliveryPageMode(buildA4Html(opts), opts);
  return applyPageMode(buildA4Html(opts), opts);
}

export interface PdfViewSpec { key: string; label: string; color: string; html: string; disabled?: boolean; }

export function generateDocumentViews(opts: PdfOptions): PdfViewSpec[] {
  if (isDeliveryNoteTitle(opts.title)) {
    const rows = opts.rows?.length || 0;
    const useA5 = rows <= A5_DELIVERY_ROW_LIMIT;
    const html = useA5 ? wrapA5Page(buildA4Html(opts)) : tagFullPage(buildA4Html(opts));
    return [{ key: useA5 ? "a5" : "a4", label: useA5 ? "A5 Print" : "A4 Print", color: "bg-slate-900 text-white border-slate-900", html }];
  }
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

// Warranty Invoice generation was removed from this file. The new module owns
// preview, print and PDF via src/components/warranty/WarrantyInvoiceTemplate.tsx
// and the /print-preview/warranty-invoice/:id route. The remaining
// WarrantyNoteItem interface below is kept only because legacy importers may
// still reference the type — it is otherwise unused.




