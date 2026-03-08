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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, FileText, Trash2, Download, CheckCircle, Pencil, PackageCheck, MessageCircle, DollarSign, Eye, Loader2, FileEdit, ShoppingCart, BadgeCheck, PackageOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdfHtml } from "@/lib/pdf-generator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";

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

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<PurchaseOrder | null>(null);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [previewCosts, setPreviewCosts] = useState<any[]>([]);
  const [pdfHtml, setPdfHtml] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  // Edit
  const [editMode, setEditMode] = useState(false);
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

  // Costs dialog
  const [costDialogOpen, setCostDialogOpen] = useState(false);
  const [costDialogId, setCostDialogId] = useState("");

  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  // ── SIMPLIFIED LOAD: proformas as single source of truth ──
  const load = async () => {
    setLoading(true);
    const [pp, po, grn, bills, sup, prod] = await Promise.all([
      supabase.from("purchase_proformas").select("*, suppliers(name, company, phone, address)").order("created_at", { ascending: false }),
      supabase.from("purchase_orders").select("id, po_number, status, proforma_id").order("created_at", { ascending: false }),
      supabase.from("goods_received_notes").select("id, grn_number, po_id").order("created_at", { ascending: false }),
      supabase.from("purchase_invoices").select("id, bill_number, grn_id").order("created_at", { ascending: false }),
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
                if (linkedBill) billNum = linkedBill.bill_number;
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

  // ── ITEMS ──
  const addItem = () => setItems([...items, { product_id: "", product_name: "", quantity_requested: 1, rate: 0, amount: 0 }]);
  useEffect(() => { if (createOpen && items.length === 0) addItem(); }, [createOpen]);

  const updateItem = (idx: number, field: string, value: any) => {
    const u = [...items];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.cost_price); }
    }
    u[idx].amount = Number(u[idx].quantity_requested) * Number(u[idx].rate);
    setItems(u);
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
    const { subtotal, gst, total } = calcTotals(items);
    const { data: ppNumber } = await supabase.rpc("generate_document_number", { p_document_type: "purchase_proforma" });
    if (!ppNumber) { toast.error("Failed to generate number"); setSaving(false); return; }
    const { data: pp, error: ppErr } = await supabase.from("purchase_proformas").insert({
      proforma_number: ppNumber, supplier_id: supplierId, date: ppDate,
      validity_days: Number(validityDays), subtotal, gst, total, status: "draft", notes: notes || null,
    }).select().single();
    if (ppErr || !pp) { toast.error("Failed to create order: " + (ppErr?.message || "Unknown error")); setSaving(false); return; }
    await supabase.from("purchase_proforma_items").insert(
      items.map(i => ({ proforma_id: pp.id, product_id: i.product_id || null, quantity_requested: Number(i.quantity_requested), rate: Number(i.rate), amount: i.amount }))
    );
    if (costs.length > 0) {
      await supabase.from("additional_costs").insert(
        costs.map(c => ({ reference_type: "purchase_proforma", reference_id: pp.id, cost_type: c.cost_type, description: c.description, amount: Number(c.amount), vendor_id: c.vendor_id || null }))
      );
    }
    toast.success(`Purchase Order ${ppNumber} created`);
    setCreateOpen(false); setSupplierId(""); setItems([]); setNotes(""); setCosts([]); setSaving(false); load();
  };

  const addCostLine = () => {
    if (!costAmount) return;
    setCosts([...costs, { cost_type: costType, description: costDesc, amount: Number(costAmount), vendor_id: costVendorId }]);
    setCostDesc(""); setCostAmount(""); setCostVendorId("");
  };

  // ── PREVIEW ──
  const openPreview = async (order: PurchaseOrder) => {
    setPreviewOrder(order);
    setEditMode(false);
    const [itemsRes, costsRes] = await Promise.all([
      supabase.from("purchase_proforma_items").select("*, products(name)").eq("proforma_id", order.id),
      supabase.from("additional_costs").select("*").eq("reference_type", "purchase_proforma").eq("reference_id", order.id),
    ]);
    setPreviewItems(itemsRes.data || []);
    setPreviewCosts(costsRes.data || []);
    setPreviewOpen(true);
  };

  // ── WHATSAPP ──
  const shareWhatsApp = (order: PurchaseOrder) => {
    const supName = (order.suppliers as any)?.name || "Supplier";
    const companyName = settings?.company_name || "PharmBooks";
    const text = `*Purchase Order ${order.proforma_number}*\n${companyName}\n\nSupplier: ${supName}\nDate: ${order.date}\n\n${previewItems.map((i: any) => `• ${i.products?.name || "Item"} × ${i.quantity_requested} @ ${Number(i.rate).toLocaleString()}`).join("\n")}\n\n*Total: PKR ${Number(order.total).toLocaleString()}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
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

  // ── CONFIRM ORDER (Create PO) ──
  const handleConfirmOrder = async (order: PurchaseOrder) => {
    setSaving(true);
    const { data: poNumber } = await supabase.rpc("generate_document_number", { p_document_type: "purchase_order" });
    if (!poNumber) { toast.error("Failed to generate PO number"); setSaving(false); return; }
    const { data: po } = await supabase.from("purchase_orders").insert({
      po_number: poNumber, supplier_id: order.supplier_id, date: new Date().toISOString().split("T")[0],
      subtotal: order.subtotal, gst: order.gst, total: order.total, status: "confirmed", proforma_id: order.id,
    }).select().single();
    if (po) {
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
      await supabase.from("purchase_proformas").update({ status: "ordered", converted_po_id: po.id }).eq("id", order.id);
      toast.success(`PO ${poNumber} created`);

      // Auto-download PO PDF
      const { data: poItems } = await supabase.from("purchase_order_items").select("*, products(name)").eq("po_id", po.id);
      const poHtml = generatePdfHtml({
        title: "PURCHASE ORDER", documentNumber: poNumber, date: po.date, statusTheme: "confirmed" as const,
        partyLabel: "Supplier", partyName: (order.suppliers as any)?.name || "—",
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
          { label: "Subtotal", value: `PKR ${Number(po.subtotal).toLocaleString()}` },
          { label: "GST", value: `PKR ${Number(po.gst).toLocaleString()}` },
          { label: "Total", value: `PKR ${Number(po.total).toLocaleString()}` },
        ],
        settings, template: getTemplate("purchase_order"),
      });
      setPdfHtml(poHtml); setPdfTitle(`Purchase Order — ${poNumber}`); setPdfOpen(true);
      setPreviewOpen(false); setSaving(false); load();
    } else { setSaving(false); }
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
    const { data: grnNumber } = await supabase.rpc("generate_document_number", { p_document_type: "goods_received_note" });
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

      for (const item of receiveItems) {
        if (item.product_id) {
          await supabase.from("stock_movements").insert({
            product_id: item.product_id, quantity: Number(item.quantity_received),
            movement_type: "purchase_in", batch_number: item.batch_number || null,
            reference_type: "grn", reference_id: grn.id, date: grn.date, notes: `GRN ${grnNumber}`,
          });
        }
      }

      await supabase.from("purchase_orders").update({ status: "received" }).eq("id", poId);

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
              action: {
                label: "Create Print Job",
                onClick: () => navigate(`/print-jobs?from_grn=1`),
              },
            });
          }
        }
      } catch {
        toast.success(`GRN ${grnNumber} created`);
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
      setReceiveOpen(false); setReceivedBy(""); setReceiveNotes(""); setReceiving(false); setPreviewOpen(false); load();
    } else { setReceiving(false); }
  };

  // ── EDIT ──
  const enterEditMode = () => {
    if (!previewOrder) return;
    setEditSupplierId(previewOrder.supplier_id || "");
    setEditDate(previewOrder.date);
    setEditValidity(String(previewOrder.validity_days));
    setEditNotes(previewOrder.notes || "");
    setEditItems(previewItems.map((i: any) => ({
      product_id: i.product_id || "", product_name: i.products?.name || "Item",
      quantity_requested: i.quantity_requested, rate: Number(i.rate), amount: Number(i.amount),
    })));
    setEditMode(true);
  };

  const updateEditItem = (idx: number, field: string, value: any) => {
    const u = [...editItems];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.cost_price); }
    }
    u[idx].amount = Number(u[idx].quantity_requested) * Number(u[idx].rate);
    setEditItems(u);
  };

  const handleEditSave = async () => {
    if (!previewOrder) return;
    setSaving(true);
    const { subtotal, gst, total } = calcTotals(editItems);
    await supabase.from("purchase_proformas").update({
      supplier_id: editSupplierId || null, date: editDate, validity_days: Number(editValidity),
      notes: editNotes || null, subtotal, gst, total,
    }).eq("id", previewOrder.id);
    await supabase.from("purchase_proforma_items").delete().eq("proforma_id", previewOrder.id);
    if (editItems.length > 0) {
      await supabase.from("purchase_proforma_items").insert(editItems.map(i => ({
        proforma_id: previewOrder.id, product_id: i.product_id || null,
        quantity_requested: Number(i.quantity_requested), rate: Number(i.rate), amount: i.amount,
      })));
    }
    toast.success("Order updated");
    setPreviewOpen(false); setEditMode(false); setSaving(false); load();
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
    if (previewOpen && previewOrder && deleteIds.includes(previewOrder.id)) setPreviewOpen(false);
    load();
  };

  // ── FILTERS ──
  const { subtotal, gst, total } = calcTotals(items);
  const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));
  const productOptions = products.map(p => ({ value: p.id, label: p.name }));

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
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const dateStart = getDateFilter();
    const matchDate = !dateStart || p.date >= dateStart;
    return matchSearch && matchStatus && matchDate;
  });

  const statsByStatus = (status: string) => {
    const list = orders.filter(d => d.status === status);
    return { count: list.length, value: list.reduce((s, d) => s + Number(d.total), 0) };
  };
  const draftStats = statsByStatus("draft");
  const orderedStats = statsByStatus("ordered");
  const confirmedStats = statsByStatus("confirmed");
  const receivedStats = statsByStatus("received");

  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));

  const statusColor = (s: string) => {
    if (s === "received") return "bg-emerald-500/15 text-emerald-600 border-emerald-500/20";
    if (s === "confirmed") return "bg-violet-500/15 text-violet-600 border-violet-500/20";
    if (s === "ordered") return "bg-blue-500/15 text-blue-600 border-blue-500/20";
    if (s === "draft") return "bg-amber-500/15 text-amber-600 border-amber-500/20";
    return "bg-muted text-muted-foreground";
  };
  const statusLabel = (s: string) => ({ draft: "Draft", ordered: "Ordered", confirmed: "Confirmed", received: "Received" }[s] || s);
  const allStats = { count: orders.length, value: orders.reduce((s, d) => s + Number(d.total), 0) };

  return (
    <AppLayout title="Purchase Orders" subtitle="Draft → confirm order → receive with batch + expiry → auto GRN + bill"
      headerActions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:scale-[1.02] transition-all"><Plus className="h-4 w-4" /> New Order</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">Create Purchase Order</DialogTitle></DialogHeader>
            <div className="grid grid-cols-3 gap-3 mt-3">
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
                <div className="col-span-4"><SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateItem(idx, "product_id", v)} placeholder="Product" triggerClassName="text-xs h-9" /></div>
                <div className="col-span-2"><Input type="number" value={item.quantity_requested} onChange={e => updateItem(idx, "quantity_requested", e.target.value)} className="text-xs" placeholder="Qty" /></div>
                <div className="col-span-2"><Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className="text-xs" placeholder="Rate" /></div>
                <div className="col-span-3 text-right text-sm font-mono pt-2 text-foreground">{item.amount.toLocaleString()}</div>
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
            {/* PREMIUM STATUS BUTTONS */}
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: "All", ...allStats, icon: FileText, gradient: "from-slate-500/8 to-slate-600/15", iconBg: "from-slate-500 to-slate-600", accent: "from-slate-400 to-slate-600", textColor: "text-foreground", statusKey: "all" },
                { label: "Draft", ...draftStats, icon: FileEdit, gradient: "from-amber-500/8 to-amber-600/15", iconBg: "from-amber-500 to-amber-600", accent: "from-amber-400 to-amber-600", textColor: "text-amber-600", statusKey: "draft" },
                { label: "Ordered", ...orderedStats, icon: ShoppingCart, gradient: "from-blue-500/8 to-blue-600/15", iconBg: "from-blue-500 to-blue-600", accent: "from-blue-400 to-blue-600", textColor: "text-blue-600", statusKey: "ordered" },
                { label: "Confirmed", ...confirmedStats, icon: BadgeCheck, gradient: "from-violet-500/8 to-violet-600/15", iconBg: "from-violet-500 to-violet-600", accent: "from-violet-400 to-violet-600", textColor: "text-violet-600", statusKey: "confirmed" },
                { label: "Received", ...receivedStats, icon: PackageOpen, gradient: "from-emerald-500/8 to-emerald-600/15", iconBg: "from-emerald-500 to-emerald-600", accent: "from-emerald-400 to-emerald-600", textColor: "text-emerald-600", statusKey: "received" },
              ].map(s => (
                <button key={s.label} onClick={() => setStatusFilter(s.statusKey)}
                  className={`group relative flex flex-col items-center justify-center h-[100px] rounded-2xl bg-gradient-to-br ${s.gradient} border border-border/50 backdrop-blur-sm hover:scale-[1.03] hover:shadow-lg transition-all duration-300 overflow-hidden ${statusFilter === s.statusKey ? "ring-2 ring-offset-2 ring-primary/40 shadow-lg" : ""}`}>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.iconBg} shadow-md flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300`}>
                    <s.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className={`text-lg font-bold font-heading ${s.textColor}`}>{s.count}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{s.label}</span>
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
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-16">
                          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                          <p className="text-muted-foreground font-medium">No purchase orders yet</p>
                          <p className="text-xs text-muted-foreground mt-1">Click "New Order" to start</p>
                        </TableCell></TableRow>
                      ) : filtered.map(order => (
                        <TableRow key={order.id} className="group cursor-pointer hover:bg-muted/30 transition-colors" data-state={selected.has(order.id) ? "selected" : undefined}>
                          <TableCell><Checkbox checked={selected.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} /></TableCell>
                          <TableCell className="font-mono font-semibold text-sm" onClick={() => openPreview(order)}>{order.proforma_number}</TableCell>
                          <TableCell className="text-sm" onClick={() => openPreview(order)}>{(order.suppliers as any)?.name || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground" onClick={() => openPreview(order)}>{order.date}</TableCell>
                          <TableCell onClick={() => openPreview(order)}>
                            <Badge variant="outline" className={`text-[10px] font-semibold ${statusColor(order.status)}`}>{statusLabel(order.status)}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-sm" onClick={() => openPreview(order)}>{Number(order.total).toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {order.status === "draft" && (
                                <Button variant="default" size="sm" onClick={() => handleConfirmOrder(order)} className="h-7 text-xs gap-1 shadow-sm">
                                  <CheckCircle className="h-3 w-3" /> Confirm
                                </Button>
                              )}
                              {(order.status === "ordered" || order.status === "confirmed") && (
                                <Button variant="default" size="sm" onClick={() => openReceiveDialog(order)} className="h-7 text-xs gap-1 shadow-sm">
                                  <PackageCheck className="h-3 w-3" /> Receive
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPreview(order)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {order.status === "draft" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => promptDelete([order.id])}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
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

          {/* ═══ PREMIUM ORDER PREVIEW SHEET ═══ */}
          <Sheet open={previewOpen} onOpenChange={o => { if (!o) { setPreviewOpen(false); setEditMode(false); } }}>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
              {previewOrder && !editMode && (
                <div className="flex flex-col h-full">
                  <div className="bg-gradient-to-r from-foreground to-foreground/90 text-background px-6 py-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-background/60">Purchase Order</p>
                        <p className="text-2xl font-bold font-heading tracking-tight mt-1">{previewOrder.proforma_number}</p>
                      </div>
                      {settings?.logo_url && <img src={settings.logo_url} alt="Logo" className="h-10 w-auto object-contain rounded opacity-90" />}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <Badge variant="outline" className={`text-[10px] border-background/20 ${previewOrder.status === "draft" ? "text-amber-300" : previewOrder.status === "received" ? "text-emerald-300" : "text-background/80"}`}>
                        {statusLabel(previewOrder.status)}
                      </Badge>
                      <span className="text-xs text-background/50">{previewOrder.date}</span>
                      {previewOrder.po_number && <span className="text-xs text-background/50">PO: {previewOrder.po_number}</span>}
                      {previewOrder.grn_number && <span className="text-xs text-background/50">GRN: {previewOrder.grn_number}</span>}
                    </div>
                  </div>

                  <div className="px-6 py-4 border-b border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-2">Supplier</p>
                    <p className="text-sm font-semibold text-foreground">{(previewOrder.suppliers as any)?.name || "—"}</p>
                    {(previewOrder.suppliers as any)?.company && <p className="text-xs text-muted-foreground">{(previewOrder.suppliers as any).company}</p>}
                    {(previewOrder.suppliers as any)?.phone && <p className="text-xs text-muted-foreground mt-0.5">{(previewOrder.suppliers as any).phone}</p>}
                  </div>

                  <div className="px-6 py-4 flex-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-3">Items</p>
                    <div className="space-y-2">
                      {previewItems.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/30 border border-border/50">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{item.products?.name || "Item"}</p>
                            <p className="text-xs text-muted-foreground">{item.quantity_requested} × PKR {Number(item.rate).toLocaleString()}</p>
                          </div>
                          <p className="text-sm font-mono font-semibold text-foreground">PKR {Number(item.amount).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>

                    {previewCosts.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-2">Additional Costs</p>
                        {previewCosts.map((c: any) => (
                          <div key={c.id} className="flex justify-between text-xs py-1.5 px-3 rounded-lg bg-muted/20 mb-1">
                            <span className="capitalize text-muted-foreground">{c.cost_type}: {c.description}</span>
                            <span className="font-mono text-foreground">PKR {Number(c.amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-border space-y-1.5">
                      <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span className="font-mono">PKR {Number(previewOrder.subtotal).toLocaleString()}</span></div>
                      {settings?.gst_enabled && <div className="flex justify-between text-sm text-muted-foreground"><span>GST</span><span className="font-mono">PKR {Number(previewOrder.gst).toLocaleString()}</span></div>}
                      <div className="flex justify-between text-base font-bold text-foreground pt-1 border-t border-border"><span>Total</span><span className="font-mono">PKR {Number(previewOrder.total).toLocaleString()}</span></div>
                    </div>

                    {previewOrder.notes && (
                      <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Notes</p>
                        <p className="text-xs text-muted-foreground">{previewOrder.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur-sm px-6 py-4 space-y-2">
                    {previewOrder.status === "draft" && (
                      <Button onClick={() => handleConfirmOrder(previewOrder)} disabled={saving} className="w-full h-11 gap-2 text-sm font-semibold shadow-md">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Confirm Order — Create PO
                      </Button>
                    )}
                    {(previewOrder.status === "ordered" || previewOrder.status === "confirmed") && (
                      <Button onClick={() => openReceiveDialog(previewOrder)} className="w-full h-11 gap-2 text-sm font-semibold shadow-md">
                        <PackageCheck className="h-4 w-4" /> Mark Received — Create GRN
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => shareWhatsApp(previewOrder)} className="flex-1 gap-2 h-10">
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </Button>
                      <Button variant="outline" onClick={() => printOrder(previewOrder)} className="flex-1 gap-2 h-10">
                        <Download className="h-4 w-4" /> PDF
                      </Button>
                    </div>
                    {previewOrder.status === "draft" && (
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={enterEditMode} className="flex-1 gap-2 h-9 text-xs"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                        <Button variant="ghost" onClick={() => { setCostDialogId(previewOrder.id); setCostDialogOpen(true); }} className="flex-1 gap-2 h-9 text-xs"><DollarSign className="h-3.5 w-3.5" /> Add Cost</Button>
                        <Button variant="ghost" onClick={() => promptDelete([previewOrder.id])} className="flex-1 gap-2 h-9 text-xs text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {previewOrder && editMode && (
                <div className="p-6 space-y-4">
                  <SheetHeader><SheetTitle className="font-heading">Edit Order {previewOrder.proforma_number}</SheetTitle></SheetHeader>
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
                      <div className="col-span-2"><Input type="number" value={item.rate} onChange={e => updateEditItem(idx, "rate", e.target.value)} className="text-xs" placeholder="Rate" /></div>
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
                    <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>

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
    </AppLayout>
  );
}
