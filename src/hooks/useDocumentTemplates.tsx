import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DocumentTemplate {
  id: string;
  document_type: string;
  title: string;
  columns_config: { header: string; key: string; align?: "left" | "right" | "center" }[];
  show_total_in_words: boolean;
  show_bank_details: boolean;
  bank_details_text: string;
  footer_text: string;
  signature_labels: string[];
  show_party_area: boolean;
  show_party_license: boolean;
  show_party_cnic: boolean;
  extra_meta_fields: { label: string; key: string }[];
  created_at: string;
}

const DEFAULT_TEMPLATES: Omit<DocumentTemplate, "id" | "created_at">[] = [
  {
    document_type: "sales_invoice",
    title: "Sales Invoice",
    columns_config: [
      { header: "Sr#", key: "srno", align: "center" },
      { header: "Product Name", key: "product_name", align: "left" },
      { header: "Quantity", key: "quantity", align: "center" },
      { header: "Rate", key: "rate", align: "right" },
      { header: "Amount", key: "amount", align: "right" },
      { header: "MRP Inc. Tax", key: "mrp_inc_tax", align: "right" },
    ],
    show_total_in_words: false,
    show_bank_details: true,
    bank_details_text: "Meezan Bank: 09020102207667 (Mouj Pharmaceuticals)",
    footer_text: "",
    signature_labels: ["Approved By"],
    show_party_area: true,
    show_party_license: false,
    show_party_cnic: false,
    extra_meta_fields: [],
  },
  {
    document_type: "warranty_invoice",
    title: "Warranty Note",
    columns_config: [
      { header: "Sr#", key: "srno", align: "center" },
      { header: "Product Name", key: "product_name", align: "left" },
      { header: "Product Description", key: "product_description", align: "left" },
      { header: "Quantity", key: "quantity", align: "center" },
      { header: "Rate", key: "rate", align: "right" },
      { header: "Batch No", key: "batch_number", align: "center" },
      { header: "Batch Expiry", key: "batch_expiry", align: "center" },
      { header: "Discount", key: "discount", align: "right" },
      { header: "Amount", key: "amount", align: "right" },
    ],
    show_total_in_words: true,
    show_bank_details: false,
    bank_details_text: "",
    footer_text: "I/We hereby certify that my/our Pharmacy is licensed under the Drug Act 1976 and rules made thereunder, and the items listed above shall not be sold at prices higher than the retail prices sanctioned by the Ministry of Health. The goods once sold will not be taken back or exchanged.",
    signature_labels: ["Sales Rep / Prepared By"],
    show_party_area: true,
    show_party_license: true,
    show_party_cnic: false,
    extra_meta_fields: [],
  },
  {
    document_type: "proforma",
    title: "Proforma Invoice",
    columns_config: [
      { header: "Sr#", key: "srno", align: "center" },
      { header: "Product Name", key: "product_name", align: "left" },
      { header: "Quantity", key: "quantity", align: "center" },
      { header: "Rate", key: "rate", align: "right" },
      { header: "Amount", key: "amount", align: "right" },
    ],
    show_total_in_words: false,
    show_bank_details: true,
    bank_details_text: "Meezan Bank: 09020102207667 (Mouj Pharmaceuticals)",
    footer_text: "",
    signature_labels: ["Approved By"],
    show_party_area: false,
    show_party_license: false,
    show_party_cnic: false,
    extra_meta_fields: [],
  },
  {
    document_type: "purchase_proforma",
    title: "Purchase Proforma",
    columns_config: [
      { header: "Sr#", key: "srno", align: "center" },
      { header: "Product Name", key: "product_name", align: "left" },
      { header: "Qty Requested", key: "quantity_requested", align: "center" },
      { header: "Qty Confirmed", key: "quantity_confirmed", align: "center" },
      { header: "Rate", key: "rate", align: "right" },
      { header: "Amount", key: "amount", align: "right" },
    ],
    show_total_in_words: false,
    show_bank_details: false,
    bank_details_text: "",
    footer_text: "",
    signature_labels: ["Prepared By", "Authorized Signature"],
    show_party_area: false,
    show_party_license: false,
    show_party_cnic: false,
    extra_meta_fields: [],
  },
  {
    document_type: "delivery_note",
    title: "Delivery Note",
    columns_config: [
      { header: "Sr#", key: "srno", align: "center" },
      { header: "Product Name", key: "product_name", align: "left" },
      { header: "Batch No", key: "batch_number", align: "center" },
      { header: "Expiry", key: "expiry_date", align: "center" },
      { header: "Quantity", key: "quantity", align: "center" },
    ],
    show_total_in_words: false,
    show_bank_details: false,
    bank_details_text: "",
    footer_text: "",
    signature_labels: ["Dispatched By", "Received By"],
    show_party_area: false,
    show_party_license: false,
    show_party_cnic: false,
    extra_meta_fields: [],
  },
  {
    document_type: "purchase_order",
    title: "Purchase Order",
    columns_config: [
      { header: "Sr#", key: "srno", align: "center" },
      { header: "Product Name", key: "product_name", align: "left" },
      { header: "Quantity", key: "quantity", align: "center" },
      { header: "Rate", key: "rate", align: "right" },
      { header: "Amount", key: "amount", align: "right" },
    ],
    show_total_in_words: false,
    show_bank_details: false,
    bank_details_text: "",
    footer_text: "",
    signature_labels: ["Prepared By", "Authorized Signature"],
    show_party_area: false,
    show_party_license: false,
    show_party_cnic: false,
    extra_meta_fields: [],
  },
  {
    document_type: "grn",
    title: "Goods Received Note",
    columns_config: [
      { header: "Sr#", key: "srno", align: "center" },
      { header: "Product Name", key: "product_name", align: "left" },
      { header: "Batch No", key: "batch_number", align: "center" },
      { header: "Expiry", key: "expiry_date", align: "center" },
      { header: "Qty Ordered", key: "quantity_ordered", align: "center" },
      { header: "Qty Received", key: "quantity_received", align: "center" },
      { header: "Rate", key: "rate", align: "right" },
      { header: "Amount", key: "amount", align: "right" },
    ],
    show_total_in_words: false,
    show_bank_details: false,
    bank_details_text: "",
    footer_text: "",
    signature_labels: ["Received By", "Authorized Signature"],
    show_party_area: false,
    show_party_license: false,
    show_party_cnic: false,
    extra_meta_fields: [],
  },
];

export function useDocumentTemplates() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("document_templates").select("*") as { data: any[] | null };
    
    if (!data || data.length === 0) {
      // Seed defaults
      const { data: seeded } = await supabase.from("document_templates").insert(
        DEFAULT_TEMPLATES as any[]
      ).select("*") as { data: any[] | null };
      setTemplates((seeded || []) as unknown as DocumentTemplate[]);
    } else {
      setTemplates(data as unknown as DocumentTemplate[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getTemplate = (documentType: string): DocumentTemplate | undefined => {
    return templates.find(t => t.document_type === documentType);
  };

  const updateTemplate = async (id: string, updates: Partial<DocumentTemplate>) => {
    await supabase.from("document_templates").update(updates as any).eq("id", id);
    await load();
  };

  return { templates, loading, getTemplate, updateTemplate, reload: load };
}
