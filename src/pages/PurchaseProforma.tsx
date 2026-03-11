import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, FileText, Trash2, Download, CheckCircle, Pencil, PackageCheck, MessageCircle, DollarSign, Eye, Loader2, FileEdit, ShoppingCart, BadgeCheck, PackageOpen, RotateCcw, Truck, Send, MoreHorizontal, BadgeDollarSign, ChevronLeft, ChevronRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdfHtml } from "@/lib/pdf-generator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Supplier { id: string; name: string; wht_rate: number; company?: string | null; phone?: string | null; address?: string | null; }
interface Product { id: string; name: string; cost_price: number; }
interface PPItem { product_id: string; product_name: string; quantity_requested: number; rate: number; amount: number; }
interface AdditionalCost { cost_type: string; description: string; amount: number; vendor_id: string; }

interface PurchaseOrder {
  id: string; proforma_number: string; supplier_id: string | null; date: string;
  validity_days: number; subtotal: number; gst: number; total: number;
  status: string; notes: string | null; created_at: string;
  converted_po_id: string | null;
  po_number?: string; grn_number?: string; bill_number?: string;
  suppliers: { name: string; company?: string | null; phone?: string | null; address?: string | null } | null;
}

export default function PurchaseProforma() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Create
  const [supplierId, setSupplierId] = useState("");
  const [ppDate, setPpDate] = useState(new Date().toISOString().split("T")[0]);
  const [validityDays, setValidityDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PPItem[]>([]);
  const [costs, setCosts] = useState<AdditionalCost[]>([]);
  const [costType, setCostType] = useState("printing");
  const [costDesc, setCostDesc] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [costVendorId, setCostVendorId] = useState("");
  const [allocatedProductIds, setAllocatedProductIds] = useState<string[] | null>(null);

  // Preview items (for PDF generation)
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [previewCosts, setPreviewCosts] = useState<any[]>([]);
  const [pdfHtml, setPdfHtml] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  // Edit Dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<PurchaseOrder | null>(null);
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editValidity, setEditValidity] = useState("30");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<PPItem[]>([]);

  // Receive
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null);
  const [receiveItems, setReceiveItems] = useState<any[]>([]);
  const [receivedBy, setReceivedBy] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [receiving, setReceiving] = useState(false);

  // Delete
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  // Void
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [voidOrder, setVoidOrder] = useState<PurchaseOrder | null>(null);
  const [voiding, setVoiding] = useState(false);

  // Costs dialog
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [costDialogId, setCostDialogId] = useState("");

  // Post-confirm document choice
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [postConfirmOrder, setPostConfirmOrder] = useState<PurchaseOrder | null>(null);
  const [postConfirmPoId, setPostConfirmPoId] = useState<string | null>(null);

  // Make Payment
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<PurchaseOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentBankId, setPaymentBankId] = useState("");
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string; bank_name: string }[]>([]);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/dashboard");
    };
    check(); load(); loadBankAccounts();
  }, [navigate]);

  // Keyboard shortcut: Ctrl+N for new order
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const loadBankAccounts = async () => {
    const { data } = await supabase.from("bank_accounts").select("id, name, bank_name").order("is_default", { ascending: false });
    if (data) {
      setBankAccounts(data);
      const meezan = data.find(b => b.bank_name.toLowerCase().includes("meezan"));
      setPaymentBankId(meezan?.id || data[0]?.id || "");
    }
  };

  // ── SIMPLIFIED LOAD: proformas as single source of truth ──
  const load = async () => {
    setLoading(true);
    const [pp, po, grn, bills, sup, prod] = await Promise.all([
      supabase.from("purchase_proformas").select("*, suppliers(name, company, phone, address)").order("created_at", { ascending: false }),
      supabase.from("purchase_orders").select("id, po_number, status, proforma_id").order("created_at", { ascending: false }),
      supabase.from("goods_received_notes").select("id, grn_number, po_id").order("created_at", { ascending: false }),
      supabase.from("purchase_invoices").select("id, bill_number, grn_id, status").order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name, wht_rate, company, phone, address"),
      supabase.from("products").select("id, name, cost_price"),
    ]);

    const allOrders: PurchaseOrder[] = [];
    if (pp.data) {
      pp.data.forEach((p: any) => {
        let status = p.status;
        let poNum: string | undefined;
        let grnNum: string | undefined;
        let billNum: string | undefined;

        if (p.converted_po_id && po.data) {
          const linkedPO = po.data.find((o: any) => o.id === p.converted_po_id);
          if (linkedPO) {
            poNum = linkedPO.po_number;
            status = "ordered";
            if (linkedPO.status === "confirmed") status = "confirmed";
            if (linkedPO.status === "received") {
              status = "received";
              const linkedGRN = grn.data?.find((g: any) => g.po_id === linkedPO.id);
              if (linkedGRN) {
                grnNum = linkedGRN.grn_number;
                const linkedBill = bills.data?.find((b: any) => b.grn_id === linkedGRN.id);
                if (linkedBill) {
                  billNum = linkedBill.bill_number;
                  if (linkedBill.status === "paid") status = "paid";
                }
              }
            }
          }
        }

        allOrders.push({
          id: p.id, proforma_number: p.proforma_number, supplier_id: p.supplier_id, date: p.date,
          validity_days: p.validity_days, subtotal: p.subtotal, gst: p.gst, total: p.total,
          status, notes: p.notes, created_at: p.created_at,
          converted_po_id: p.converted_po_id, po_number: poNum, grn_number: grnNum,
          bill_number: billNum, suppliers: p.suppliers as any,
        });
      });
    }
    setOrders(allOrders);
    if (sup.data) setSuppliers(sup.data as any);
    if (prod.data) setProducts(prod.data);
    setLoading(false);
  };

  // Load allocated products when supplier changes
  useEffect(() => {
    if (!supplierId) { setAllocatedProductIds(null); return; }
    (async () => {
      const { data } = await supabase.from("supplier_products").select("product_id").eq("supplier_id", supplierId);
      if (data && data.length > 0) setAllocatedProductIds(data.map(d => d.product_id));
      else setAllocatedProductIds(null);
    })();
  }, [supplierId]);

  // ── ITEMS ──
  const addItem = () => setItems([...items, { product_id: "", product_name: "", quantity_requested: 1, rate: 0, amount: 0 }]);
  useEffect(() => { if (createOpen && items.length === 0) addItem(); }, [createOpen]);

  const lookupLastSupplierPrice = async (productId: string, supId: string): Promise<number | null> => {
    if (!productId || !supId) return null;
    const { data } = await supabase.from("purchase_proforma_items")
      .select("rate, proforma_id, purchase_proformas!inner(supplier_id)")
      .eq("product_id", productId)
      .eq("purchase_proformas.supplier_id", supId)
      .order("proforma_id", { ascending: false })
      .limit(1);
    if (data && data.length > 0) return Number(data[0].rate);
    return null;
  };

  const updateItem = async (idx: number, field: string, value: any) => {
    const u = [...items];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.cost_price); }
      if (supplierId && value) {
        const lastRate = await lookupLastSupplierPrice(value, supplierId);
        (u[idx] as any).last_price = lastRate;
        if (lastRate !== null) u[idx].rate = lastRate;
      }
    }
    u[idx].amount = Number(u[idx].quantity_requested) * Number(u[idx].rate);
    setItems([...u]);
  };

  const calcTotals = (list: PPItem[]) => {
    const subtotal = list.reduce((s, i) => s + i.amount, 0);
    const gst = settings?.gst_enabled ? subtotal * (Number(settings.default_gst_rate) / 100) : 0;
    return { subtotal, gst, total: subtotal + gst };
  };

  // ── CREATE ──
  const handleSave = async () => {
    if (!supplierId || items.length === 0) { toast.error("Supplier and items required"); return; }
    setSaving(true);
    try {
      // Duplicate detection: check if same supplier has order in last 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const { data: recentOrders } = await supabase.from("purchase_proformas")
        .select("proforma_number, created_at")
        .eq("supplier_id", supplierId)
        .gte("created_at", oneDayAgo.toISOString())
        .limit(1);
      if (recentOrders && recentOrders.length > 0) {
        const sup = suppliers.find(s => s.id === supplierId);
        toast.warning(`⚠️ Duplicate alert: ${sup?.name || "Supplier"} already has order ${recentOrders[0].proforma_number} in the last 24 hours`, { duration: 6000 });
      }

      const { subtotal, gst, total } = calcTotals(items);
      const { data: ppNumber, error: rpcErr } = await supabase.rpc("generate_document_number", { p_document_type: "purchase_proforma" });
      if (rpcErr) { console.error("RPC error:", rpcErr); toast.error("Failed to generate number: " + rpcErr.message); setSaving(false); return; }
      if (!ppNumber) { toast.error("Failed to generate document number"); setSaving(false); return; }
      const { data: pp, error: ppErr } = await supabase.from("purchase_proformas").insert({
        proforma_number: ppNumber, supplier_id: supplierId, date: ppDate,
        validity_days: Number(validityDays), subtotal, gst, total, status: "draft", notes: notes || null,
      }).select().single();
      if (ppErr || !pp) { console.error("Insert error:", ppErr); toast.error("Failed to create order: " + (ppErr?.message || "Unknown error")); setSaving(false); return; }
      const { error: itemsErr } = await supabase.from("purchase_proforma_items").insert(
        items.map(i => ({ proforma_id: pp.id, product_id: i.product_id || null, quantity_requested: Number(i.quantity_requested), rate: Number(i.rate), amount: i.amount }))
      );
      if (itemsErr) { console.error("Items insert error:", itemsErr); toast.error("Order created but items failed: " + itemsErr.message); }
      if (costs.length > 0) {
        const { error: costsErr } = await supabase.from("additional_costs").insert(
          costs.map(c => ({ reference_type: "purchase_proforma", reference_id: pp.id, cost_type: c.cost_type, description: c.description, amount: Number(c.amount), vendor_id: c.vendor_id || null }))
        );
        if (costsErr) console.error("Costs insert error:", costsErr);
      }
      toast.success(`Purchase Order ${ppNumber} created`);
      setCreateOpen(false); setSupplierId(""); setItems([]); setNotes(""); setCosts([]); load();
    } catch (err: any) {
      console.error("Unexpected error creating purchase order:", err);
      toast.error("Unexpected error: " + (err?.message || "Please try again"));
    } finally {
      setSaving(false);
    }
  };

  const addCostLine = () => {
    if (!costAmount) return;
    setCosts([...costs, { cost_type: costType, description: costDesc, amount: Number(costAmount), vendor_id: costVendorId }]);
    setCostDesc(""); setCostAmount(""); setCostVendorId("");
  };

  // ── PREVIEW (opens PDF popup directly) ──
  const openPreview = async (order: PurchaseOrder) => {
    const { data: its } = await supabase.from("purchase_proforma_items").select("*, products(name)").eq("proforma_id", order.id);
    setPreviewItems(its || []);
    const isInvoiced = order.status === "ordered" || order.status === "confirmed";
    const pdfDocTitle = isInvoiced ? "PURCHASE INVOICE" : "PURCHASE ORDER";
    const theme = order.status === "draft" ? "draft" as const : "invoiced" as const;
    setTimeout(() => {
      const html = generatePdfHtml({
        title: pdfDocTitle, documentNumber: order.po_number || order.proforma_number, date: order.date, statusTheme: theme,
        partyLabel: "Supplier", partyName: (order.suppliers as any)?.name || "—",
        partyAddress: (order.suppliers as any)?.address || undefined,
        partyPhone: (order.suppliers as any)?.phone || undefined,
        columns: [
          { header: "#", key: "idx" }, { header: "Product", key: "name" },
          { header: "Qty", key: "quantity_requested", align: "right" }, { header: "Rate", key: "rate", align: "right" },
          { header: "Amount", key: "amount", align: "right" },
        ],
        rows: (its || []).map((i: any, idx: number) => ({
          idx: idx + 1, name: i.products?.name || "Item",
          quantity_requested: i.quantity_requested, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString(),
        })),
        totals: [
          { label: "Subtotal", value: `PKR ${Number(order.subtotal).toLocaleString()}` },
          ...(settings?.gst_enabled ? [{ label: "GST", value: `PKR ${Number(order.gst).toLocaleString()}` }] : []),
          { label: "Total", value: `PKR ${Number(order.total).toLocaleString()}` },
        ],
        notes: order.notes || undefined, settings,
        template: getTemplate("purchase_proforma"),
      });
      setPdfHtml(html); setPdfTitle(`${pdfDocTitle} — ${order.po_number || order.proforma_number}`); setPdfOpen(true);
    }, 0);
  };

  const openEditSheet = async (order: PurchaseOrder) => {
    const { data: its } = await supabase.from("purchase_proforma_items").select("*, products(name)").eq("proforma_id", order.id);
    setEditOrder(order);
    setEditSupplierId(order.supplier_id || "");
    setEditDate(order.date);
    setEditValidity(String(order.validity_days));
    setEditNotes(order.notes || "");
    setEditItems((its || []).map((i: any) => ({
      product_id: i.product_id || "", product_name: i.products?.name || "Item",
      quantity_requested: i.quantity_requested, rate: Number(i.rate), amount: Number(i.amount),
    })));
    setEditOpen(true);
  };

  // ── WHATSAPP ──
  const shareWhatsApp = async (order: PurchaseOrder) => {
    const sup = order.suppliers as any;
    const supName = sup?.name || "Supplier";
    const supPhone = sup?.phone || "";
    const companyName = settings?.company_name || "DocPharmas";
    const { data: its } = await supabase.from("purchase_proforma_items").select("*, products(name)").eq("proforma_id", order.id);

    // Generate PDF link
    let pdfLink: string | undefined;
    try {
      const { uploadSharedDocument } = await import("@/lib/whatsapp-share");
      const html = generatePdfHtml({
        title: order.po_number ? "PURCHASE ORDER" : "PURCHASE PROFORMA",
        documentNumber: order.po_number || order.proforma_number,
        date: order.date, partyLabel: "Supplier", partyName: supName,
        columns: [
          { header: "#", key: "idx" }, { header: "Product", key: "product_name" },
          { header: "Qty", key: "quantity", align: "right" as const },
          { header: "Rate", key: "rate", align: "right" as const },
          { header: "Amount", key: "amount", align: "right" as const },
        ],
        rows: (its || []).map((i: any, idx: number) => ({
          idx: idx + 1, product_name: i.products?.name || "Item",
          quantity: i.quantity_requested, rate: Number(i.rate).toLocaleString(),
          amount: Number(i.amount).toLocaleString(),
        })),
        totals: [{ label: "Total", value: `PKR ${Number(order.total).toLocaleString()}` }],
        settings, template: getTemplate("purchase_order"),
      });
      pdfLink = await uploadSharedDocument(html, order.po_number || order.proforma_number) || undefined;
    } catch (e) { console.error("PDF link error:", e); }

    const { buildPurchaseOrderMessage, openWhatsApp } = await import("@/lib/whatsapp-share");
    const message = buildPurchaseOrderMessage({
      documentNumber: order.po_number || order.proforma_number,
      companyName, supplierName: supName, supplierPhone: supPhone,
      date: order.date,
      items: (its || []).map((i: any) => ({ product_name: i.products?.name || "Item", quantity: i.quantity_requested, rate: i.rate })),
      total: order.total,
      notes: order.notes || undefined, pdfLink,
    });
    openWhatsApp(supPhone, message);
  };

  // ── MAKE PAYMENT ──
  const openPaymentDialog = async (order: PurchaseOrder) => {
    // Find the purchase invoice linked to this order's PO
    let linkedInvoiceId: string | null = null;
    let remaining = order.total;
    if (order.converted_po_id) {
      const { data: grns } = await supabase.from("goods_received_notes").select("id").eq("po_id", order.converted_po_id);
      const grnIds = grns?.map(g => g.id) || [];
      if (grnIds.length > 0) {
        const { data: bills } = await supabase.from("purchase_invoices").select("id, total").in("grn_id", grnIds).limit(1);
        if (bills?.length) {
          linkedInvoiceId = bills[0].id;
          // Get direct payments for this specific invoice
          const { data: directPayments } = await supabase.from("payments").select("amount").eq("invoice_id", bills[0].id);
          const directPaid = directPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
          remaining = Math.max(Number(bills[0].total) - directPaid, 0);
        }
      }
    }
    
    setPaymentOrder({ ...order, _linkedInvoiceId: linkedInvoiceId } as any);
    setPaymentAmount(String(Math.max(remaining, 0)));
    setPaymentMethod("bank_transfer");
    const meezan = bankAccounts.find(b => b.bank_name.toLowerCase().includes("meezan"));
    setPaymentBankId(meezan?.id || bankAccounts[0]?.id || "");
    setPaymentOpen(true);
  };

  const handleMakePayment = async () => {
    if (!paymentOrder) return;
    setPaymentSaving(true);
    const { data: payNum } = await supabase.rpc("generate_document_number", { p_document_type: "payment" });
    if (!payNum) { toast.error("Failed to generate payment number"); setPaymentSaving(false); return; }
    const linkedInvoiceId = (paymentOrder as any)._linkedInvoiceId || null;
    const { error } = await supabase.from("payments").insert({
      payment_number: payNum,
      party_type: "supplier",
      party_id: paymentOrder.supplier_id!,
      type: "made",
      amount: Number(paymentAmount),
      payment_method: paymentMethod,
      bank_account_id: paymentMethod === "cash" ? null : paymentBankId || null,
      date: new Date().toISOString().split("T")[0],
      reference: paymentOrder.po_number || paymentOrder.proforma_number,
      invoice_id: linkedInvoiceId,
    } as any);
    if (error) { toast.error("Payment failed: " + error.message); setPaymentSaving(false); return; }
    toast.success(`Payment PKR ${Number(paymentAmount).toLocaleString()} made`);
    setPaymentOpen(false); setPaymentSaving(false); load();
  };

  // ── PDF ──
  const printOrder = (order: PurchaseOrder) => {
    const html = generatePdfHtml({
      title: "PURCHASE ORDER", documentNumber: order.proforma_number, date: order.date, statusTheme: "draft" as const,
      partyLabel: "Supplier", partyName: (order.suppliers as any)?.name || "—",
      partyAddress: (order.suppliers as any)?.address || undefined,
      partyPhone: (order.suppliers as any)?.phone || undefined,
      columns: [
        { header: "#", key: "idx" }, { header: "Product", key: "name" },
        { header: "Qty", key: "quantity_requested", align: "right" }, { header: "Rate", key: "rate", align: "right" },
        { header: "Amount", key: "amount", align: "right" },
      ],
      rows: previewItems.map((i: any, idx: number) => ({
        idx: idx + 1, name: i.products?.name || "Item",
        quantity_requested: i.quantity_requested, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString(),
      })),
      totals: [
        { label: "Subtotal", value: `PKR ${Number(order.subtotal).toLocaleString()}` },
        ...(settings?.gst_enabled ? [{ label: "GST", value: `PKR ${Number(order.gst).toLocaleString()}` }] : []),
        { label: "Total", value: `PKR ${Number(order.total).toLocaleString()}` },
      ],
      notes: order.notes || undefined, settings,
      template: getTemplate("purchase_proforma"),
    });
    setPdfHtml(html); setPdfTitle(`Purchase Order — ${order.proforma_number}`); setPdfOpen(true);
  };

  // ── CONFIRM ORDER (Create PO + Purchase Invoice + Delivery Note) ──
  const handleConfirmOrder = async (order: PurchaseOrder) => {
    setSaving(true);
    const { data: poNumber } = await supabase.rpc("generate_document_number", { p_document_type: "purchase_order" });
    if (!poNumber) { toast.error("Failed to generate PO number"); setSaving(false); return; }
    const { data: po, error: poErr } = await supabase.from("purchase_orders").insert({
      po_number: poNumber, supplier_id: order.supplier_id, date: new Date().toISOString().split("T")[0],
      subtotal: order.subtotal, gst: order.gst, total: order.total, status: "confirmed", proforma_id: order.id,
    }).select().single();
    if (poErr || !po) { toast.error("Failed to create PO: " + (poErr?.message || "Unknown error")); setSaving(false); return; }

    const { data: ppItems } = await supabase.from("purchase_proforma_items").select("*").eq("proforma_id", order.id);
    if (ppItems?.length) {
      await supabase.from("purchase_order_items").insert(
        ppItems.map((i: any) => ({
          po_id: po.id, product_id: i.product_id, quantity: Number(i.quantity_requested),
          quantity_confirmed: Number(i.quantity_requested), rate: Number(i.rate), amount: Number(i.amount),
        }))
      );
    }

    const { data: ppCosts } = await supabase.from("additional_costs").select("*").eq("reference_type", "purchase_proforma").eq("reference_id", order.id);
    if (ppCosts?.length) {
      await supabase.from("additional_costs").insert(
        ppCosts.map((c: any) => ({ reference_type: "purchase_order", reference_id: po.id, cost_type: c.cost_type, description: c.description, amount: Number(c.amount), vendor_id: c.vendor_id }))
      );
    }

    // Auto-create Purchase Invoice (Bill) linked to PO
    let createdBillId: string | null = null;
    try {
      const { data: billNumber } = await supabase.rpc("generate_document_number", { p_document_type: "purchase_invoice" });
      if (billNumber) {
        const supplier = suppliers.find(s => s.id === order.supplier_id);
        const whtRate = settings?.wht_enabled && supplier ? Number(supplier.wht_rate) : 0;
        const whtAmount = settings?.wht_enabled ? Number(order.subtotal) * whtRate / 100 : 0;
        const netTotal = Number(order.subtotal) + Number(order.gst) - whtAmount;
        const { data: bill } = await supabase.from("purchase_invoices").insert({
          bill_number: billNumber, supplier_id: order.supplier_id,
          date: po.date, subtotal: Number(order.subtotal), gst: Number(order.gst),
          wht_amount: whtAmount, total: netTotal, status: "unpaid",
        }).select("id").single();
        if (bill) createdBillId = bill.id;
      }
    } catch { /* bill generation is best-effort */ }

    // Auto-create Delivery Note
    try {
      const { data: dnNumber } = await supabase.rpc("generate_document_number", { p_document_type: "delivery_note" });
      if (dnNumber && ppItems?.length) {
        const dnItems = ppItems.map((i: any) => ({
          product_name: i.product_name || products.find(p => p.id === i.product_id)?.name || "Item",
          quantity: Number(i.quantity_requested),
        }));
        await supabase.from("delivery_notes").insert({
          dn_number: dnNumber, reference_type: "purchase_order", reference_id: po.id,
          supplier_id: order.supplier_id, items: dnItems,
        });
      }
    } catch { /* DN generation is best-effort */ }

    await supabase.from("purchase_proformas").update({ status: "ordered", converted_po_id: po.id }).eq("id", order.id);
    toast.success(`Purchase Invoice ${poNumber} + Delivery Note created`);

    // Show post-confirm document choice dialog
    setPostConfirmOrder({ ...order, converted_po_id: po.id, po_number: poNumber });
    setPostConfirmPoId(po.id);
    setSaving(false); load();
    setPostConfirmOpen(true);
  };

  // ── PURCHASE INVOICE PDF ──
  const printPurchaseInvoice = async (order: PurchaseOrder) => {
    const poId = order.converted_po_id;
    if (!poId) return;
    const { data: poItems } = await supabase.from("purchase_order_items").select("*, products(name)").eq("po_id", poId);
    const { data: poData } = await supabase.from("purchase_orders").select("*").eq("id", poId).single();
    if (!poData) return;
    const html = generatePdfHtml({
      title: "PURCHASE INVOICE", documentNumber: order.po_number || poData.po_number, date: poData.date, statusTheme: "invoiced" as const,
      partyLabel: "Supplier", partyName: (order.suppliers as any)?.name || "—",
      partyAddress: (order.suppliers as any)?.address || undefined,
      partyPhone: (order.suppliers as any)?.phone || undefined,
      columns: [
        { header: "#", key: "idx" }, { header: "Product", key: "name" },
        { header: "Qty", key: "quantity", align: "right" }, { header: "Rate", key: "rate", align: "right" },
        { header: "Amount", key: "amount", align: "right" },
      ],
      rows: (poItems || []).map((i: any, idx: number) => ({
        idx: idx + 1, name: i.products?.name || "Item",
        quantity: i.quantity, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString(),
      })),
      totals: [
        { label: "Subtotal", value: `PKR ${Number(poData.subtotal).toLocaleString()}` },
        ...(settings?.gst_enabled ? [{ label: "GST", value: `PKR ${Number(poData.gst).toLocaleString()}` }] : []),
        { label: "Total", value: `PKR ${Number(poData.total).toLocaleString()}` },
      ],
      settings, template: getTemplate("purchase_order"),
    });
    setPdfHtml(html); setPdfTitle(`Purchase Invoice — ${order.po_number || poData.po_number}`); setPdfOpen(true);
  };

  // ── PURCHASE DELIVERY NOTE PDF ──
  const printPurchaseDeliveryNote = async (order: PurchaseOrder) => {
    const poId = order.converted_po_id;
    if (!poId) return;
    const { data: dn } = await supabase.from("delivery_notes").select("*").eq("reference_id", poId).single();
    if (!dn) { toast.error("Delivery note not found"); return; }
    const dnItems = typeof dn.items === "string" ? JSON.parse(dn.items) : (dn.items as any[]);
    const html = generatePdfHtml({
      title: "DELIVERY NOTE", documentNumber: dn.dn_number, date: dn.date, statusTheme: "dispatched" as const,
      partyLabel: "Supplier", partyName: (order.suppliers as any)?.name || "—",
      partyAddress: (order.suppliers as any)?.address || undefined,
      partyPhone: (order.suppliers as any)?.phone || undefined,
      columns: [
        { header: "#", key: "idx" },
        { header: "Product", key: "product_name" },
        { header: "Qty", key: "quantity", align: "right" },
      ],
      rows: dnItems.map((i: any, idx: number) => ({
        idx: idx + 1,
        product_name: i.product_name || "Item",
        quantity: i.quantity,
      })),
      totals: [],
      settings, template: getTemplate("delivery_note"),
    });
    setPdfHtml(html); setPdfTitle(`Delivery Note — ${dn.dn_number}`); setPdfOpen(true);
  };

  // ── RECEIVE (GRN + Bill) ──
  const openReceiveDialog = async (order: PurchaseOrder) => {
    const poId = order.converted_po_id || order.id;
    const { data: poItems } = await supabase.from("purchase_order_items").select("*, products(name)").eq("po_id", poId);
    if (poItems) {
      setReceiveItems(poItems.map((i: any) => ({
        ...i, item_name: i.products?.name || "Item",
        batch_number: "", expiry_date: "", quantity_received: Number(i.quantity_confirmed) || Number(i.quantity),
        quantity_confirmed: Number(i.quantity_confirmed) || Number(i.quantity),
      })));
    }
    setReceivePO(order);
    setReceiveOpen(true);
  };

  const handleReceive = async () => {
    if (!receivePO) return;
    if (!receiveItems.every(i => i.batch_number)) { toast.error("Batch number required for all items"); return; }
    if (!receiveItems.every(i => i.expiry_date)) { toast.error("Expiry date required for all items"); return; }
    setReceiving(true);

    const poId = receivePO.converted_po_id || receivePO.id;
    const { data: grnNumber } = await supabase.rpc("generate_document_number", { p_document_type: "grn" });
    if (!grnNumber) { toast.error("Failed to generate GRN number"); setReceiving(false); return; }

    const { data: grn } = await supabase.from("goods_received_notes").insert({
      grn_number: grnNumber, po_id: poId, supplier_id: receivePO.supplier_id,
      date: new Date().toISOString().split("T")[0], received_by: receivedBy || null, notes: receiveNotes || null,
    }).select().single();

    if (grn) {
      await supabase.from("grn_items").insert(
        receiveItems.map(i => ({
          grn_id: grn.id, item_name: i.item_name, product_id: i.product_id || null,
          batch_number: i.batch_number || null,
          quantity_ordered: Number(i.quantity), quantity_received: Number(i.quantity_received),
          expiry_date: i.expiry_date || null, rate: Number(i.rate), amount: Number(i.quantity_received) * Number(i.rate),
        }))
      );

      // Stock movements for received quantities (purchase_in = actual received qty, no extra adjustment)
      const varianceItems: { name: string; ordered: number; received: number; diff: number }[] = [];
      for (const item of receiveItems) {
        if (item.product_id) {
          await supabase.from("stock_movements").insert({
            product_id: item.product_id, quantity: Number(item.quantity_received),
            movement_type: "purchase_in", batch_number: item.batch_number || null,
            reference_type: "grn", reference_id: grn.id, date: grn.date, notes: `GRN ${grnNumber}`,
          });

          // Track variance for reporting only (no extra stock movement — purchase_in already has correct qty)
          const ordered = Number(item.quantity_confirmed) || Number(item.quantity);
          const received = Number(item.quantity_received);
          if (ordered !== received) {
            varianceItems.push({ name: item.item_name, ordered, received, diff: received - ordered });
          }
        }
      }

      await supabase.from("purchase_orders").update({ status: "received" }).eq("id", poId);

      // Find the bill linked to this specific PO (created at confirm stage)
      const poId2 = receivePO.converted_po_id || receivePO.id;
      // Look for bills that match this PO's supplier AND were created on the same date as the PO
      const { data: poData2 } = await supabase.from("purchase_orders").select("date, supplier_id").eq("id", poId2).single();
      const { data: existingBill } = await supabase.from("purchase_invoices")
        .select("id")
        .eq("supplier_id", poData2?.supplier_id || receivePO.supplier_id || "")
        .eq("date", poData2?.date || "")
        .is("grn_id", null)
        .limit(1);
      
      if (existingBill && existingBill.length > 0) {
        // Link the existing bill (from confirm) to this GRN
        await supabase.from("purchase_invoices").update({ grn_id: grn.id }).eq("id", existingBill[0].id);
        toast.success(`GRN ${grnNumber} created & linked to existing bill`, {
          action: { label: "Create Print Job", onClick: () => navigate(`/print-jobs?from_grn=1`) },
        });
      } else {
        // No bill exists yet — create one now
        try {
          const { data: billNumber } = await supabase.rpc("generate_document_number", { p_document_type: "purchase_invoice" });
          if (billNumber) {
            const { data: poData } = await supabase.from("purchase_orders").select("subtotal, gst, total, supplier_id").eq("id", poId).single();
            if (poData) {
              const supplier = suppliers.find(s => s.id === poData.supplier_id);
              const whtRate = settings?.wht_enabled && supplier ? Number(supplier.wht_rate) : 0;
              const whtAmount = settings?.wht_enabled ? Number(poData.subtotal) * whtRate / 100 : 0;
              const netTotal = Number(poData.subtotal) + Number(poData.gst) - whtAmount;
              await supabase.from("purchase_invoices").insert({
                bill_number: billNumber, supplier_id: poData.supplier_id, grn_id: grn.id,
                date: grn.date, subtotal: Number(poData.subtotal), gst: Number(poData.gst),
                wht_amount: whtAmount, total: netTotal, status: "unpaid",
              });
              toast.success(`GRN ${grnNumber} + Bill ${billNumber} created`, {
                action: { label: "Create Print Job", onClick: () => navigate(`/print-jobs?from_grn=1`) },
              });
            }
          }
        } catch {
          toast.success(`GRN ${grnNumber} created`);
        }
      }

      // Show variance summary if any
      if (varianceItems.length > 0) {
        const summary = varianceItems.map(v => `${v.name}: ordered ${v.ordered}, received ${v.received} (${v.diff > 0 ? "+" : ""}${v.diff})`).join("; ");
        toast.warning(`Stock variance detected: ${summary}`, { duration: 8000 });
      }

      const grnHtml = generatePdfHtml({
        title: "GOODS RECEIVED NOTE", documentNumber: grnNumber, date: grn.date, statusTheme: "received" as const,
        partyLabel: "Supplier", partyName: (receivePO.suppliers as any)?.name || "—",
        columns: [
          { header: "#", key: "idx" }, { header: "Item", key: "item_name" },
          { header: "Batch", key: "batch_number" }, { header: "Expiry", key: "expiry_date" },
          { header: "Qty Received", key: "quantity_received", align: "right" },
        ],
        rows: receiveItems.map((i: any, idx: number) => ({
          idx: idx + 1, item_name: i.item_name, batch_number: i.batch_number || "—",
          expiry_date: i.expiry_date || "—", quantity_received: i.quantity_received,
        })),
        settings, template: getTemplate("grn"),
      });
      setPdfHtml(grnHtml); setPdfTitle(`GRN — ${grnNumber}`); setPdfOpen(true);
      setReceiveOpen(false); setReceivedBy(""); setReceiveNotes(""); setReceiving(false); load();
    } else { setReceiving(false); }
  };

  // ── EDIT ──

  const updateEditItem = async (idx: number, field: string, value: any) => {
    const u = [...editItems];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.cost_price); }
      if (editSupplierId && value) {
        const lastRate = await lookupLastSupplierPrice(value, editSupplierId);
        (u[idx] as any).last_price = lastRate;
        if (lastRate !== null) u[idx].rate = lastRate;
      }
    }
    u[idx].amount = Number(u[idx].quantity_requested) * Number(u[idx].rate);
    setEditItems([...u]);
  };

  const handleEditSave = async () => {
    if (!editOrder) return;
    setSaving(true);
    const { subtotal, gst, total } = calcTotals(editItems);
    await supabase.from("purchase_proformas").update({
      supplier_id: editSupplierId || null, date: editDate, validity_days: Number(editValidity),
      notes: editNotes || null, subtotal, gst, total,
    }).eq("id", editOrder.id);
    await supabase.from("purchase_proforma_items").delete().eq("proforma_id", editOrder.id);
    if (editItems.length > 0) {
      await supabase.from("purchase_proforma_items").insert(editItems.map(i => ({
        proforma_id: editOrder.id, product_id: i.product_id || null,
        quantity_requested: Number(i.quantity_requested), rate: Number(i.rate), amount: i.amount,
      })));
    }
    toast.success("Order updated");
    setEditOpen(false); setSaving(false); load();
  };

  // ── ADD COST ──
  const addCostToExisting = async () => {
    if (!costDialogId || !costAmount) return;
    await supabase.from("additional_costs").insert({
      reference_type: "purchase_proforma", reference_id: costDialogId,
      cost_type: costType, description: costDesc, amount: Number(costAmount), vendor_id: costVendorId || null,
    });
    toast.success("Cost added");
    setCostDialogOpen(false); setCostDesc(""); setCostAmount(""); setCostVendorId("");
  };

  // ── VOID (Rollback) ──
  const promptVoid = (order: PurchaseOrder) => { setVoidOrder(order); setVoidConfirmOpen(true); };
  const confirmVoid = async () => {
    if (!voidOrder || !voidOrder.converted_po_id) return;
    setVoiding(true);
    const poId = voidOrder.converted_po_id;
    // 1. Delete stock movements linked to any GRN for this PO
    const { data: grns } = await supabase.from("goods_received_notes").select("id").eq("po_id", poId);
    if (grns?.length) {
      for (const grn of grns) {
        await supabase.from("stock_movements").delete().eq("reference_id", grn.id);
        await supabase.from("grn_items").delete().eq("grn_id", grn.id);
      }
      // Delete purchase invoices linked to GRNs
      const grnIds = grns.map(g => g.id);
      await supabase.from("purchase_invoices").delete().in("grn_id", grnIds);
      await supabase.from("goods_received_notes").delete().in("id", grnIds);
    }
    // 2. Delete purchase invoices linked to this specific PO (unlinked bills created at confirm)
    // Find bills that match the PO's supplier and were created around the same time
    const poId2 = voidOrder.converted_po_id;
    const { data: poData } = await supabase.from("purchase_orders").select("date, supplier_id").eq("id", poId2!).single();
    if (poData) {
      // Delete only bills matching this PO's supplier + date that have no GRN link
      await supabase.from("purchase_invoices").delete()
        .eq("supplier_id", poData.supplier_id || "")
        .eq("date", poData.date)
        .is("grn_id", null);
    }
    // 3. Delete delivery notes
    await supabase.from("delivery_notes").delete().eq("reference_id", poId);
    // 4. Delete PO items and PO
    await supabase.from("purchase_order_items").delete().eq("po_id", poId);
    await supabase.from("additional_costs").delete().eq("reference_type", "purchase_order").eq("reference_id", poId);
    await supabase.from("purchase_orders").delete().eq("id", poId);
    // 5. Reset proforma to draft
    await supabase.from("purchase_proformas").update({ status: "draft", converted_po_id: null }).eq("id", voidOrder.id);
    toast.success(`Order ${voidOrder.proforma_number} voided — PO, bill, delivery note & stock reversed`);
    setVoidConfirmOpen(false); setVoidOrder(null); setVoiding(false); load();
  };

  // ── DELETE ──
  const promptDelete = (ids: string[]) => { setDeleteIds(ids); setDeleteConfirmOpen(true); };
  const confirmDelete = async () => {
    for (let i = 0; i < deleteIds.length; i += 200) {
      const chunk = deleteIds.slice(i, i + 200);
      await supabase.from("purchase_proforma_items").delete().in("proforma_id", chunk);
      await supabase.from("additional_costs").delete().eq("reference_type", "purchase_proforma").in("reference_id", chunk);
      await supabase.from("purchase_proformas").delete().in("id", chunk);
    }
    toast.success(`${deleteIds.length} deleted`);
    setSelected(new Set()); setDeleteConfirmOpen(false); setDeleteIds([]);
    if (editOpen && editOrder && deleteIds.includes(editOrder.id)) setEditOpen(false);
    load();
  };

  // ── FILTERS ──
  const { subtotal, gst, total } = calcTotals(items);
  const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));
  const productOptions = (allocatedProductIds && allocatedProductIds.length > 0
    ? products.filter(p => allocatedProductIds.includes(p.id))
    : products
  ).map(p => ({ value: p.id, label: p.name }));

  const getDateFilter = () => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    if (dateRange === "today") return todayStr;
    if (dateRange === "week") { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().split("T")[0]; }
    if (dateRange === "month") return todayStr.slice(0, 7) + "-01";
    return null;
  };

  const filtered = orders.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.proforma_number.toLowerCase().includes(q) ||
      ((p.suppliers as any)?.name || "").toLowerCase().includes(q) ||
      (p.po_number || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || p.status === statusFilter ||
      (statusFilter === "ordered" && (p.status === "ordered" || p.status === "confirmed" || p.status === "received" || p.status === "paid"));
    const dateStart = getDateFilter();
    const matchDate = !dateStart || p.date >= dateStart;
    return matchSearch && matchStatus && matchDate;
  });

  // Month selector for stats
  const now2 = new Date();
  const [statsMonth, setStatsMonth] = useState(() => `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, "0")}`);
  const statsMonthLabel = (() => {
    const [y, m] = statsMonth.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-PK", { month: "long", year: "numeric" });
  })();
  const prevMonth = () => {
    const [y, m] = statsMonth.split("-").map(Number);
    const d = new Date(y, m - 2);
    setStatsMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const [y, m] = statsMonth.split("-").map(Number);
    const d = new Date(y, m);
    setStatsMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthOrders = orders.filter(o => o.date.startsWith(statsMonth));
  const statsByStatus = (status: string) => {
    const list = monthOrders.filter(d => d.status === status);
    return { count: list.length, value: list.reduce((s, d) => s + Number(d.total), 0) };
  };
  const draftStats = { count: monthOrders.filter(d => d.status === "draft").length, value: monthOrders.filter(d => d.status === "draft").reduce((s, d) => s + Number(d.total), 0) };
  const invoiceStats = { 
    count: monthOrders.filter(d => d.status !== "draft").length, 
    value: monthOrders.filter(d => d.status !== "draft").reduce((s, d) => s + Number(d.total), 0) 
  };

  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));

  const statusColor = (s: string) => {
    if (s === "paid") return "bg-green-500/15 text-green-700 border-green-500/20";
    if (s === "received") return "bg-emerald-500/15 text-emerald-600 border-emerald-500/20";
    if (s === "confirmed") return "bg-blue-500/15 text-blue-600 border-blue-500/20";
    if (s === "ordered") return "bg-blue-500/15 text-blue-600 border-blue-500/20";
    if (s === "draft") return "bg-amber-500/15 text-amber-600 border-amber-500/20";
    return "bg-muted text-muted-foreground";
  };
  const statusLabel = (s: string) => ({ draft: "Draft", ordered: "Invoice", confirmed: "Invoice", received: "Received", paid: "Paid" }[s] || s);
  const allStats = { count: monthOrders.length, value: monthOrders.reduce((s, d) => s + Number(d.total), 0) };

  return (
    <AppLayout title="Purchase Orders" subtitle="Draft → confirm order → receive with batch + expiry → auto GRN + bill"
      headerActions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:scale-[1.02] transition-all"><Plus className="h-4 w-4" /> New Order</Button></DialogTrigger>
           <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">Create Purchase Order</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Supplier *</Label>
                <SearchableSelect options={supplierOptions} value={supplierId} onChange={setSupplierId} placeholder="Select supplier..." />
              </div>
              <div><Label className="text-xs font-medium text-muted-foreground">Date</Label><Input type="date" value={ppDate} onChange={e => setPpDate(e.target.value)} /></div>
              <div><Label className="text-xs font-medium text-muted-foreground">Validity (days)</Label><Input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} /></div>
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold">Items</Label>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Add Item</Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                <div className="col-span-5"><SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateItem(idx, "product_id", v)} placeholder="Product" triggerClassName="text-xs h-9" /></div>
                <div className="col-span-2"><Input type="number" value={item.quantity_requested} onChange={e => updateItem(idx, "quantity_requested", e.target.value)} className="text-xs" placeholder="Qty" /></div>
                <div className="col-span-2 relative">
                  <Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className="text-xs" placeholder="Rate" />
                  {(item as any).last_price !== undefined && (item as any).last_price !== null && (
                    <span className="absolute -bottom-4 left-0 text-[10px] text-emerald-600 font-medium">Last: PKR {Number((item as any).last_price).toLocaleString()}</span>
                  )}
                </div>
                <div className="col-span-2 text-right text-sm font-mono pt-2 text-foreground">{item.amount.toLocaleString()}</div>
                <div className="col-span-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div>
              </div>
            ))}
            <Separator className="my-3" />
            <div>
              <Label className="text-sm font-semibold">Additional Costs</Label>
              {costs.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-1 text-xs mt-1">
                  <Badge variant="outline" className="capitalize text-[10px]">{c.cost_type}</Badge>
                  <span className="flex-1 text-muted-foreground">{c.description}</span>
                  <span className="font-mono">PKR {Number(c.amount).toLocaleString()}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCosts(costs.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </div>
              ))}
              <div className="grid grid-cols-12 gap-2 mt-2 items-end">
                <div className="col-span-2">
                  <Select value={costType} onValueChange={setCostType}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="printing">Printing</SelectItem><SelectItem value="packaging">Packaging</SelectItem>
                      <SelectItem value="freight_in">Freight In</SelectItem><SelectItem value="freight_out">Freight Out</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3"><Input className="text-xs" placeholder="Description" value={costDesc} onChange={e => setCostDesc(e.target.value)} /></div>
                <div className="col-span-2"><Input className="text-xs" type="number" placeholder="Amount" value={costAmount} onChange={e => setCostAmount(e.target.value)} /></div>
                <div className="col-span-3"><SearchableSelect options={supplierOptions} value={costVendorId} onChange={setCostVendorId} placeholder="Vendor" triggerClassName="text-xs h-9" /></div>
                <div className="col-span-2"><Button variant="outline" size="sm" onClick={addCostLine} className="text-xs w-full">+ Add</Button></div>
              </div>
            </div>
            <Separator className="my-3" />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">{subtotal.toLocaleString()}</span></div>
              {settings?.gst_enabled && <div className="flex justify-between text-muted-foreground"><span>GST</span><span className="font-mono">{gst.toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold text-foreground text-base"><span>Total</span><span className="font-mono">PKR {total.toLocaleString()}</span></div>
            </div>
            <div className="mt-3"><Label className="text-xs font-medium text-muted-foreground">Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
            <Button onClick={handleSave} disabled={saving} className="w-full mt-4 h-11 text-sm font-semibold">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Purchase Order
            </Button>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-4">
            {/* MONTH SELECTOR */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-semibold min-w-[140px] text-center">{statsMonthLabel}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* PREMIUM STATUS BUTTONS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              {[
                { label: "All", ...allStats, secondLine: `PKR ${allStats.value.toLocaleString()}`, icon: FileText, gradient: "from-slate-500/8 to-slate-600/15", iconBg: "from-slate-500 to-slate-600", accent: "from-slate-400 to-slate-600", textColor: "text-foreground", statusKey: "all" },
                { label: "Draft", ...draftStats, secondLine: `PKR ${draftStats.value.toLocaleString()}`, icon: FileEdit, gradient: "from-amber-500/8 to-amber-600/15", iconBg: "from-amber-500 to-amber-600", accent: "from-amber-400 to-amber-600", textColor: "text-amber-600", statusKey: "draft" },
                { label: "Invoice", ...invoiceStats, secondLine: `PKR ${invoiceStats.value.toLocaleString()}`, icon: Send, gradient: "from-blue-500/8 to-blue-600/15", iconBg: "from-blue-500 to-blue-600", accent: "from-blue-400 to-blue-600", textColor: "text-blue-600", statusKey: "ordered" },
                { label: "Received", ...receivedStats, secondLine: `PKR ${receivedStats.value.toLocaleString()}`, icon: PackageOpen, gradient: "from-emerald-500/8 to-emerald-600/15", iconBg: "from-emerald-500 to-emerald-600", accent: "from-emerald-400 to-emerald-600", textColor: "text-emerald-600", statusKey: "received" },
                { label: "Paid", ...paidStats, secondLine: `PKR ${paidStats.value.toLocaleString()}`, icon: BadgeDollarSign, gradient: "from-green-500/8 to-green-600/15", iconBg: "from-green-500 to-green-600", accent: "from-green-400 to-green-600", textColor: "text-green-600", statusKey: "paid" },
              ].map(s => (
                <button key={s.label} onClick={() => setStatusFilter(s.statusKey)}
                  className={`group relative flex flex-col items-center justify-center h-[90px] sm:h-[120px] rounded-xl sm:rounded-2xl bg-gradient-to-br ${s.gradient} border border-border/50 backdrop-blur-sm hover:scale-[1.03] hover:shadow-lg transition-all duration-300 overflow-hidden ${statusFilter === s.statusKey ? "ring-2 ring-offset-2 ring-primary/40 shadow-lg" : ""}`}>
                  <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br ${s.iconBg} shadow-md flex items-center justify-center mb-1 sm:mb-1.5 group-hover:scale-110 transition-transform duration-300`}>
                    <s.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                  </div>
                  <span className={`text-base sm:text-lg font-bold font-heading ${s.textColor}`}>{s.count}</span>
                  <span className="text-[8px] sm:text-[9px] font-mono text-muted-foreground">{s.secondLine}</span>
                  <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.1em] sm:tracking-[0.12em] text-muted-foreground">{s.label}</span>
                  <div className={`absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r ${s.accent} opacity-50 group-hover:opacity-100 transition-opacity`} />
                </button>
              ))}
            </div>

            {/* FILTERS */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search orders & suppliers..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-1 rounded-xl bg-muted/40 backdrop-blur-sm p-1 border border-border/30">
                {[{ label: "All", value: "all" }, { label: "Today", value: "today" }, { label: "Week", value: "week" }, { label: "Month", value: "month" }].map(d => (
                  <button key={d.value} onClick={() => setDateRange(d.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === d.value ? "bg-gradient-to-br from-primary/10 to-primary/5 text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TABLE */}
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                        <TableHead className="font-semibold">Order #</TableHead>
                        <TableHead className="font-semibold">Supplier</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="text-right font-semibold">Total</TableHead>
                        <TableHead className="text-right font-semibold">Balance</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-16">
                          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                          <p className="text-muted-foreground font-medium">No purchase orders yet</p>
                          <p className="text-xs text-muted-foreground mt-1">Click "New Order" to start</p>
                        </TableCell></TableRow>
                      ) : filtered.map(order => {
                        const isPaid = order.status === "paid";
                        const balance = order.status === "draft" ? null : (isPaid ? 0 : Number(order.total));
                        return (
                        <TableRow key={order.id} className={`group cursor-pointer hover:bg-muted/30 transition-colors ${isPaid ? "bg-emerald-500/5" : ""}`} data-state={selected.has(order.id) ? "selected" : undefined}>
                          <TableCell><Checkbox checked={selected.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} /></TableCell>
                          <TableCell className="font-mono font-semibold text-sm" onClick={() => openPreview(order)}>{order.proforma_number}</TableCell>
                          <TableCell className="text-sm" onClick={() => openPreview(order)}>{(order.suppliers as any)?.name || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground" onClick={() => openPreview(order)}>{order.date}</TableCell>
                          <TableCell onClick={() => openPreview(order)}>
                            <Badge variant="outline" className={`text-[10px] font-semibold ${statusColor(order.status)}`}>{statusLabel(order.status)}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-sm" onClick={() => openPreview(order)}>{Number(order.total).toLocaleString()}</TableCell>
                          <TableCell className={`text-right font-mono text-sm ${balance === 0 ? "text-emerald-600 font-semibold" : balance !== null ? "text-orange-600 font-semibold" : "text-muted-foreground"}`}>
                            {balance !== null ? (balance === 0 ? "✓ Paid" : Number(balance).toLocaleString()) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {order.status === "draft" && (
                                <Button variant="default" size="sm" onClick={() => handleConfirmOrder(order)} className="h-7 text-xs gap-1 shadow-sm">
                                  <CheckCircle className="h-3 w-3" /> <span className="hidden sm:inline">Confirm</span>
                                </Button>
                              )}
                              {(order.status === "ordered" || order.status === "confirmed") && (
                                <Button variant="default" size="sm" onClick={() => openReceiveDialog(order)} className="h-7 text-xs gap-1 shadow-sm">
                                  <PackageCheck className="h-3 w-3" /> <span className="hidden sm:inline">Receive</span>
                                </Button>
                              )}
                              {(order.status === "ordered" || order.status === "confirmed" || order.status === "received") && order.supplier_id && !isPaid && (
                                <Button size="sm" onClick={() => openPaymentDialog(order)} className="h-7 text-xs gap-1 bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-sm" title="Make Payment">
                                  <DollarSign className="h-3 w-3" /> <span className="hidden sm:inline">Payment</span>
                                </Button>
                              )}
                              {/* Quick WhatsApp */}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shareWhatsApp(order)} title="Share via WhatsApp">
                                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => openPreview(order)}><Eye className="h-3.5 w-3.5 mr-2" /> View PDF</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => shareWhatsApp(order)}><MessageCircle className="h-3.5 w-3.5 mr-2 text-emerald-600" /> WhatsApp</DropdownMenuItem>
                                  {order.converted_po_id && <DropdownMenuItem onClick={() => printPurchaseInvoice(order)}><FileText className="h-3.5 w-3.5 mr-2" /> Invoice PDF</DropdownMenuItem>}
                                  {order.converted_po_id && <DropdownMenuItem onClick={() => printPurchaseDeliveryNote(order)}><Truck className="h-3.5 w-3.5 mr-2" /> Delivery Note</DropdownMenuItem>}
                                  {order.status === "draft" && <DropdownMenuItem onClick={() => openEditSheet(order)}><Pencil className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>}
                                  {(order.status === "ordered" || order.status === "confirmed") && <DropdownMenuItem onClick={() => promptVoid(order)} className="text-destructive"><RotateCcw className="h-3.5 w-3.5 mr-2" /> Void</DropdownMenuItem>}
                                  {order.status === "draft" && <DropdownMenuItem onClick={() => promptDelete([order.id])} className="text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* BULK DELETE */}
          {selected.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <Button size="sm" variant="secondary" onClick={() => promptDelete(Array.from(selected))} className="gap-1"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
            </div>
          )}

          {/* DELETE CONFIRM */}
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Delete {deleteIds.length} order(s)?</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">This will also remove items and additional costs. Cannot be undone.</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="flex-1">Cancel</Button>
                <Button variant="destructive" onClick={confirmDelete} className="flex-1">Delete</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ═══ EDIT ORDER DIALOG ═══ */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading">Edit Order {editOrder?.proforma_number}</DialogTitle></DialogHeader>
              {editOrder && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs font-medium text-muted-foreground">Supplier</Label><SearchableSelect options={supplierOptions} value={editSupplierId} onChange={setEditSupplierId} placeholder="Supplier..." /></div>
                    <div><Label className="text-xs font-medium text-muted-foreground">Date</Label><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
                  </div>
                  <div><Label className="text-xs font-medium text-muted-foreground">Validity (days)</Label><Input type="number" value={editValidity} onChange={e => setEditValidity(e.target.value)} /></div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Items</Label>
                    <Button variant="outline" size="sm" onClick={() => setEditItems([...editItems, { product_id: "", product_name: "", quantity_requested: 1, rate: 0, amount: 0 }])} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Add</Button>
                  </div>
                  {editItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5"><SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateEditItem(idx, "product_id", v)} placeholder="Product" triggerClassName="text-xs h-9" /></div>
                      <div className="col-span-2"><Input type="number" value={item.quantity_requested} onChange={e => updateEditItem(idx, "quantity_requested", e.target.value)} className="text-xs" placeholder="Qty" /></div>
                      <div className="col-span-2 relative">
                        <Input type="number" value={item.rate} onChange={e => updateEditItem(idx, "rate", e.target.value)} className="text-xs" placeholder="Rate" />
                        {(item as any).last_price !== undefined && (item as any).last_price !== null && (
                          <span className="absolute -bottom-4 left-0 text-[10px] text-emerald-600 font-medium">Last: PKR {Number((item as any).last_price).toLocaleString()}</span>
                        )}
                      </div>
                      <div className="col-span-2 text-right text-xs font-mono pt-2">{item.amount.toLocaleString()}</div>
                      <div className="col-span-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                    </div>
                  ))}
                  <div className="mt-3"><Label className="text-xs font-medium text-muted-foreground">Notes</Label><Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} /></div>
                  {(() => { const t = calcTotals(editItems); return (
                    <div className="border-t border-border pt-3 space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">{t.subtotal.toLocaleString()}</span></div>
                      <div className="flex justify-between font-bold text-foreground"><span>Total</span><span className="font-mono">PKR {t.total.toLocaleString()}</span></div>
                    </div>
                  ); })()}
                  <div className="flex gap-2">
                    <Button onClick={handleEditSave} disabled={saving} className="flex-1">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save</Button>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* ADD COST DIALOG */}
          <Dialog open={costDialogOpen} onOpenChange={setCostDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="font-heading">Add Additional Cost</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Cost Type</Label>
                  <Select value={costType} onValueChange={setCostType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="printing">Printing</SelectItem><SelectItem value="packaging">Packaging</SelectItem>
                      <SelectItem value="freight_in">Freight In</SelectItem><SelectItem value="freight_out">Freight Out</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs font-medium text-muted-foreground">Description</Label><Input value={costDesc} onChange={e => setCostDesc(e.target.value)} /></div>
                <div><Label className="text-xs font-medium text-muted-foreground">Amount</Label><Input type="number" value={costAmount} onChange={e => setCostAmount(e.target.value)} /></div>
                <div><Label className="text-xs font-medium text-muted-foreground">Vendor</Label><SearchableSelect options={supplierOptions} value={costVendorId} onChange={setCostVendorId} placeholder="Select vendor..." /></div>
                <Button onClick={addCostToExisting} className="w-full">Add Cost</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* RECEIVE DIALOG (GRN) */}
          <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading">Receive Goods — Create GRN + Bill</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground mb-3">Enter batch numbers & expiry dates for each item.</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div><Label className="text-xs font-medium text-muted-foreground">Received By</Label><Input value={receivedBy} onChange={e => setReceivedBy(e.target.value)} placeholder="Name" /></div>
                <div><Label className="text-xs font-medium text-muted-foreground">Notes</Label><Input value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} placeholder="Optional" /></div>
              </div>
              <Separator />
              {receiveItems.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{item.item_name}</span>
                    <span className="text-xs font-mono text-muted-foreground">Ordered: {item.quantity}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Batch # *</Label>
                      <Input className="text-xs" value={item.batch_number} onChange={e => {
                        const u = [...receiveItems]; u[idx].batch_number = e.target.value; setReceiveItems(u);
                      }} placeholder="Batch number" />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Expiry *</Label>
                      <Input type="date" className="text-xs" value={item.expiry_date} onChange={e => {
                        const u = [...receiveItems]; u[idx].expiry_date = e.target.value; setReceiveItems(u);
                      }} />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Qty Received</Label>
                      <Input type="number" className="text-xs" value={item.quantity_received} onChange={e => {
                        const u = [...receiveItems]; u[idx].quantity_received = e.target.value; setReceiveItems(u);
                      }} />
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={handleReceive} disabled={receiving} className="w-full h-11 gap-2 text-sm font-semibold mt-4">
                {receiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                Confirm Receipt — Create GRN + Bill
              </Button>
            </DialogContent>
          </Dialog>

          {/* VOID CONFIRM */}
          <AlertDialog open={voidConfirmOpen} onOpenChange={setVoidConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Void Order {voidOrder?.proforma_number}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the PO, purchase invoice (bill), delivery note, GRN, and reverse all stock movements. The order will return to Draft status.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={voiding}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmVoid} disabled={voiding} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {voiding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Void & Rollback
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

      <PdfPreviewDialog open={pdfOpen} onOpenChange={setPdfOpen} html={pdfHtml} title={pdfTitle} />

      {/* ═══ POST-CONFIRM DOCUMENT CHOICE ═══ */}
      <Dialog open={postConfirmOpen} onOpenChange={setPostConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-center">Documents Ready</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-center">Purchase Invoice and Delivery Note have been created. Which document would you like to view?</p>
          <div className="flex flex-col gap-3 mt-2">
            <Button
              className="h-12 gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white"
              onClick={() => { setPostConfirmOpen(false); if (postConfirmOrder) printPurchaseInvoice(postConfirmOrder); }}
            >
              <FileText className="h-4 w-4" /> View Purchase Invoice
              <span className="text-xs opacity-75 ml-1">(for records)</span>
            </Button>
            <Button
              variant="outline"
              className="h-12 gap-2"
              onClick={() => { setPostConfirmOpen(false); if (postConfirmOrder) printPurchaseDeliveryNote(postConfirmOrder); }}
            >
              <Truck className="h-4 w-4" /> View Delivery Note
              <span className="text-xs text-muted-foreground ml-1">(for staff)</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ MAKE PAYMENT DIALOG ═══ */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Make Payment</DialogTitle></DialogHeader>
          {paymentOrder && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground">Purchase Order</p>
                <p className="font-semibold text-sm">{paymentOrder.po_number || paymentOrder.proforma_number} — {(paymentOrder.suppliers as any)?.name || "Supplier"}</p>
                <p className="text-xs text-muted-foreground mt-1">Total: PKR {Number(paymentOrder.total).toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Amount (PKR)</Label>
                <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={v => { setPaymentMethod(v); if (v === "cash") setPaymentBankId(""); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod !== "cash" && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Paying Account</Label>
                  <Select value={paymentBankId} onValueChange={setPaymentBankId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select account..." /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name} ({b.bank_name})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleMakePayment} disabled={paymentSaving || !paymentAmount} className="w-full h-11 gap-2 bg-gradient-to-r from-emerald-600 to-green-700 text-white">
                {paymentSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                <DollarSign className="h-4 w-4" /> Pay PKR {Number(paymentAmount || 0).toLocaleString()}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
