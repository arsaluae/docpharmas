import type { CompanySettings } from "@/hooks/useCompanySettings";
import type { DocumentTemplate } from "@/hooks/useDocumentTemplates";

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
  // ── New optional fields (premium template) ──
  partyCode?: string;          // Customer/Supplier code e.g. CUS-0042
  partyMobile?: string;        // shown prominently, separate from phone
  partyCity?: string;
  partyAccountCode?: string;   // Chart of accounts code
  salesAgentName?: string;
  salesAgentMobile?: string;
  validity?: string;           // "Valid for 7 days"
  paymentTerms?: string;       // "Net 30", "Cash on Delivery"
  deliveryStatus?: string;     // "Pending", "Dispatched"
  // ── existing ──
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
  draft:      { primary: "#d97706", primaryDark: "#92400e", primaryLight: "#fef3c7", headerBg: "#451a03", headerBgEnd: "#78350f", accent: "#d97706" },
  invoiced:   { primary: "#2563eb", primaryDark: "#1d4ed8", primaryLight: "#dbeafe", headerBg: "#0c1e4d", headerBgEnd: "#1e3a8a", accent: "#2563eb" },
  dispatched: { primary: "#7c3aed", primaryDark: "#5b21b6", primaryLight: "#ede9fe", headerBg: "#2e1065", headerBgEnd: "#4c1d95", accent: "#7c3aed" },
  paid:       { primary: "#059669", primaryDark: "#047857", primaryLight: "#d1fae5", headerBg: "#022c22", headerBgEnd: "#064e3b", accent: "#059669" },
  ordered:    { primary: "#2563eb", primaryDark: "#1d4ed8", primaryLight: "#dbeafe", headerBg: "#0c1e4d", headerBgEnd: "#1e3a8a", accent: "#2563eb" },
  confirmed:  { primary: "#7c3aed", primaryDark: "#5b21b6", primaryLight: "#ede9fe", headerBg: "#2e1065", headerBgEnd: "#4c1d95", accent: "#7c3aed" },
  received:   { primary: "#059669", primaryDark: "#047857", primaryLight: "#d1fae5", headerBg: "#022c22", headerBgEnd: "#064e3b", accent: "#059669" },
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
   A4 PREMIUM TEMPLATE
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

  /* HEADER — large logo + company block on dark band */
  const logoHtml = s?.logo_url
    ? `<img src="${s.logo_url}" alt="${escapeHtml(companyName)}" style="max-height:200px;max-width:340px;object-fit:contain;display:block;" />`
    : `<div style="font-family:'Inter',sans-serif;font-size:42px;font-weight:800;color:#fff;letter-spacing:-1px;line-height:1;">${escapeHtml(companyName)}</div>`;

  const headerLines: string[] = [];
  if (s?.logo_url) headerLines.push(`<div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.3px;line-height:1.15;">${escapeHtml(companyName)}</div>`);
  if (tagline) headerLines.push(`<div style="font-size:12px;font-style:italic;color:rgba(255,255,255,0.72);margin-top:2px;letter-spacing:0.2px;">${escapeHtml(tagline)}</div>`);

  const addressLine = [s?.address, (s as any)?.city].filter(Boolean).join(", ");
  const phoneLine = [s?.phone ? `Tel: ${s.phone}` : null, (s as any)?.whatsapp_number ? `Mob: ${(s as any).whatsapp_number}` : null].filter(Boolean).join(" · ");
  const webLine = [s?.email, s?.website].filter(Boolean).join(" · ");
  const idLine = [s?.ntn ? `NTN: ${s.ntn}` : null, s?.strn ? `STRN: ${s.strn}` : null].filter(Boolean).join("  ·  ");

  const headerDetailsHtml = [addressLine, phoneLine, webLine, idLine]
    .filter(Boolean)
    .map(l => `<div style="font-size:11px;color:rgba(255,255,255,0.85);line-height:1.65;letter-spacing:0.15px;">${escapeHtml(l)}</div>`)
    .join("");

  /* DOC TITLE BAR */
  const titleBar = `
    <div style="display:flex;align-items:stretch;margin-top:0;background:#fff;border:1px solid ${C.border};border-top:none;">
      <div style="flex:1;padding:14px 22px;background:${C.primary};color:#fff;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:3px;opacity:0.85;">${escapeHtml(opts.partyLabel || "Document")}</div>
        <div style="font-size:24px;font-weight:800;letter-spacing:-0.4px;line-height:1.15;margin-top:2px;">${escapeHtml(docTitle)}</div>
      </div>
      <div style="padding:14px 22px;text-align:right;min-width:240px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.textMuted};">Document #</div>
        <div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:18px;font-weight:700;color:${C.text};letter-spacing:0.5px;margin-top:2px;">${escapeHtml(opts.documentNumber)}</div>
        <div style="font-size:11px;color:${C.textMuted};margin-top:6px;">Date: <strong style="color:${C.text};">${escapeHtml(opts.date)}</strong></div>
      </div>
    </div>`;

  /* PARTY (BILL TO) CARD — every available field */
  const billToRows: string[] = [];
  if (opts.partyName) billToRows.push(`<div style="font-size:18px;font-weight:800;color:${C.text};letter-spacing:-0.3px;line-height:1.2;">${escapeHtml(opts.partyName)}</div>`);
  const chips: string[] = [];
  if (opts.partyCode) chips.push(`<span style="display:inline-block;padding:3px 9px;background:${C.primary};color:#fff;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:0.8px;border-radius:3px;">${escapeHtml(opts.partyCode)}</span>`);
  if (opts.partyAccountCode) chips.push(`<span style="display:inline-block;padding:3px 9px;background:${C.borderLight};color:${C.textMuted};font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;letter-spacing:0.6px;border:1px solid ${C.border};border-radius:3px;">A/C: ${escapeHtml(opts.partyAccountCode)}</span>`);
  if (chips.length) billToRows.push(`<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">${chips.join("")}</div>`);

  if (opts.partyMobile) billToRows.push(`<div style="margin-top:10px;font-size:15px;font-weight:700;color:${C.text};letter-spacing:0.2px;">📱 ${escapeHtml(opts.partyMobile)}</div>`);
  if (opts.partyPhone && opts.partyPhone !== opts.partyMobile) billToRows.push(`<div style="font-size:12px;color:${C.textMuted};margin-top:2px;">☎ ${escapeHtml(opts.partyPhone)}</div>`);

  const cityArea = [opts.partyCity, opts.partyArea].filter(Boolean).join(" · ");
  if (cityArea) billToRows.push(`<div style="font-size:12px;color:${C.textMuted};margin-top:6px;font-weight:600;">📍 ${escapeHtml(cityArea)}</div>`);
  if (opts.partyAddress) billToRows.push(`<div style="font-size:12px;color:${C.textMuted};margin-top:3px;line-height:1.55;">${escapeHtml(opts.partyAddress)}</div>`);
  if (opts.partyNtn) billToRows.push(`<div style="font-size:10px;color:${C.textLight};margin-top:6px;letter-spacing:0.4px;">NTN: ${escapeHtml(opts.partyNtn)}</div>`);
  if (t?.show_party_license && opts.partyLicense) billToRows.push(`<div style="font-size:10px;color:${C.textLight};letter-spacing:0.4px;">License: ${escapeHtml(opts.partyLicense)}</div>`);
  if (t?.show_party_cnic && opts.partyCnic) billToRows.push(`<div style="font-size:10px;color:${C.textLight};letter-spacing:0.4px;">CNIC: ${escapeHtml(opts.partyCnic)}</div>`);

  /* DOC INFO CARD (right) */
  const infoRows: { label: string; value: string }[] = [];
  if (opts.salesAgentName) infoRows.push({ label: "Sales Agent", value: opts.salesAgentName + (opts.salesAgentMobile ? `  ·  ${opts.salesAgentMobile}` : "") });
  if (opts.validity) infoRows.push({ label: "Validity", value: opts.validity });
  if (opts.paymentTerms) infoRows.push({ label: "Payment Terms", value: opts.paymentTerms });
  if (opts.deliveryStatus) infoRows.push({ label: "Delivery", value: opts.deliveryStatus });
  (opts.meta || []).forEach(m => infoRows.push({ label: m.label, value: m.value }));

  const infoRowsHtml = infoRows.length
    ? infoRows.map((r, i) => `
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:8px 0;${i < infoRows.length - 1 ? `border-bottom:1px dashed ${C.border};` : ""}">
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${C.textMuted};">${escapeHtml(r.label)}</span>
          <span style="font-size:12px;font-weight:600;color:${C.text};text-align:right;">${escapeHtml(r.value)}</span>
        </div>`).join("")
    : `<div style="font-size:11px;color:${C.textLight};font-style:italic;">No additional details</div>`;

  const partyBlock = `
    <div style="display:flex;gap:14px;margin-top:18px;">
      <div style="flex:1.4;background:#fff;border:1px solid ${C.border};border-left:5px solid ${C.primary};padding:16px 18px;border-radius:2px;min-width:0;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:${C.primary};margin-bottom:10px;">${escapeHtml(opts.partyLabel ? opts.partyLabel.toUpperCase() : "Bill To")}</div>
        ${billToRows.join("")}
      </div>
      <div style="flex:1;background:${C.cardBg};border:1px solid ${C.border};padding:16px 18px;border-radius:2px;min-width:0;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:${C.primary};margin-bottom:8px;">Document Info</div>
        ${infoRowsHtml}
      </div>
    </div>`;

  /* ITEMS TABLE — taller rows, wider product name, no truncation */
  const thAlign = (c: PdfColumn) => c.align || "left";
  const colWidth = (c: PdfColumn) => {
    const k = c.key.toLowerCase();
    if (SERIAL_KEYS.has(c.key)) return "width:34px;";
    if (k === "product_code" || k === "code" || k === "sku") return "width:90px;";
    if (k === "batch_number" || k === "batch") return "width:90px;";
    if (k === "expiry_date" || k === "expiry") return "width:80px;";
    if (k === "quantity" || k === "qty") return "width:62px;";
    if (k === "rate" || k === "tp_rate" || k === "price") return "width:80px;";
    if (k === "mrp" || k === "mrp_inc_tax") return "width:78px;";
    if (k === "discount" || k === "discount_pct" || k === "disc") return "width:64px;";
    if (k === "tax" || k === "gst_rate" || k === "gst") return "width:60px;";
    if (k === "amount" || k === "line_total" || k === "total") return "width:100px;";
    return ""; // product_name & description flex
  };

  const headerCells = columns.map(c => `
    <th class="items-th" style="padding:13px 12px;text-align:${thAlign(c)};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#fff;background:${C.headerBg};border-bottom:3px solid ${C.primary};-webkit-print-color-adjust:exact;print-color-adjust:exact;${colWidth(c)}white-space:nowrap;">${escapeHtml(c.header)}</th>`).join("");

  const bodyRows = opts.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#ffffff" : C.rowAlt;
    const cells = columns.map(c => {
      const isNum = c.align === "right";
      const isSerial = SERIAL_KEYS.has(c.key);
      const isProductName = c.key === "product_name" || c.key === "name" || c.key === "item_name" || c.key === "description";
      const value = resolveCell(row, c.key, i);
      const valStr = value === null || value === undefined ? "" : String(value);
      const fontFamily = isNum || isSerial || /batch|code|expiry/i.test(c.key) ? "'JetBrains Mono','Courier New',monospace" : "'Inter',sans-serif";
      const fontWeight = isProductName ? "600" : isNum ? "600" : "400";
      const wrap = isProductName ? "white-space:normal;word-break:break-word;line-height:1.4;" : "white-space:nowrap;";
      return `<td style="padding:12px 12px;font-size:13px;text-align:${thAlign(c)};border-bottom:1px solid ${C.border};color:${C.text};font-family:${fontFamily};font-weight:${fontWeight};letter-spacing:0.2px;${wrap}${colWidth(c)}">${escapeHtml(valStr)}</td>`;
    }).join("");
    return `<tr style="background:${bg};">${cells}</tr>`;
  }).join("");

  const itemsTable = `
    <div style="margin-top:18px;overflow:hidden;border-radius:3px;border:1px solid ${C.border};">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows || `<tr><td colspan="${columns.length}" style="padding:24px;text-align:center;font-size:12px;color:${C.textLight};font-style:italic;">No items</td></tr>`}</tbody>
      </table>
    </div>`;

  /* TOTALS — premium summary card with hero grand total */
  const totals = opts.totals || [];
  const grandTotal = totals[totals.length - 1];
  const subRows = totals.slice(0, -1);
  const totalAmount = grandTotal ? parseFloat(grandTotal.value.replace(/[^0-9.]/g, "")) : 0;

  const totalsCard = totals.length ? `
    <div style="display:flex;gap:20px;margin-top:20px;align-items:flex-start;">
      <div style="flex:1;"></div>
      <div style="width:380px;max-width:55%;">
        ${subRows.length ? `
          <div style="background:#fff;border:1px solid ${C.border};border-radius:3px;overflow:hidden;">
            ${subRows.map((r, i) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;font-size:13px;${i < subRows.length - 1 ? `border-bottom:1px solid ${C.borderLight};` : ""}background:${i % 2 === 0 ? '#fff' : C.cardBg};">
                <span style="color:${C.textMuted};font-weight:500;letter-spacing:0.3px;">${escapeHtml(r.label)}</span>
                <span style="color:${C.text};font-family:'JetBrains Mono',monospace;font-weight:600;letter-spacing:0.4px;">${escapeHtml(r.value)}</span>
              </div>`).join("")}
          </div>` : ""}
        ${grandTotal ? `
          <div style="margin-top:10px;padding:18px 20px;background:linear-gradient(135deg,${C.headerBg},${C.headerBgEnd});border-radius:3px;color:#fff;box-shadow:0 4px 14px rgba(15,23,42,0.18);-webkit-print-color-adjust:exact;print-color-adjust:exact;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.72);">${escapeHtml(grandTotal.label || "Grand Total")}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:32px;font-weight:800;letter-spacing:0.4px;margin-top:4px;line-height:1.1;">${escapeHtml(grandTotal.value)}</div>
            <div style="height:3px;width:60px;background:${C.primary};margin-top:8px;border-radius:2px;"></div>
          </div>` : ""}
      </div>
    </div>` : "";

  const totalInWordsHtml = totalAmount ? `
    <div style="margin-top:14px;padding:11px 16px;background:${C.cardBg};border:1px solid ${C.border};border-left:4px solid ${C.primary};border-radius:2px;">
      <span style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.primary};">Amount in Words </span>
      <span style="font-size:12px;color:${C.text};font-style:italic;line-height:1.5;">${escapeHtml(numberToWords(totalAmount))}</span>
    </div>` : "";

  /* FOOTER — sales agent + signatures + bank + certification */
  const agentFooter = opts.salesAgentName ? `
    <div style="margin-top:20px;padding:12px 16px;background:${C.cardBg};border:1px solid ${C.border};border-radius:2px;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">
      <div>
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.primary};">Sales Agent</div>
        <div style="font-size:14px;font-weight:700;color:${C.text};margin-top:2px;">${escapeHtml(opts.salesAgentName)}</div>
      </div>
      ${opts.salesAgentMobile ? `<div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:${C.text};letter-spacing:0.4px;">📱 ${escapeHtml(opts.salesAgentMobile)}</div>` : ""}
    </div>` : "";

  const bankHtml = showBankDetails && bankDetailsText ? `
    <div style="margin-top:14px;padding:11px 16px;background:${C.cardBg};border:1px solid ${C.border};border-left:4px solid ${C.primary};border-radius:2px;">
      <span style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.primary};">Bank Details </span>
      <span style="font-size:12px;color:${C.text};">${escapeHtml(bankDetailsText)}</span>
    </div>` : "";

  const footerCert = footerText ? `
    <div style="margin-top:14px;padding:13px 16px;background:${C.cardBg};border-left:4px solid ${C.primary};border-radius:0 2px 2px 0;">
      <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.primary};margin-bottom:5px;">Certification</div>
      <div style="font-size:10.5px;color:${C.textMuted};line-height:1.65;font-style:italic;">${escapeHtml(footerText)}</div>
    </div>` : "";

  const notesHtml = opts.notes ? `
    <div style="margin-top:14px;padding:11px 16px;background:${C.cardBg};border:1px solid ${C.border};border-radius:2px;">
      <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.primary};">Notes</div>
      <div style="font-size:11.5px;color:${C.text};line-height:1.6;margin-top:4px;">${escapeHtml(opts.notes)}</div>
    </div>` : "";

  const signatures = `
    <div style="margin-top:36px;display:flex;justify-content:space-between;gap:30px;">
      ${signatureLabels.map(l => `
        <div style="flex:1;text-align:center;max-width:240px;">
          <div style="border-top:1.5px solid ${C.text};padding-top:8px;margin-top:48px;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:${C.textMuted};">${escapeHtml(l)}</div>
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
    background:linear-gradient(135deg,${C.headerBg},${C.headerBgEnd});
    padding:12px 24px; display:flex; align-items:center; justify-content:space-between;
    box-shadow:0 4px 24px rgba(0,0,0,0.18); }
  .toolbar-title { color:#e2e8f0; font-size:13px; font-weight:600; letter-spacing:0.4px; }
  .toolbar-btn { background:${C.primary}; color:#fff; border:none; padding:9px 22px; font-size:12.5px; font-weight:600; letter-spacing:0.4px; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; gap:7px; }
  .toolbar-btn:hover { background:${C.primaryDark}; }
  .page-frame { max-width:820px; margin:74px auto 36px; padding:0; background:#fff; border:1px solid ${C.border}; box-shadow:0 8px 36px rgba(0,0,0,0.10); }
  .doc-header { background:linear-gradient(135deg,${C.headerBg},${C.headerBgEnd}); padding:24px 28px; display:flex; align-items:center; justify-content:space-between; gap:24px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .doc-header-accent { height:5px; background:linear-gradient(90deg,${C.primary} 0%,${C.primaryLight} 50%,${C.primary} 100%); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .doc-body { padding:0 28px 30px; }
  @media print {
    body { padding:0; background:#fff; }
    *, *::before, *::after { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    .toolbar { display:none !important; }
    .page-frame { border:none; box-shadow:none; max-width:100%; margin:0; }
    .doc-header { padding:18px 22px; }
    .doc-body { padding:0 22px 22px; }
    table { page-break-inside:auto; }
    thead { display:table-header-group; }
    tfoot { display:table-footer-group; }
    tr { page-break-inside:avoid; }
    @page { margin:8mm 6mm; size:A4; }
  }
</style></head><body>
<div class="toolbar">
  <div class="toolbar-title">${escapeHtml(docTitle)} — ${escapeHtml(opts.documentNumber)}</div>
  <button class="toolbar-btn" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:15px;height:15px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
    Download / Print
  </button>
</div>

<div class="page-frame">
  <div class="doc-header">
    <div style="flex-shrink:0;">${logoHtml}</div>
    <div style="text-align:right;min-width:0;">
      ${headerLines.join("")}
      <div style="margin-top:${headerLines.length ? 8 : 0}px;">${headerDetailsHtml}</div>
    </div>
  </div>
  <div class="doc-header-accent"></div>
  ${titleBar}
  <div class="doc-body">
    ${partyBlock}
    ${itemsTable}
    ${totalsCard}
    ${totalInWordsHtml}
    ${notesHtml}
    ${agentFooter}
    ${bankHtml}
    ${footerCert}
    ${signatures}
  </div>
</div>
</body></html>`;
}

/* ════════════════════════════════════════════════════════════════════════════
   WHATSAPP / MOBILE PORTRAIT TEMPLATE
════════════════════════════════════════════════════════════════════════════ */
function buildWhatsAppHtml(opts: PdfOptions): string {
  const C = getColors(opts.statusTheme);
  const s = opts.settings;
  const companyName = s?.company_name || "Company Name";
  const docTitle = (opts.template?.title || opts.title);

  const logoHtml = s?.logo_url
    ? `<img src="${s.logo_url}" alt="${escapeHtml(companyName)}" style="max-height:140px;max-width:280px;object-fit:contain;display:block;margin:0 auto;" />`
    : `<div style="font-size:34px;font-weight:800;color:#fff;letter-spacing:-0.5px;text-align:center;">${escapeHtml(companyName)}</div>`;

  const totals = opts.totals || [];
  const grand = totals[totals.length - 1];
  const subRows = totals.slice(0, -1);
  const totalAmt = grand ? parseFloat(grand.value.replace(/[^0-9.]/g, "")) : 0;

  // Stacked item cards (no table) — phone-friendly
  const itemCols = opts.template?.columns_config?.length ? opts.template.columns_config : opts.columns;
  const itemCards = opts.rows.map((row, i) => {
    const name = resolveCell(row, "product_name", i) || resolveCell(row, "name", i) || resolveCell(row, "item_name", i) || "Item";
    const qty = resolveCell(row, "quantity", i) || resolveCell(row, "qty", i) || "";
    const rate = resolveCell(row, "rate", i) || resolveCell(row, "tp_rate", i) || "";
    const amount = resolveCell(row, "amount", i) || resolveCell(row, "line_total", i) || "";
    const batch = resolveCell(row, "batch_number", i);
    const expiry = resolveCell(row, "expiry_date", i);
    const meta = [batch ? `Batch ${batch}` : null, expiry ? `Exp ${expiry}` : null].filter(Boolean).join(" · ");
    return `
      <div style="background:#fff;border:1px solid ${C.border};border-left:4px solid ${C.primary};border-radius:6px;padding:12px 14px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:700;color:${C.text};line-height:1.3;word-break:break-word;">${i + 1}. ${escapeHtml(String(name))}</div>
            ${meta ? `<div style="font-size:11px;color:${C.textMuted};margin-top:3px;font-family:'JetBrains Mono',monospace;">${escapeHtml(meta)}</div>` : ""}
            ${qty || rate ? `<div style="font-size:13px;color:${C.textMuted};margin-top:5px;">${qty ? `Qty <strong style="color:${C.text};">${escapeHtml(String(qty))}</strong>` : ""}${qty && rate ? "  ×  " : ""}${rate ? `Rate <strong style="color:${C.text};">${escapeHtml(String(rate))}</strong>` : ""}</div>` : ""}
          </div>
          ${amount ? `<div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:${C.text};white-space:nowrap;">${escapeHtml(String(amount))}</div>` : ""}
        </div>
      </div>`;
  }).join("") || `<div style="text-align:center;color:${C.textLight};padding:24px;font-style:italic;">No items</div>`;

  const infoChips: string[] = [];
  if (opts.partyCode) infoChips.push(opts.partyCode);
  if (opts.partyCity) infoChips.push(opts.partyCity);
  if (opts.partyArea) infoChips.push(opts.partyArea);

  return `<!DOCTYPE html><html><head>
<title>${escapeHtml(docTitle)} — ${escapeHtml(opts.documentNumber)} · WhatsApp</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter','Segoe UI',sans-serif; color:${C.text}; background:#cbd5e1; -webkit-font-smoothing:antialiased; font-variant-numeric:tabular-nums; padding:20px 0; }
  .toolbar { position:fixed; top:0; left:0; right:0; z-index:1000;
    background:linear-gradient(135deg,#075E54,#128C7E);
    padding:12px 24px; display:flex; align-items:center; justify-content:space-between;
    box-shadow:0 4px 24px rgba(0,0,0,0.18); }
  .toolbar-title { color:#fff; font-size:13px; font-weight:600; letter-spacing:0.4px; }
  .toolbar-btn { background:#25D366; color:#fff; border:none; padding:9px 22px; font-size:12.5px; font-weight:600; letter-spacing:0.4px; border-radius:5px; cursor:pointer; display:inline-flex; align-items:center; gap:7px; }
  .wa-frame { width:720px; max-width:96vw; margin:60px auto 0; background:#f1f5f9; border-radius:14px; overflow:hidden; box-shadow:0 16px 50px rgba(0,0,0,0.18); }
  @media print {
    body { background:#fff; padding:0; }
    .toolbar { display:none !important; }
    .wa-frame { margin:0; box-shadow:none; border-radius:0; width:100%; max-width:100%; }
    *, *::before, *::after { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    @page { size:auto; margin:6mm; }
  }
</style></head><body>
<div class="toolbar">
  <div class="toolbar-title">WhatsApp Share — ${escapeHtml(opts.documentNumber)}</div>
  <button class="toolbar-btn" onclick="window.print()">Download / Print</button>
</div>

<div class="wa-frame">
  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,${C.headerBg},${C.headerBgEnd});padding:24px 22px;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    ${logoHtml}
    ${s?.logo_url ? `<div style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.2px;margin-top:10px;">${escapeHtml(companyName)}</div>` : ""}
    ${s?.phone ? `<div style="font-size:12px;color:rgba(255,255,255,0.78);margin-top:4px;letter-spacing:0.3px;">${escapeHtml(s.phone)}${s?.email ? `  ·  ${escapeHtml(s.email)}` : ""}</div>` : ""}
  </div>

  <!-- DOC BADGE -->
  <div style="background:${C.primary};padding:14px 22px;display:flex;justify-content:space-between;align-items:center;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;opacity:0.85;">${escapeHtml(opts.partyLabel || "Document")}</div>
      <div style="font-size:20px;font-weight:800;letter-spacing:-0.3px;line-height:1.1;margin-top:2px;">${escapeHtml(docTitle)}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;letter-spacing:0.4px;">${escapeHtml(opts.documentNumber)}</div>
      <div style="font-size:11px;opacity:0.85;margin-top:2px;">${escapeHtml(opts.date)}</div>
    </div>
  </div>

  <!-- BILL TO HERO -->
  <div style="background:#fff;padding:18px 22px;border-bottom:1px solid ${C.border};">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:${C.primary};margin-bottom:6px;">${escapeHtml(opts.partyLabel ? opts.partyLabel.toUpperCase() : "Bill To")}</div>
    ${opts.partyName ? `<div style="font-size:24px;font-weight:800;color:${C.text};letter-spacing:-0.4px;line-height:1.2;">${escapeHtml(opts.partyName)}</div>` : ""}
    ${opts.partyMobile ? `<div style="font-size:20px;font-weight:700;color:${C.text};margin-top:6px;font-family:'JetBrains Mono',monospace;letter-spacing:0.4px;">📱 ${escapeHtml(opts.partyMobile)}</div>` : ""}
    ${opts.partyPhone && opts.partyPhone !== opts.partyMobile ? `<div style="font-size:13px;color:${C.textMuted};margin-top:3px;">☎ ${escapeHtml(opts.partyPhone)}</div>` : ""}
    ${infoChips.length ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">${infoChips.map(c => `<span style="display:inline-block;padding:4px 10px;background:${C.borderLight};color:${C.text};font-size:11px;font-weight:600;border-radius:12px;border:1px solid ${C.border};">${escapeHtml(c)}</span>`).join("")}</div>` : ""}
    ${opts.partyAddress ? `<div style="font-size:13px;color:${C.textMuted};margin-top:8px;line-height:1.55;">${escapeHtml(opts.partyAddress)}</div>` : ""}
  </div>

  <!-- ITEMS -->
  <div style="padding:14px 16px;">
    ${itemCards}
  </div>

  ${subRows.length ? `
    <div style="background:#fff;padding:12px 22px;border-top:1px solid ${C.border};">
      ${subRows.map(r => `
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:14px;">
          <span style="color:${C.textMuted};">${escapeHtml(r.label)}</span>
          <span style="color:${C.text};font-family:'JetBrains Mono',monospace;font-weight:600;">${escapeHtml(r.value)}</span>
        </div>`).join("")}
    </div>` : ""}

  <!-- GRAND TOTAL HERO -->
  ${grand ? `
    <div style="background:linear-gradient(135deg,${C.headerBg},${C.headerBgEnd});padding:24px 22px;text-align:center;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:3px;opacity:0.78;">${escapeHtml(grand.label || "Grand Total")}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:42px;font-weight:800;letter-spacing:0.5px;margin-top:6px;line-height:1.05;">${escapeHtml(grand.value)}</div>
      <div style="height:3px;width:60px;background:${C.primary};margin:10px auto 0;border-radius:2px;"></div>
      ${totalAmt ? `<div style="font-size:11px;font-style:italic;color:rgba(255,255,255,0.82);margin-top:10px;line-height:1.5;">${escapeHtml(numberToWords(totalAmt))}</div>` : ""}
    </div>` : ""}

  <!-- AGENT FOOTER -->
  ${opts.salesAgentName ? `
    <div style="background:#fff;padding:14px 22px;border-top:1px solid ${C.border};display:flex;justify-content:space-between;align-items:center;gap:12px;">
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${C.primary};">Sales Agent</div>
        <div style="font-size:15px;font-weight:700;color:${C.text};margin-top:2px;">${escapeHtml(opts.salesAgentName)}</div>
      </div>
      ${opts.salesAgentMobile ? `<div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:${C.text};">📱 ${escapeHtml(opts.salesAgentMobile)}</div>` : ""}
    </div>` : ""}

  ${opts.template?.show_bank_details && opts.template?.bank_details_text ? `
    <div style="background:${C.cardBg};padding:12px 22px;border-top:1px solid ${C.border};font-size:12px;color:${C.text};">
      <strong style="color:${C.primary};font-size:10px;text-transform:uppercase;letter-spacing:2px;">Payment</strong>
      <div style="margin-top:3px;">${escapeHtml(opts.template.bank_details_text)}</div>
    </div>` : ""}

  <div style="background:${C.cardBg};padding:10px 22px;text-align:center;font-size:10px;color:${C.textLight};letter-spacing:0.5px;border-top:1px solid ${C.border};">
    ${escapeHtml(companyName)} · Thank you for your business
  </div>
</div>
</body></html>`;
}

/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC API
════════════════════════════════════════════════════════════════════════════ */
export function generatePdfHtml(opts: PdfOptions): string {
  return buildA4Html(opts);
}

export function generateWhatsAppHtml(opts: PdfOptions): string {
  return buildWhatsAppHtml(opts);
}

export interface PdfViewSpec { key: string; label: string; color: string; html: string; disabled?: boolean; }

/** Build A4 + WhatsApp pills from a single options object. */
export function generateDocumentViews(opts: PdfOptions): PdfViewSpec[] {
  return [
    { key: "a4", label: "A4 Print", color: "bg-slate-900 text-white border-slate-900", html: buildA4Html(opts) },
    { key: "whatsapp", label: "WhatsApp", color: "bg-emerald-600 text-white border-emerald-600", html: buildWhatsAppHtml(opts) },
  ];
}

export function generatePdf(opts: PdfOptions) {
  const html = buildA4Html(opts);
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}
