// ============================================================================
// WarrantyInvoiceTemplate
// Single source of truth for the printable warranty invoice. Used by:
//   - /print-preview/warranty-invoice/:id  (preview / print / PDF page)
// Render is plain semantic HTML with print-friendly inline classes; the print
// page wraps it in an A4 sheet and triggers print/PDF on demand.
// ============================================================================

import { useMemo } from "react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { replaceWarrantyTokens, type WarrantyVarContext } from "@/lib/warranty-variables";

export interface WarrantyTemplateData {
  // Document
  invoice_number: string;
  date: string;             // already formatted DD/MM/YYYY
  due_date?: string | null;
  created_by?: string | null;
  sales_rep_name?: string | null;

  // Customer / distributor block
  distributor: {
    name: string;
    mobile?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    area?: string | null;
    license_number?: string | null;
    license_expiry?: string | null;
    ntn?: string | null;
    cnic?: string | null;
  };

  // Products
  items: Array<{
    product_name: string;
    description?: string | null;
    quantity: number;
    rate: number;
    batch_number?: string | null;
    batch_expiry?: string | null;
    discount?: number;
    amount: number;
    mrp_inc_tax?: number;
  }>;

  subtotal: number;
  discount_amount?: number;
  total: number;
  total_in_words?: string | null;

  // Notes (rich HTML, already token-replaced or raw)
  notes_html: string;

  // Header/footer config
  show_logo: boolean;
  show_company_details: boolean;
  show_signature: boolean;
  show_stamp: boolean;
  show_page_number: boolean;
  show_system_note: boolean;
  doc_title: string;
  footer_text?: string | null;
  signature_url?: string | null;
  stamp_url?: string | null;

  // Company
  company: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    logo_url?: string | null;
    ntn?: string | null;
    strn?: string | null;
  };
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0);

export function WarrantyInvoiceTemplate({ data }: { data: WarrantyTemplateData }) {
  const ctx: WarrantyVarContext = {
    company_name: data.company.name,
    distributor_name: data.distributor.name,
    distributor_mobile: data.distributor.mobile || data.distributor.phone,
    distributor_address: data.distributor.address,
    license_number: data.distributor.license_number,
    license_expiry: data.distributor.license_expiry,
    ntn: data.distributor.ntn,
    cnic: data.distributor.cnic,
    warranty_invoice_number: data.invoice_number,
    date: data.date,
    due_date: data.due_date,
    created_by: data.created_by,
    sales_rep_name: data.sales_rep_name,
  };

  const renderedNotes = useMemo(
    () => replaceWarrantyTokens(sanitizeHtml(data.notes_html || ""), ctx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.notes_html, JSON.stringify(ctx)]
  );

  return (
    <div className="wi-sheet">
      <style>{TEMPLATE_CSS}</style>

      {/* Header */}
      <header className="wi-header">
        {data.show_logo && data.company.logo_url ? (
          <img src={data.company.logo_url} alt="logo" className="wi-logo" />
        ) : <div className="wi-logo-spacer" />}
        {data.show_company_details && (
          <div className="wi-company">
            <h1 className="wi-company-name">{data.company.name || "—"}</h1>
            {data.company.address && <div className="wi-company-line">{data.company.address}</div>}
            <div className="wi-company-line">
              {data.company.phone && <span>Tel: {data.company.phone}</span>}
              {data.company.email && <span> · {data.company.email}</span>}
              {data.company.website && <span> · {data.company.website}</span>}
            </div>
            {(data.company.ntn || data.company.strn) && (
              <div className="wi-company-line">
                {data.company.ntn && <span>NTN: {data.company.ntn}</span>}
                {data.company.strn && <span>  STRN: {data.company.strn}</span>}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Title */}
      <div className="wi-title-bar">
        <h2 className="wi-title">{data.doc_title || "WARRANTY INVOICE"}</h2>
        <div className="wi-meta">
          <div><span>Invoice #</span><strong>{data.invoice_number}</strong></div>
          <div><span>Date</span><strong>{data.date}</strong></div>
          {data.due_date && <div><span>Due</span><strong>{data.due_date}</strong></div>}
        </div>
      </div>

      {/* Parties */}
      <section className="wi-parties">
        <div className="wi-party">
          <div className="wi-party-label">Distributor / Customer</div>
          <div className="wi-party-name">{data.distributor.name}</div>
          {data.distributor.address && <div className="wi-party-line">{data.distributor.address}</div>}
          {(data.distributor.city || data.distributor.area) && (
            <div className="wi-party-line">
              {[data.distributor.area, data.distributor.city].filter(Boolean).join(", ")}
            </div>
          )}
          <div className="wi-party-grid">
            {(data.distributor.mobile || data.distributor.phone) && (
              <div><span>Mobile:</span> {data.distributor.mobile || data.distributor.phone}</div>
            )}
            {data.distributor.license_number && (
              <div><span>License:</span> {data.distributor.license_number}</div>
            )}
            {data.distributor.license_expiry && (
              <div><span>Valid until:</span> {data.distributor.license_expiry}</div>
            )}
            {data.distributor.ntn && <div><span>NTN:</span> {data.distributor.ntn}</div>}
            {data.distributor.cnic && <div><span>CNIC:</span> {data.distributor.cnic}</div>}
          </div>
        </div>
        <div className="wi-party">
          <div className="wi-party-label">Document</div>
          <div className="wi-party-grid">
            {data.created_by && <div><span>Created by:</span> {data.created_by}</div>}
            {data.sales_rep_name && <div><span>Sales Rep:</span> {data.sales_rep_name}</div>}
          </div>
        </div>
      </section>

      {/* Items */}
      <table className="wi-items">
        <thead>
          <tr>
            <th className="w-8 ta-center">Sr</th>
            <th>Product</th>
            <th className="w-24 ta-center">Batch</th>
            <th className="w-20 ta-center">Expiry</th>
            <th className="w-12 ta-center">Qty</th>
            <th className="w-20 ta-right">Rate</th>
            <th className="w-16 ta-right">Disc.</th>
            <th className="w-24 ta-right">Amount</th>
            <th className="w-20 ta-right">MRP Inc Tax</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr key={i} className="no-break">
              <td className="ta-center">{i + 1}</td>
              <td>
                <div className="wi-prod-name">{item.product_name}</div>
                {item.description && <div className="wi-prod-desc">{item.description}</div>}
              </td>
              <td className="ta-center mono">{item.batch_number || "—"}</td>
              <td className="ta-center mono">{item.batch_expiry || "—"}</td>
              <td className="ta-center mono">{item.quantity}</td>
              <td className="ta-right mono">{fmtMoney(item.rate)}</td>
              <td className="ta-right mono">{item.discount ? fmtMoney(item.discount) : "—"}</td>
              <td className="ta-right mono">{fmtMoney(item.amount)}</td>
              <td className="ta-right mono">{item.mrp_inc_tax ? fmtMoney(item.mrp_inc_tax) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <section className="wi-totals no-break">
        <div className="wi-words">
          {data.total_in_words && (
            <>
              <span className="wi-words-label">Amount in words:</span>
              <span className="wi-words-value">{data.total_in_words}</span>
            </>
          )}
        </div>
        <table className="wi-totals-table">
          <tbody>
            <tr><td>Subtotal</td><td className="mono ta-right">{fmtMoney(data.subtotal)}</td></tr>
            {data.discount_amount ? (
              <tr><td>Discount</td><td className="mono ta-right">-{fmtMoney(data.discount_amount)}</td></tr>
            ) : null}
            <tr className="wi-grand"><td>Total</td><td className="mono ta-right">PKR {fmtMoney(data.total)}</td></tr>
          </tbody>
        </table>
      </section>

      {/* Notes (rich text) */}
      {renderedNotes && (
        <section className="wi-notes no-break">
          <div className="wi-notes-label">Notes / Declaration</div>
          <div className="wi-notes-body" dangerouslySetInnerHTML={{ __html: renderedNotes }} />
        </section>
      )}

      {/* Signature / stamp */}
      <section className="wi-signatures no-break">
        <div className="wi-sig-cell">
          {data.show_stamp && data.stamp_url ? (
            <img src={data.stamp_url} alt="company stamp" className="wi-sig-img" />
          ) : <div className="wi-sig-blank" />}
          <div className="wi-sig-label">Company Stamp</div>
        </div>
        <div className="wi-sig-cell">
          {data.show_signature && data.signature_url ? (
            <img src={data.signature_url} alt="authorized signature" className="wi-sig-img" />
          ) : <div className="wi-sig-blank" />}
          <div className="wi-sig-label">Authorized Signature{data.sales_rep_name ? ` — ${data.sales_rep_name}` : ""}</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="wi-footer">
        {data.footer_text && <div className="wi-footer-text">{data.footer_text}</div>}
        {data.show_system_note && (
          <div className="wi-footer-sys">This is a system generated document — Warranty Invoice {data.invoice_number}.</div>
        )}
      </footer>
    </div>
  );
}

// ── Print-friendly CSS (all scoped under .wi-sheet) ─────────────────────────
const TEMPLATE_CSS = `
.wi-sheet { font-family: 'Inter', system-ui, -apple-system, sans-serif; color:#0f172a; background:#fff; padding:18mm 16mm 16mm; width:210mm; min-height:297mm; box-sizing:border-box; font-size:10pt; line-height:1.45; }
.wi-sheet * { box-sizing:border-box; }
.wi-header { display:flex; gap:18px; align-items:flex-start; justify-content:space-between; border-bottom:1.5px solid #0f172a; padding-bottom:10px; }
.wi-logo { max-height:64px; max-width:200px; object-fit:contain; }
.wi-logo-spacer { width:200px; height:1px; }
.wi-company { text-align:right; }
.wi-company-name { font-size:18pt; font-weight:800; letter-spacing:-0.01em; margin:0 0 4px; }
.wi-company-line { font-size:9pt; color:#475569; }
.wi-title-bar { display:flex; justify-content:space-between; align-items:flex-end; margin:14px 0 10px; gap:16px; }
.wi-title { font-size:20pt; font-weight:800; letter-spacing:0.08em; margin:0; color:#0f172a; }
.wi-meta { font-size:9.5pt; display:flex; flex-direction:column; gap:2px; min-width:180px; }
.wi-meta div { display:flex; justify-content:space-between; gap:12px; border-bottom:1px dotted #cbd5e1; padding:2px 0; }
.wi-meta span { color:#64748b; }
.wi-meta strong { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.wi-parties { display:grid; grid-template-columns:1.5fr 1fr; gap:14px; margin-bottom:10px; }
.wi-party { border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; }
.wi-party-label { font-size:8pt; text-transform:uppercase; letter-spacing:0.14em; color:#64748b; font-weight:700; margin-bottom:4px; }
.wi-party-name { font-size:12pt; font-weight:700; margin-bottom:2px; }
.wi-party-line { font-size:9.5pt; color:#334155; }
.wi-party-grid { display:grid; grid-template-columns:1fr 1fr; gap:2px 12px; font-size:9pt; margin-top:6px; }
.wi-party-grid > div { color:#0f172a; }
.wi-party-grid span { color:#64748b; }
.wi-items { width:100%; border-collapse:collapse; margin-top:6px; font-size:9.5pt; page-break-inside:auto; }
.wi-items thead { display:table-header-group; background:#0f172a; color:#fff; }
.wi-items th, .wi-items td { padding:6px 8px; border-bottom:1px solid #e2e8f0; vertical-align:top; }
.wi-items th { font-size:8.5pt; text-transform:uppercase; letter-spacing:0.05em; text-align:left; font-weight:600; }
.wi-items tr.no-break { page-break-inside:avoid; break-inside:avoid; }
.wi-prod-name { font-weight:600; }
.wi-prod-desc { font-size:8.5pt; color:#64748b; margin-top:2px; }
.ta-right { text-align:right; } .ta-center { text-align:center; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.wi-totals { display:flex; justify-content:space-between; gap:16px; align-items:flex-end; margin-top:10px; }
.wi-words { font-size:9pt; max-width:60%; }
.wi-words-label { color:#64748b; margin-right:6px; }
.wi-words-value { font-weight:600; font-style:italic; }
.wi-totals-table { border-collapse:collapse; min-width:240px; font-size:10pt; }
.wi-totals-table td { padding:4px 10px; border-bottom:1px dotted #cbd5e1; }
.wi-totals-table tr.wi-grand td { font-size:12pt; font-weight:800; border-bottom:none; border-top:1.5px solid #0f172a; padding-top:6px; }
.wi-notes { margin-top:14px; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; background:#f8fafc; }
.wi-notes-label { font-size:8pt; text-transform:uppercase; letter-spacing:0.14em; color:#64748b; font-weight:700; margin-bottom:4px; }
.wi-notes-body { font-size:9.5pt; line-height:1.55; }
.wi-notes-body p { margin:4px 0; }
.wi-notes-body strong, .wi-notes-body b { font-weight:700; }
.wi-notes-body u { text-decoration:underline; }
.wi-notes-body em, .wi-notes-body i { font-style:italic; }
.wi-notes-body ul, .wi-notes-body ol { padding-left:20px; margin:4px 0; }
.wi-notes-body li { margin:2px 0; }
.wi-signatures { display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-top:30px; padding-top:14px; }
.wi-sig-cell { display:flex; flex-direction:column; align-items:center; }
.wi-sig-img { max-height:64px; max-width:160px; object-fit:contain; margin-bottom:4px; }
.wi-sig-blank { height:48px; }
.wi-sig-label { border-top:1px solid #0f172a; padding-top:4px; font-size:9pt; color:#475569; min-width:180px; text-align:center; }
.wi-footer { margin-top:20px; border-top:1px solid #e2e8f0; padding-top:8px; text-align:center; }
.wi-footer-text { font-size:9pt; color:#334155; }
.wi-footer-sys { font-size:8pt; color:#94a3b8; font-style:italic; margin-top:2px; }
@page { size: A4 portrait; margin: 0; }
@media print {
  body, html { background:#fff !important; margin:0 !important; padding:0 !important; }
  .wi-sheet { box-shadow:none !important; margin:0 !important; }
}
`;
