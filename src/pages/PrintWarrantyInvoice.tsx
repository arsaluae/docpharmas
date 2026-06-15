// ============================================================================
// PrintWarrantyInvoice — bare A4 page used for Preview / Print / Download PDF.
// Route: /print-preview/warranty-invoice/:id  (?action=print|pdf for auto)
// Renders no AppLayout — pure printable canvas, sole source for all output.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Printer, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { WarrantyInvoiceTemplate, type WarrantyTemplateData } from "@/components/warranty/WarrantyInvoiceTemplate";
import { DEFAULT_WARRANTY_NOTES_HTML } from "@/lib/warranty-variables";

const fmtDate = (iso?: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export default function PrintWarrantyInvoice() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const [data, setData] = useState<WarrantyTemplateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { settings } = useCompanySettings();
  const action = params.get("action"); // "print" | "pdf" | null

  useEffect(() => {
    if (!id || !settings) return;
    void loadInvoice(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, settings?.id]);

  const loadInvoice = async (invoiceId: string) => {
    setLoading(true); setError(null);
    try {
      const { data: inv, error: invErr } = await supabase
        .from("warranty_invoices")
        .select("*, customers(name, business_name, customer_code, mobile, phone, city, area, address, warranty_address, license_number, license_expiry, ntn, cnic)")
        .eq("id", invoiceId).maybeSingle();
      if (invErr) throw invErr;
      if (!inv) { setError("Warranty invoice not found"); setLoading(false); return; }

      // Distributor (override customer when set)
      let dist: any = null;
      if ((inv as any).distributor_id) {
        const { data } = await supabase.from("customer_distributors").select("*").eq("id", (inv as any).distributor_id).maybeSingle();
        dist = data;
      }
      const cust: any = (inv as any).customers || {};

      const s: any = settings;
      const items = Array.isArray((inv as any).items) ? (inv as any).items : [];

      const tplData: WarrantyTemplateData = {
        invoice_number: (inv as any).warranty_number,
        date: fmtDate((inv as any).date),
        due_date: (inv as any).due_date ? fmtDate((inv as any).due_date) : null,
        created_by: (inv as any).created_by_name || null,
        sales_rep_name: (inv as any).sales_rep_name || null,
        distributor: {
          name: dist?.name || (inv as any).pharmacy_name || cust?.business_name || cust?.name || "—",
          mobile: (inv as any).customer_mobile || cust?.mobile || dist?.phone || null,
          phone: cust?.phone || dist?.phone || null,
          address: (inv as any).customer_warranty_address || cust?.warranty_address || dist?.address || cust?.address || (inv as any).pharmacy_address || null,
          city: cust?.city || null,
          area: cust?.area || null,
          license_number: (inv as any).customer_license_number || dist?.license_number || cust?.license_number || (inv as any).pharmacy_license_no || null,
          license_expiry: (inv as any).customer_license_expiry ? fmtDate((inv as any).customer_license_expiry) : (cust?.license_expiry ? fmtDate(cust.license_expiry) : (dist?.license_expiry ? fmtDate(dist.license_expiry) : null)),
          ntn: (inv as any).customer_ntn || cust?.ntn || null,
          cnic: (inv as any).customer_cnic || cust?.cnic || null,
        },
        items: items.map((i: any) => ({
          product_name: i.product_name || "",
          description: i.product_description || null,
          quantity: Number(i.quantity || 0),
          rate: Number(i.tp_rate ?? i.rate ?? 0),
          batch_number: i.batch_number || null,
          batch_expiry: i.expiry_date ? fmtDate(i.expiry_date) : null,
          discount: Number(i.discount || 0),
          amount: Number(i.amount || 0),
          mrp_inc_tax: Number(i.mrp || 0),
        })),
        subtotal: Number((inv as any).subtotal || 0),
        discount_amount: Number((inv as any).discount_amount || 0),
        total: Number((inv as any).total || 0),
        total_in_words: (inv as any).total_in_words || null,

        notes_html: (inv as any).notes_html || s?.warranty_notes_template_html || DEFAULT_WARRANTY_NOTES_HTML,

        show_logo: s?.warranty_show_logo !== false,
        show_company_details: s?.warranty_show_company_details !== false,
        show_signature: (inv as any).show_signature !== false && s?.warranty_show_rep_signature !== false,
        show_stamp: (inv as any).show_stamp !== false && s?.warranty_show_company_stamp !== false,
        show_page_number: s?.warranty_show_page_number !== false,
        show_system_note: s?.warranty_show_system_note !== false,
        doc_title: s?.warranty_doc_title || "WARRANTY INVOICE",
        footer_text: s?.warranty_footer_text || null,
        signature_url: (inv as any).signature_url_override || s?.warranty_signature_url || null,
        stamp_url: (inv as any).stamp_url_override || s?.warranty_stamp_url || null,
        company: {
          name: s?.company_name,
          address: s?.address,
          phone: s?.phone,
          email: s?.email,
          website: s?.website,
          logo_url: s?.logo_url,
          ntn: s?.ntn,
          strn: s?.strn,
        },
      };
      setData(tplData);
    } catch (e: any) {
      setError(e?.message || "Failed to load warranty invoice");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const handlePdf = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const node = document.getElementById("warranty-sheet");
      if (!node) return;
      const filename = `Warranty-${data?.invoice_number || "invoice"}.pdf`;
      await (html2pdf() as any)
        .set({
          filename,
          margin: 0,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 794 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
          pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".no-break"] },
        })
        .from(node).save();
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setBusy(false);
    }
  };

  // Auto-trigger when requested
  useEffect(() => {
    if (!data || !action) return;
    const t = setTimeout(() => {
      if (action === "print") handlePrint();
      else if (action === "pdf") void handlePdf();
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, action]);

  const Toolbar = useMemo(() => (
    <div className="no-print sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-border bg-background/95 backdrop-blur px-4 py-2">
      <Link to="/warranty-invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Warranty Invoices
      </Link>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={!data}>
          <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
        </Button>
        <Button size="sm" onClick={handlePdf} disabled={!data || busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
          Download PDF
        </Button>
      </div>
    </div>
  ), [data, busy]);

  return (
    <div className="min-h-screen bg-muted/40">
      <style>{`@media print { .no-print { display:none !important; } body { background:#fff !important; } }`}</style>
      {Toolbar}
      <div className="flex justify-center py-6 print:py-0">
        {loading || !settings ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading invoice…</div>
        ) : error ? (
          <div className="text-destructive">{error}</div>
        ) : data ? (
          <div id="warranty-sheet" className="bg-white shadow-lg print:shadow-none">
            <WarrantyInvoiceTemplate data={data} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
