import type { CompanySettings } from "@/hooks/useCompanySettings";
import type { DocumentTemplate } from "@/hooks/useDocumentTemplates";

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

export function generatePdf(opts: PdfOptions) {
  const s = opts.settings;
  const t = opts.template;
  const companyName = s?.company_name || "Company Name";

  // Use template overrides
  const docTitle = t?.title || opts.title;
  const columns = t?.columns_config?.length ? t.columns_config : opts.columns;
  const signatureLabels = t?.signature_labels?.length ? t.signature_labels : ["Prepared By", "Authorized Signature"];
  const showTotalInWords = t?.show_total_in_words ?? false;
  const showBankDetails = t?.show_bank_details ?? false;
  const bankDetailsText = t?.bank_details_text || "";
  const footerText = t?.footer_text || "";

  const logoHtml = s?.logo_url
    ? `<img src="${s.logo_url}" style="max-height:72px;max-width:180px;object-fit:contain;" />`
    : `<div style="font-family:'Georgia','Times New Roman',serif;font-size:26px;font-weight:700;color:#0f0f1e;letter-spacing:2px;line-height:1.1;">${companyName}</div>`;

  const companyDetails = [
    s?.address,
    [s?.phone, s?.email].filter(Boolean).join(" · "),
    s?.website,
    s?.ntn ? `NTN: ${s.ntn}` : null,
    s?.strn ? `STRN: ${s.strn}` : null,
  ].filter(Boolean);

  const partyLines = [
    opts.partyName ? `<div style="font-family:'Georgia',serif;font-size:14px;font-weight:700;color:#0f0f1e;letter-spacing:0.3px;">${opts.partyName}</div>` : "",
    opts.partyAddress ? `<div style="font-size:11px;color:#5a5a6e;margin-top:3px;line-height:1.4;">${opts.partyAddress}</div>` : "",
    opts.partyPhone ? `<div style="font-size:11px;color:#5a5a6e;">Tel: ${opts.partyPhone}</div>` : "",
    opts.partyNtn ? `<div style="font-size:10px;color:#8a8a9e;margin-top:2px;letter-spacing:0.3px;">${opts.partyNtn}</div>` : "",
    t?.show_party_area && opts.partyArea ? `<div style="font-size:10px;color:#8a8a9e;">Area: ${opts.partyArea}</div>` : "",
    t?.show_party_license && opts.partyLicense ? `<div style="font-size:10px;color:#8a8a9e;">License No: ${opts.partyLicense}</div>` : "",
    t?.show_party_cnic && opts.partyCnic ? `<div style="font-size:10px;color:#8a8a9e;">CNIC: ${opts.partyCnic}</div>` : "",
  ].filter(Boolean).join("");

  const metaItems = [
    { label: "Document #", value: opts.documentNumber },
    { label: "Date", value: opts.date },
    ...(opts.meta || []),
  ];

  const thAlign = (c: PdfColumn) => c.align || "left";

  const headerCells = columns.map(c =>
    `<th style="padding:10px 10px;text-align:${thAlign(c)};font-family:'Georgia',serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#e8d9b0;border-bottom:2px solid #c9a84c;">${c.header}</th>`
  ).join("");

  const bodyRows = opts.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#ffffff" : "#faf9f6";
    const cells = columns.map(c => {
      const isNum = c.align === "right";
      return `<td style="padding:9px 10px;font-size:11.5px;text-align:${thAlign(c)};border-bottom:1px solid #eae8e3;color:#2d2d3a;${isNum ? "font-family:'Courier New',monospace;font-weight:500;letter-spacing:0.5px;" : "font-weight:400;"}">${row[c.key] ?? ""}</td>`;
    }).join("");
    return `<tr style="background:${bg};">${cells}</tr>`;
  }).join("");

  const totalsHtml = opts.totals
    ? opts.totals.map((t, i) => {
        const isLast = i === opts.totals!.length - 1;
        const weight = isLast ? "700" : "400";
        const size = isLast ? "14px" : "11.5px";
        const border = isLast ? "border-top:2px solid #0f0f1e;" : "border-bottom:1px solid #eae8e3;";
        const bg = isLast ? "background:linear-gradient(135deg,#f5f3ed,#ebe8df);" : "";
        const labelColor = isLast ? "#0f0f1e" : "#6a6a7e";
        return `<div style="display:flex;justify-content:space-between;padding:7px 14px;font-size:${size};font-weight:${weight};${border}${bg}">
          <span style="color:${labelColor};font-family:'Georgia',serif;letter-spacing:0.3px;">${t.label}</span>
          <span style="color:#0f0f1e;font-family:'Courier New',monospace;letter-spacing:0.5px;">${t.value}</span>
        </div>`;
      }).join("")
    : "";

  // Total in words
  const totalAmount = opts.totals?.length ? parseFloat(opts.totals[opts.totals.length - 1].value.replace(/[^0-9.]/g, "")) : 0;
  const totalInWordsHtml = showTotalInWords && totalAmount
    ? `<div style="margin-top:14px;padding:10px 14px;background:linear-gradient(135deg,#faf9f6,#f5f3ed);border:1px solid #e8e6e1;border-radius:3px;">
        <span style="font-family:'Georgia',serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#c9a84c;">Amount in Words </span>
        <span style="font-size:11px;color:#2d2d3a;font-style:italic;font-family:'Georgia',serif;line-height:1.5;">${numberToWords(totalAmount)}</span>
      </div>`
    : "";

  // Bank details
  const bankDetailsHtml = showBankDetails && bankDetailsText
    ? `<div style="margin-top:14px;padding:10px 14px;background:linear-gradient(135deg,#f0efe8,#eae8df);border-radius:3px;border-left:3px solid #c9a84c;">
        <span style="font-family:'Georgia',serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#c9a84c;">Bank Details </span>
        <span style="font-size:11px;color:#2d2d3a;">${bankDetailsText}</span>
      </div>`
    : "";

  // Custom footer text (certification etc.)
  const footerTextHtml = footerText
    ? `<div style="margin-top:18px;padding:14px 18px;background:linear-gradient(135deg,#faf9f6,#f5f3ed);border-left:3px solid #c9a84c;border-radius:0 3px 3px 0;">
        <div style="font-family:'Georgia',serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#c9a84c;margin-bottom:6px;">Certification</div>
        <div style="font-size:10px;color:#4a4a5e;line-height:1.7;font-style:italic;">${footerText}</div>
      </div>`
    : "";

  // Signature lines from template
  const signaturesHtml = signatureLabels.map(label =>
    `<div style="text-align:center;min-width:180px;">
      <div style="border-top:1.5px solid #0f0f1e;padding-top:10px;margin-top:60px;">
        <div style="font-family:'Georgia',serif;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:#8a8a9e;">${label}</div>
      </div>
    </div>`
  ).join("");

  const html = `<!DOCTYPE html><html><head>
<title>${docTitle} — ${opts.documentNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter','Segoe UI',sans-serif; color:#2d2d3a; background:#fff; -webkit-font-smoothing:antialiased; }
  
  .page-frame {
    max-width:800px; margin:0 auto; padding:44px 48px;
    border:1.5px solid #c9c5b8;
    position:relative;
  }
  .page-frame::before {
    content:''; position:absolute; top:5px; left:5px; right:5px; bottom:5px;
    border:0.5px solid #ddd9cc; pointer-events:none;
  }
  /* Corner ornaments */
  .corner { position:absolute; width:16px; height:16px; }
  .corner::before, .corner::after { content:''; position:absolute; background:#c9a84c; }
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
    body { padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page-frame { border:none; padding:20px 25px; max-width:100%; }
    .page-frame::before { display:none; }
    .corner { display:none; }
    @page { margin:10mm 8mm; size:A4; }
  }
</style>
</head><body>
<div class="page-frame">
  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>

  <!-- LETTERHEAD -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;">
    <div>${logoHtml}</div>
    <div style="text-align:right;">
      ${!s?.logo_url ? "" : `<div style="font-family:'Georgia','Times New Roman',serif;font-size:18px;font-weight:700;color:#0f0f1e;letter-spacing:1px;">${companyName}</div>`}
      ${companyDetails.map((d, i) => `<div style="font-size:${i === 0 ? '10.5' : '9.5'}px;color:#6a6a7e;line-height:1.7;letter-spacing:0.2px;">${d}</div>`).join("")}
    </div>
  </div>
  
  <!-- Gold accent divider -->
  <div style="height:2.5px;background:linear-gradient(90deg,#b8942e,#e8d48b 30%,#c9a84c 50%,#e8d48b 70%,#b8942e);margin-bottom:22px;border-radius:2px;"></div>

  <!-- DOCUMENT TITLE -->
  <div style="text-align:center;margin-bottom:22px;">
    <div style="display:inline-block;padding:9px 36px;border:1.5px solid #0f0f1e;position:relative;">
      <div style="position:absolute;top:-1.5px;left:15%;right:15%;height:3px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);"></div>
      <div style="position:absolute;bottom:-1.5px;left:15%;right:15%;height:3px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);"></div>
      <div style="font-family:'Georgia','Times New Roman',serif;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:4px;color:#0f0f1e;">${docTitle}</div>
    </div>
  </div>

  <!-- PARTY INFO + META -->
  <div style="display:flex;gap:22px;margin-bottom:26px;">
    <div style="flex:1;">
      <table style="width:100%;">
        ${metaItems.map(m => `<tr>
          <td style="padding:4px 12px 4px 0;font-family:'Georgia',serif;font-size:9px;font-weight:600;color:#8a8a9e;text-transform:uppercase;letter-spacing:1.5px;white-space:nowrap;width:100px;">${m.label}</td>
          <td style="padding:4px 0;font-size:13px;font-weight:600;color:#0f0f1e;font-family:'Courier New',monospace;letter-spacing:0.3px;">${m.value}</td>
        </tr>`).join("")}
      </table>
    </div>
    ${partyLines ? `<div style="flex:1;border:1px solid #e8e6e1;border-left:3px solid #c9a84c;padding:14px 18px;border-radius:0 3px 3px 0;background:linear-gradient(135deg,#fefefe,#faf9f6);">
      <div style="font-family:'Georgia',serif;font-size:8px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:#c9a84c;margin-bottom:8px;">${opts.partyLabel || "Party"}</div>
      ${partyLines}
    </div>` : ""}
  </div>

  <!-- ITEMS TABLE -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
    <thead>
      <tr style="background:linear-gradient(135deg,#0f0f1e,#1a1a2e);">${headerCells}</tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <!-- TOTALS -->
  ${totalsHtml ? `<div style="margin-left:auto;max-width:300px;border:1px solid #e8e6e1;border-radius:3px;overflow:hidden;background:#fff;">${totalsHtml}</div>` : ""}

  ${totalInWordsHtml}
  ${bankDetailsHtml}

  <!-- NOTES -->
  ${opts.notes ? `<div style="margin-top:22px;padding:14px 18px;background:linear-gradient(135deg,#faf9f6,#f5f3ed);border-left:3px solid #c9a84c;border-radius:0 3px 3px 0;">
    <div style="font-family:'Georgia',serif;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#c9a84c;margin-bottom:5px;">Notes / Terms</div>
    <div style="font-size:10.5px;color:#4a4a5e;line-height:1.6;">${opts.notes}</div>
  </div>` : ""}

  ${footerTextHtml}

  <!-- SIGNATURE LINES -->
  <div style="display:flex;justify-content:space-between;margin-top:40px;padding:0 10px;">
    ${signaturesHtml}
  </div>

  <!-- FOOTER -->
  <div style="margin-top:34px;text-align:center;">
    <div style="height:1px;background:linear-gradient(90deg,transparent 5%,#c9a84c 35%,#e8d48b 50%,#c9a84c 65%,transparent 95%);margin-bottom:10px;"></div>
    <div style="font-family:'Georgia',serif;font-size:8px;color:#aaa;letter-spacing:1px;text-transform:uppercase;">This is a computer-generated document · ${companyName} · All rights reserved</div>
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
