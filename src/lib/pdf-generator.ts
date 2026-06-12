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
    ? `<img src="${s.logo_url}" alt="${escapeHtml(companyName)}" style="max-height:140px;max-width:300px;object-fit:contain;display:block;" />`
    : `<div style="font-size:30px;font-weight:800;color:${C.text};letter-spacing:-0.5px;">${escapeHtml(companyName)}</div>`;

  const addressLine = [s?.address, (s as any)?.city].filter(Boolean).join(", ");
  const phoneLine = [s?.phone ? `Tel: ${s.phone}` : null, (s as any)?.whatsapp_number ? `Mob: ${(s as any).whatsapp_number}` : null].filter(Boolean).join("  ·  ");
  const webLine = [s?.email, s?.website].filter(Boolean).join("  ·  ");
  const idLine = [s?.ntn ? `NTN: ${s.ntn}` : null, s?.strn ? `STRN: ${s.strn}` : null].filter(Boolean).join("  ·  ");

  const companyBlock = `
    <div style="text-align:right;">
      ${s?.logo_url ? `<div style="font-size:24px;font-weight:700;color:${C.text};letter-spacing:-0.2px;line-height:1.2;">${escapeHtml(companyName)}</div>` : ""}
      ${tagline ? `<div style="font-size:14px;font-style:italic;color:${C.textMuted};margin-top:3px;">${escapeHtml(tagline)}</div>` : ""}
      ${[addressLine, phoneLine, webLine, idLine].filter(Boolean).map(l => `<div style="font-size:14px;color:${C.textMuted};line-height:1.65;margin-top:2px;">${escapeHtml(l)}</div>`).join("")}
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

  // Gate party phone/mobile by Document Preferences (default OFF, supplier phone hard-off)
  const isSupplierParty = /supplier|printer|pharmacy|vendor/i.test(opts.partyLabel || "");
  const isCustomerParty = !isSupplierParty;
  const showMobile = isCustomerParty
    ? (s as any)?.show_customer_mobile_on_docs === true
    : (s as any)?.show_supplier_mobile_on_docs === true;
  const showPhone = isCustomerParty
    ? (s as any)?.show_customer_phone_on_docs === true
    : (s as any)?.show_supplier_phone_on_docs === true;
  const phoneBits: string[] = [];
  if (showMobile && opts.partyMobile) phoneBits.push(`📱 ${escapeHtml(opts.partyMobile)}`);
  if (showPhone && opts.partyPhone && opts.partyPhone !== opts.partyMobile) phoneBits.push(`☎ ${escapeHtml(opts.partyPhone)}`);
  const cityArea = [opts.partyCity, opts.partyArea].filter(Boolean).join(" · ");

  const partyHtml = `
    <div style="border:1px solid ${C.border};border-radius:4px;overflow:hidden;background:#fff;">
      <div style="background:${C.cardBg};padding:8px 16px;border-bottom:1px solid ${C.border};font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.8px;color:${C.primary};-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escapeHtml(opts.partyLabel || "Bill To")}</div>
      <div style="padding:14px 16px;">
        ${opts.partyName ? `<div style="font-size:19px;font-weight:700;color:${C.text};line-height:1.25;">${escapeHtml(opts.partyName)}</div>` : ""}
        ${opts.partyCode ? `<div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:${C.textMuted};margin-top:3px;letter-spacing:0.4px;">${escapeHtml(opts.partyCode)}</div>` : ""}
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
  const thAlign = (c: PdfColumn) => c.align || "left";
  const colWidth = (c: PdfColumn) => {
    const k = c.key.toLowerCase();
    if (SERIAL_KEYS.has(c.key)) return "width:36px;";
    if (k === "product_code" || k === "code" || k === "sku") return "width:90px;";
    if (k === "batch_number" || k === "batch") return "width:88px;";
    if (k === "expiry_date" || k === "expiry") return "width:78px;";
    if (k === "quantity" || k === "qty") return "width:64px;";
    if (k === "rate" || k === "tp_rate" || k === "price") return "width:84px;";
    if (k === "mrp" || k === "mrp_inc_tax") return "width:80px;";
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
    <div style="display:flex;margin-top:18px;">
      <div style="flex:1;"></div>
      <div style="width:340px;max-width:55%;border:1px solid ${C.border};border-radius:3px;overflow:hidden;background:#fff;">
        ${subRows.map(r => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;font-size:14px;border-bottom:1px solid ${C.borderLight};">
            <span style="color:${C.textMuted};">${escapeHtml(r.label)}</span>
            <span style="color:${C.text};font-family:'JetBrains Mono',monospace;font-weight:600;font-size:15px;">${escapeHtml(r.value)}</span>
          </div>`).join("")}
        ${grandTotal ? `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:${C.text};color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
            <span style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;">${escapeHtml(grandTotal.label || "Grand Total")}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:800;letter-spacing:0.4px;">${escapeHtml(grandTotal.value)}</span>
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
    <div style="margin-top:42px;display:flex;justify-content:space-between;gap:30px;">
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
  .page-frame { max-width:820px; margin:64px auto 36px; padding:28px 32px; background:#fff; border:1px solid ${C.border}; box-shadow:0 8px 30px rgba(0,0,0,0.08); }
  .doc-header { display:flex; align-items:center; justify-content:space-between; gap:24px; }
  @media print {
    body { background:#fff; }
    *, *::before, *::after { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    .toolbar { display:none !important; }
    .page-frame { border:none; box-shadow:none; max-width:100%; margin:0; padding:0; }
    table { page-break-inside:auto; }
    thead { display:table-header-group; }
    tr { page-break-inside:avoid; }
    @page { margin:12mm 12mm; size:A4; }
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
   PUBLIC API
════════════════════════════════════════════════════════════════════════════ */
export function generatePdfHtml(opts: PdfOptions): string {
  return buildA4Html(opts);
}

/** Kept for backward compatibility — returns same polished A4 HTML. */
export function generateWhatsAppHtml(opts: PdfOptions): string {
  return buildA4Html(opts);
}

export interface PdfViewSpec { key: string; label: string; color: string; html: string; disabled?: boolean; }

/** Single polished A4 view. Single-item array → PdfPreviewDialog hides the switcher. */
export function generateDocumentViews(opts: PdfOptions): PdfViewSpec[] {
  return [
    { key: "a4", label: "A4 Print", color: "bg-slate-900 text-white border-slate-900", html: buildA4Html(opts) },
  ];
}

export function generatePdf(opts: PdfOptions) {
  const html = buildA4Html(opts);
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}
