import { supabase } from "@/integrations/supabase/client";

export interface SalesInvoiceData {
  documentNumber: string;
  companyName: string;
  customerName: string;
  customerPhone?: string;
  date: string;
  items: { product_name: string; quantity: number; rate: number }[];
  total: number;
  paymentInstructions?: string;
  bankDetails?: string;
  pdfLink?: string;
}

export interface PaymentReceiptData {
  paymentNumber: string;
  companyName: string;
  partyName: string;
  partyPhone?: string;
  date: string;
  type: "received" | "made";
  amount: number;
  paymentMethod: string;
  bankName?: string;
  chequeNumber?: string;
  reference?: string;
  outstandingBalance?: number;
}

export interface DeliveryNoteData {
  dnNumber: string;
  companyName: string;
  customerName: string;
  customerPhone?: string;
  date: string;
  items: { product_name: string; batch_number?: string; expiry_date?: string; quantity: number }[];
  pdfLink?: string;
}

export interface WarrantyInvoiceData {
  warrantyNumber: string;
  companyName: string;
  pharmacyName: string;
  customerPhone?: string;
  date: string;
  items: { product_name: string; batch_number?: string; mrp: number; tp_rate: number; quantity: number }[];
  total: number;
  pdfLink?: string;
}

export interface PurchaseOrderData {
  documentNumber: string;
  companyName: string;
  supplierName: string;
  supplierPhone?: string;
  date: string;
  items: { product_name: string; quantity: number; rate: number }[];
  total: number;
  notes?: string;
  pdfLink?: string;
}

function formatCurrency(n: number) {
  return `PKR ${Number(n).toLocaleString()}`;
}

export function buildSalesInvoiceMessage(d: SalesInvoiceData): string {
  const itemsList = d.items.map((i, idx) =>
    `${idx + 1}. ${i.product_name} × ${i.quantity} @ ${formatCurrency(i.rate)}`
  ).join("\n");

  return [
    `📋 *SALES INVOICE #${d.documentNumber}*`,
    `🏢 ${d.companyName}`,
    `━━━━━━━━━━━━━━━━━`,
    `👤 Customer: ${d.customerName}`,
    `📅 Date: ${d.date}`,
    ``,
    `📦 *Items:*`,
    itemsList,
    ``,
    `💰 *Total: ${formatCurrency(d.total)}*`,
    ...(d.bankDetails ? [``, `🏦 *Payment Details:*`, d.bankDetails] : []),
    ...(d.paymentInstructions ? [`💳 ${d.paymentInstructions}`] : []),
    ...(d.pdfLink ? [``, `📄 View Document: ${d.pdfLink}`] : []),
    ``,
    `Thank you for your business! 🙏`,
  ].join("\n");
}

export function buildPaymentReceiptMessage(d: PaymentReceiptData): string {
  const typeLabel = d.type === "received" ? "Received" : "Paid";
  const amountLabel = d.type === "received" ? "Amount Received" : "Amount Paid";

  return [
    `✅ *PAYMENT RECEIPT #${d.paymentNumber}*`,
    `🏢 ${d.companyName}`,
    `━━━━━━━━━━━━━━━━━`,
    `👤 Party: ${d.partyName}`,
    `📅 Date: ${d.date}`,
    `💳 Method: ${d.paymentMethod.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}`,
    ...(d.bankName ? [`🏦 Account: ${d.bankName}`] : []),
    ...(d.chequeNumber ? [`📝 Cheque #: ${d.chequeNumber}`] : []),
    ...(d.reference ? [`🔖 Ref: ${d.reference}`] : []),
    ``,
    `💰 *${amountLabel}: ${formatCurrency(d.amount)}*`,
    ...(d.outstandingBalance !== undefined ? [`📊 Outstanding Balance: ${formatCurrency(d.outstandingBalance)}`] : []),
    ``,
    `Thank you for your payment! 🙏`,
  ].join("\n");
}

export function buildDeliveryNoteMessage(d: DeliveryNoteData): string {
  const itemsList = d.items.map((i, idx) =>
    `${idx + 1}. ${i.product_name} | Batch: ${i.batch_number || "—"} | Exp: ${i.expiry_date || "—"} | Qty: ${i.quantity}`
  ).join("\n");

  return [
    `🚚 *DELIVERY NOTE #${d.dnNumber}*`,
    `🏢 ${d.companyName}`,
    `━━━━━━━━━━━━━━━━━`,
    `👤 Customer: ${d.customerName}`,
    `📅 Date: ${d.date}`,
    ``,
    `📦 *Items Dispatched:*`,
    itemsList,
    ...(d.pdfLink ? [``, `📄 View Document: ${d.pdfLink}`] : []),
    ``,
    `Please confirm receipt. 📋`,
  ].join("\n");
}

export function buildWarrantyInvoiceMessage(d: WarrantyInvoiceData): string {
  const itemsList = d.items.map((i, idx) =>
    `${idx + 1}. ${i.product_name} | Batch: ${i.batch_number || "—"} | MRP: ${Number(i.mrp).toLocaleString()} | TP: ${Number(i.tp_rate).toLocaleString()} | Qty: ${i.quantity}`
  ).join("\n");

  return [
    `🛡️ *WARRANTY INVOICE #${d.warrantyNumber}*`,
    `🏢 ${d.companyName}`,
    `━━━━━━━━━━━━━━━━━`,
    `🏪 Pharmacy: ${d.pharmacyName}`,
    `📅 Date: ${d.date}`,
    ``,
    `📦 *Items:*`,
    itemsList,
    ``,
    `💰 *Total: ${formatCurrency(d.total)}*`,
    ...(d.pdfLink ? [``, `📄 View Document: ${d.pdfLink}`] : []),
  ].join("\n");
}

export function buildPurchaseOrderMessage(d: PurchaseOrderData): string {
  const itemsList = d.items.map((i, idx) =>
    `${idx + 1}. ${i.product_name} × ${i.quantity} @ ${formatCurrency(i.rate)}`
  ).join("\n");

  return [
    `📋 *PURCHASE ORDER #${d.documentNumber}*`,
    `🏢 ${d.companyName}`,
    `━━━━━━━━━━━━━━━━━`,
    `🏭 Supplier: ${d.supplierName}`,
    `📅 Date: ${d.date}`,
    ``,
    `📦 *Items:*`,
    itemsList,
    ``,
    `💰 *Total: ${formatCurrency(d.total)}*`,
    ...(d.notes ? [``, `📝 ${d.notes}`] : []),
    ...(d.pdfLink ? [``, `📄 View Document: ${d.pdfLink}`] : []),
    ``,
    `Looking forward to your confirmation! 🤝`,
  ].join("\n");
}

export function openWhatsApp(phone: string | undefined, message: string) {
  const waNumber = phone ? phone.replace(/[^0-9]/g, "") : "";
  const url = waNumber
    ? `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(message)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

/**
 * Upload PDF HTML to shared-documents bucket and return public URL.
 */
export async function uploadSharedDocument(html: string, docRef: string): Promise<string | null> {
  try {
    // Scope upload path to user's tenant so RLS folder check passes
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return null;
    const { data: tu } = await (supabase as any)
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .single();
    const tenantId = tu?.tenant_id;
    if (!tenantId) return null;

    const safeRef = docRef.replace(/[^a-zA-Z0-9-]/g, "_");
    const fileName = `${tenantId}/${safeRef}_${Date.now()}.html`;
    const blob = new Blob([html], { type: "text/html" });
    const { error } = await supabase.storage
      .from("shared-documents")
      .upload(fileName, blob, { contentType: "text/html", upsert: true });
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    const { data: urlData } = supabase.storage
      .from("shared-documents")
      .getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  } catch (e) {
    console.error("Share document error:", e);
    return null;
  }
}
