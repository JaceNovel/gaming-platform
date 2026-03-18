"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type OrderItem = {
  id: number;
  quantity?: number | null;
  price?: number | null;
  is_physical?: boolean | null;
  delivery_type?: string | null;
  delivery_eta_days?: number | null;
  product?: { name?: string | null; sku?: string | null; shipping_required?: boolean | null } | null;
};

type SupplierAccount = {
  id: number;
  label?: string | null;
  platform?: string | null;
};

type InvoiceRequestData = {
  customerId?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  country?: string | null;
  email?: string | null;
  mobileNo?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  detailAddress?: string | null;
  zip?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  [key: string]: unknown;
};

type InvoiceLastError = {
  step?: string | null;
  message?: string | null;
  at?: string | null;
  context?: Record<string, unknown> | null;
};

type DsOrderCreateState = {
  success?: boolean | null;
  is_success?: boolean | null;
  order_list?: string[] | null;
  error_code?: string | null;
  error_message?: string | null;
  remote_error_message?: string | null;
  created_at?: string | null;
};

type SupplierActionLoadingState =
  | "save-context"
  | "create-order"
  | "sync-order"
  | "resolve-mode"
  | "pack"
  | "ship"
  | "repack"
  | "print-waybill"
  | "invoice-query"
  | "invoice-upload-brazil"
  | "invoice-push"
  | "invoice-download"
  | null;

type OrderSupplierFulfillment = {
  id: number;
  supplier_account_id?: number | null;
  external_order_id?: string | null;
  external_order_lines_json?: unknown[] | null;
  seller_id?: string | null;
  locale?: string | null;
  invoice_customer_id?: string | null;
  invoice_status?: string | null;
  invoice_request_no?: string | null;
  invoice_no?: string | null;
  invoice_date?: string | null;
  invoice_file_type?: string | null;
  invoice_file_name?: string | null;
  invoice_direction?: string | null;
  invoice_file_path?: string | null;
  invoice_document_url?: string | null;
  invoice_requested_at?: string | null;
  invoice_uploaded_at?: string | null;
  invoice_pushed_at?: string | null;
  metadata_json?: {
    invoice_request_data?: InvoiceRequestData | null;
    invoice_last_error?: InvoiceLastError | null;
    ds_order_create?: DsOrderCreateState | null;
    remote_order_sync?: {
      order_status?: string | null;
      order_status_label?: string | null;
      logistics_status?: string | null;
      logistics_status_label?: string | null;
      tracking_number?: string | null;
      shipping_provider_name?: string | null;
      synced_at?: string | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  shipping_mode?: string | null;
  shipping_provider_code?: string | null;
  shipping_provider_name?: string | null;
  carrier_code?: string | null;
  tracking_number?: string | null;
  package_id?: string | null;
  pickup_address_id?: string | null;
  refund_address_id?: string | null;
  asf_status?: string | null;
  asf_sub_status?: string | null;
  latest_document_type?: string | null;
  document_url?: string | null;
  waybill_printed_at?: string | null;
  packed_at?: string | null;
  shipped_at?: string | null;
  repacked_at?: string | null;
  supplier_account?: SupplierAccount | null;
};

type Order = {
  id: number;
  reference?: string | null;
  status?: string | null;
  supplier_platform?: string | null;
  supplier_account_id?: number | null;
  supplier_external_order_id?: string | null;
  supplier_shipping_mode?: string | null;
  supplier_package_id?: string | null;
  supplier_tracking_number?: string | null;
  supplier_shipping_provider_code?: string | null;
  supplier_shipping_provider_name?: string | null;
  supplier_document_url?: string | null;
  supplier_fulfillment_status?: string | null;
  total_price?: number | null;
  refunded_amount?: number | null;
  status_refund?: string | null;
  refunded_at?: string | null;
  created_at?: string | null;
  payment?: { status?: string | null } | null;
  shipping_status?: string | null;
  shipping_eta_days?: number | null;
  shipping_estimated_date?: string | null;
  shipping_document_path?: string | null;
  delivered_at?: string | null;
  shipping_address_line1?: string | null;
  shipping_city?: string | null;
  shipping_country_code?: string | null;
  shipping_phone?: string | null;
  user?: { name?: string | null; email?: string | null; country_code?: string | null } | null;
  supplierAccount?: SupplierAccount | null;
  currentSupplierFulfillment?: OrderSupplierFulfillment | null;
  order_items?: OrderItem[];
  orderItems?: OrderItem[];
  refunds?: RefundRow[];
};

type RefundRow = {
  id: number;
  amount?: number | null;
  reference?: string | null;
  reason?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const formatAmount = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value).toLocaleString()} FCFA`;
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",").pop() ?? "" : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });

const toOutcomeLabel = (raw?: string | null) => {
  const v = String(raw ?? "").toLowerCase();
  if (["paid", "completed", "success", "fulfilled"].includes(v)) return "Complétée";
  if (!v) return "—";
  return "Échec";
};

const generateInvoiceRequestNo = (orderId?: number | null) => `req-ae-${orderId ?? "x"}-${Date.now()}`;

const inferInvoiceFileTypeFromName = (name?: string | null): "pdf" | "png" => {
  const normalized = String(name ?? "").toLowerCase();
  return normalized.endsWith(".png") ? "png" : "pdf";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR");
};

const formatFileSize = (value?: number | null) => {
  if (!value || value <= 0) return "—";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
};

const getInvoiceStatusMeta = (status?: string | null) => {
  switch (status) {
    case "request_ready":
      return {
        label: "Demande récupérée",
        description: "Les informations de facturation côté AliExpress sont chargées et prêtes pour traitement.",
        badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "brazil_xml_uploaded":
      return {
        label: "XML Brésil envoyé",
        description: "Le XML local a été archivé et envoyé à AliExpress pour les flux Brésil.",
        badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
      };
    case "invoice_synced":
      return {
        label: "Facture synchronisée",
        description: "La facture finale a été poussée avec succès et la copie locale est disponible.",
        badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "failed_query":
      return {
        label: "Échec récupération",
        description: "La récupération de la demande a échoué. Une relance peut être faite après correction.",
        badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case "failed_upload":
      return {
        label: "Échec upload XML",
        description: "Le fichier Brésil n’a pas été accepté. Vérifie le XML puis relance l’upload.",
        badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case "failed_push":
      return {
        label: "Échec synchronisation",
        description: "La facture finale n’a pas été poussée. Corrige les métadonnées puis relance l’envoi.",
        badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
      };
    default:
      return {
        label: "Non démarré",
        description: "Le workflow facture n’a pas encore été lancé pour cette commande.",
        badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
      };
  }
};

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = Number(params?.id);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shippingStatus, setShippingStatus] = useState("pending");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [saving, setSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [docLoading, setDocLoading] = useState(false);

  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundConfirm, setRefundConfirm] = useState(false);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundMessage, setRefundMessage] = useState<string | null>(null);
  const [supplierAccounts, setSupplierAccounts] = useState<SupplierAccount[]>([]);
  const [supplierMessage, setSupplierMessage] = useState<string | null>(null);
  const [supplierActionLoading, setSupplierActionLoading] = useState<SupplierActionLoadingState>(null);
  const [dsDraftLoading, setDsDraftLoading] = useState(false);
  const [supplierAccountId, setSupplierAccountId] = useState("");
  const [externalOrderId, setExternalOrderId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [supplierLocale, setSupplierLocale] = useState("fr_FR");
  const [supplierShippingMode, setSupplierShippingMode] = useState("");
  const [shippingProviderCode, setShippingProviderCode] = useState("");
  const [shippingProviderName, setShippingProviderName] = useState("");
  const [carrierCode, setCarrierCode] = useState("");
  const [supplierTrackingNumber, setSupplierTrackingNumber] = useState("");
  const [supplierPackageId, setSupplierPackageId] = useState("");
  const [pickupAddressId, setPickupAddressId] = useState("");
  const [refundAddressId, setRefundAddressId] = useState("");
  const [externalOrderLinesJson, setExternalOrderLinesJson] = useState("[]");
  const [dsExtendRequestJson, setDsExtendRequestJson] = useState("");
  const [dsPlaceOrderJson, setDsPlaceOrderJson] = useState("");
  const [waybillDocumentType, setWaybillDocumentType] = useState("WAY_BILL");
  const [invoiceCustomerId, setInvoiceCustomerId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceRequestNo, setInvoiceRequestNo] = useState("");
  const [invoiceFileType, setInvoiceFileType] = useState<"pdf" | "png">("pdf");
  const [invoiceDirection, setInvoiceDirection] = useState<"BLUE" | "RED">("BLUE");
  const [invoiceDate, setInvoiceDate] = useState(() => String(Date.now()));
  const [invoiceName, setInvoiceName] = useState("invoice.pdf");
  const [invoiceMessage, setInvoiceMessage] = useState<string | null>(null);
  const [invoiceUploadFile, setInvoiceUploadFile] = useState<File | null>(null);
  const [invoiceBrazilFile, setInvoiceBrazilFile] = useState<File | null>(null);

  const loadOrder = useCallback(async () => {
    if (!Number.isFinite(orderId)) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${orderId}`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("Impossible de charger la commande");
      const payload = (await res.json()) as Order;
      setOrder(payload);
      setShippingStatus(payload.shipping_status ?? "pending");
      setPaymentStatus(payload.payment?.status ?? "pending");
    } catch (err) {
      setError("Impossible de charger la commande");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    const loadSupplierAccounts = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/sourcing/supplier-accounts?platform=aliexpress`, {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        });
        if (!res.ok) throw new Error();
        const payload = await res.json();
        setSupplierAccounts(Array.isArray(payload?.data) ? payload.data : []);
      } catch {
        // best effort
      }
    };

    loadSupplierAccounts();
  }, []);

  useEffect(() => {
    const fulfillment = order?.currentSupplierFulfillment;
    setSupplierAccountId(String(fulfillment?.supplier_account_id ?? order?.supplier_account_id ?? ""));
    setExternalOrderId(fulfillment?.external_order_id ?? order?.supplier_external_order_id ?? "");
    setSellerId(fulfillment?.seller_id ?? "");
    setSupplierLocale(fulfillment?.locale ?? "fr_FR");
    setInvoiceCustomerId(fulfillment?.invoice_customer_id ?? "");
    setInvoiceNo(fulfillment?.invoice_no ?? "");
    setInvoiceRequestNo(fulfillment?.invoice_request_no ?? generateInvoiceRequestNo(order?.id));
    setInvoiceFileType((fulfillment?.invoice_file_type as "pdf" | "png") ?? "pdf");
    setInvoiceDirection((fulfillment?.invoice_direction as "BLUE" | "RED") ?? "BLUE");
    setInvoiceDate(fulfillment?.invoice_date ? String(new Date(fulfillment.invoice_date).getTime()) : String(Date.now()));
    setInvoiceName(fulfillment?.invoice_file_name ?? "invoice.pdf");
    setSupplierShippingMode(fulfillment?.shipping_mode ?? order?.supplier_shipping_mode ?? "");
    setShippingProviderCode(fulfillment?.shipping_provider_code ?? order?.supplier_shipping_provider_code ?? "");
    setShippingProviderName(fulfillment?.shipping_provider_name ?? order?.supplier_shipping_provider_name ?? "");
    setCarrierCode(fulfillment?.carrier_code ?? "");
    setSupplierTrackingNumber(fulfillment?.tracking_number ?? order?.supplier_tracking_number ?? "");
    setSupplierPackageId(fulfillment?.package_id ?? order?.supplier_package_id ?? "");
    setPickupAddressId(fulfillment?.pickup_address_id ?? "");
    setRefundAddressId(fulfillment?.refund_address_id ?? "");
    setExternalOrderLinesJson(JSON.stringify(fulfillment?.external_order_lines_json ?? [], null, 2));
  }, [order]);

  const loadDsDraft = useCallback(async (force = false) => {
    if (!order) return;
    if (!force && (dsExtendRequestJson.trim() || dsPlaceOrderJson.trim())) return;

    setDsDraftLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${order.id}/supplier/aliexpress/ds-draft`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Impossible de préparer le draft DS");

      const draft = payload?.data?.draft ?? {};
      setDsExtendRequestJson(JSON.stringify(draft?.ds_extend_request ?? {}, null, 2));
      setDsPlaceOrderJson(JSON.stringify(draft?.param_place_order_request4_open_api_d_t_o ?? {}, null, 2));
      if (force) {
        setSupplierMessage("Draft DS chargé depuis la commande locale.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Impossible de préparer le draft DS");
    } finally {
      setDsDraftLoading(false);
    }
  }, [dsExtendRequestJson, dsPlaceOrderJson, order]);

  useEffect(() => {
    if (!invoiceUploadFile) return;

    const nextType = inferInvoiceFileTypeFromName(invoiceUploadFile.name);
    setInvoiceFileType(nextType);
    setInvoiceName(invoiceUploadFile.name);
  }, [invoiceUploadFile]);

  useEffect(() => {
    if (invoiceUploadFile) return;

    const normalizedNo = invoiceNo.trim() || `order-${order?.id ?? "draft"}`;
    setInvoiceName(`invoice-${normalizedNo}.${invoiceFileType}`);
  }, [invoiceFileType, invoiceNo, invoiceUploadFile, order?.id]);

  const items = useMemo(() => order?.order_items ?? order?.orderItems ?? [], [order]);
  const physicalItems = useMemo(
    () =>
      items.filter(
        (item) => item.is_physical || item.product?.shipping_required,
      ),
    [items],
  );

  useEffect(() => {
    if (!order || physicalItems.length === 0) return;
    if (dsExtendRequestJson.trim() || dsPlaceOrderJson.trim()) return;
    loadDsDraft(false);
  }, [dsExtendRequestJson, dsPlaceOrderJson, loadDsDraft, order, physicalItems.length]);

  const deliveryType = useMemo(() => {
    if (physicalItems.some((item) => item.delivery_type === "preorder")) return "preorder";
    if (physicalItems.length > 0) return "in_stock";
    return null;
  }, [physicalItems]);

  const etaDays = useMemo(() => {
    if (order?.shipping_eta_days) return order.shipping_eta_days;
    return physicalItems.reduce((max, item) => Math.max(max, item.delivery_eta_days ?? 0), 0) || null;
  }, [order?.shipping_eta_days, physicalItems]);

  const handleStatusSave = async () => {
    if (!order) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${order.id}/shipping/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ shipping_status: shippingStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      const payload = await res.json();
      setOrder(payload?.data ?? order);
    } catch {
      setError("Impossible de mettre à jour le statut de livraison");
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentStatusSave = async (nextStatus: "completed" | "failed") => {
    if (!order) return;
    setPaymentSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${order.id}/payment/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      const payload = await res.json();
      const updated = payload?.order ?? order;
      setOrder(updated);
      setPaymentStatus(updated?.payment?.status ?? nextStatus);
    } catch {
      setError("Impossible de mettre à jour le statut de paiement");
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleGenerateDocument = async () => {
    if (!order) return;
    setDocLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${order.id}/shipping/generate-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("Document generation failed");
      await loadOrder();
    } catch {
      setError("Impossible de générer le bon de livraison");
    } finally {
      setDocLoading(false);
    }
  };

  const handleDownloadDocument = async () => {
    if (!order) return;
    setDocLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${order.id}/shipping/document`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `bon-livraison-${order.id}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      setError("Téléchargement impossible");
    } finally {
      setDocLoading(false);
    }
  };

  const paidAmount = useMemo(() => Number(order?.total_price ?? 0), [order?.total_price]);
  const refundedAmount = useMemo(() => Number(order?.refunded_amount ?? 0), [order?.refunded_amount]);
  const remainingRefundable = useMemo(() => {
    const remaining = paidAmount - refundedAmount;
    return remaining > 0 ? remaining : 0;
  }, [paidAmount, refundedAmount]);

  const refunds = useMemo(() => order?.refunds ?? [], [order?.refunds]);

  const fulfillment = useMemo(() => order?.currentSupplierFulfillment ?? null, [order?.currentSupplierFulfillment]);
  const invoiceRequestData = useMemo(
    () => (fulfillment?.metadata_json?.invoice_request_data ?? null) as InvoiceRequestData | null,
    [fulfillment?.metadata_json],
  );
  const invoiceLastError = useMemo(
    () => (fulfillment?.metadata_json?.invoice_last_error ?? null) as InvoiceLastError | null,
    [fulfillment?.metadata_json],
  );
  const invoiceStatusMeta = useMemo(() => getInvoiceStatusMeta(fulfillment?.invoice_status), [fulfillment?.invoice_status]);
  const invoiceWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (!externalOrderId.trim()) warnings.push("Trade Order ID manquant.");
    if (!invoiceCustomerId.trim() && !invoiceRequestData?.customerId) warnings.push("Customer ID facture manquant.");
    if (!supplierAccountId.trim() && !order?.supplier_account_id) warnings.push("Compte AliExpress non sélectionné.");
    if (!invoiceNo.trim() && fulfillment?.invoice_status && fulfillment.invoice_status !== "request_ready") {
      warnings.push("Invoice number absent pour la synchronisation finale.");
    }

    return warnings;
  }, [externalOrderId, fulfillment?.invoice_status, invoiceCustomerId, invoiceNo, invoiceRequestData?.customerId, order?.supplier_account_id, supplierAccountId]);
  const invoiceChecklist = useMemo(
    () => [
      {
        label: "Contexte commande fournisseur",
        done: Boolean(externalOrderId.trim() && (supplierAccountId.trim() || order?.supplier_account_id)),
        hint: "Compte AliExpress et Trade Order ID doivent être renseignés.",
      },
      {
        label: "Demande de facture récupérée",
        done: Boolean(invoiceRequestData || fulfillment?.invoice_requested_at),
        hint: "Charge la demande pour obtenir les informations client/taxe AliExpress.",
      },
      {
        label: "XML Brésil optionnel prêt",
        done: Boolean(fulfillment?.invoice_uploaded_at),
        hint: "À utiliser seulement si le flux fiscal AliExpress l’exige.",
      },
      {
        label: "Facture finale synchronisée",
        done: Boolean(fulfillment?.invoice_pushed_at && fulfillment?.invoice_file_path),
        hint: "Le PDF/PNG final doit être poussé puis archivé.",
      },
    ],
    [externalOrderId, fulfillment?.invoice_file_path, fulfillment?.invoice_pushed_at, fulfillment?.invoice_requested_at, fulfillment?.invoice_uploaded_at, invoiceRequestData, order?.supplier_account_id, supplierAccountId],
  );

  const canRefund = useMemo(() => {
    const status = String(order?.status ?? "").toLowerCase();
    const isPaid = status.includes("success") || status.includes("paid") || status.includes("completed");
    return Boolean(order && isPaid && remainingRefundable > 0);
  }, [order, remainingRefundable]);

  const openRefundModal = () => {
    setRefundType("full");
    setRefundAmount("");
    setRefundReason("");
    setRefundConfirm(false);
    setRefundMessage(null);
    setRefundModalOpen(true);
  };

  const submitRefund = async () => {
    if (!order) return;
    setRefundSubmitting(true);
    setRefundMessage(null);
    try {
      const amountValue = refundType === "partial" ? Number(refundAmount) : undefined;
      const res = await fetch(`${API_BASE}/admin/orders/${order.id}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          type: refundType,
          amount: amountValue,
          reason: refundReason || null,
          confirm: refundConfirm,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = payload?.message ?? payload?.errors?.order?.[0] ?? payload?.errors?.amount?.[0] ?? "Remboursement impossible";
        throw new Error(msg);
      }

      setRefundMessage("Remboursement effectué.");
      setRefundModalOpen(false);
      await loadOrder();
    } catch (e: any) {
      setRefundMessage(e?.message ?? "Remboursement impossible");
    } finally {
      setRefundSubmitting(false);
    }
  };

  const handleSaveSupplierContext = async () => {
    if (!order) return;
    setSupplierActionLoading("save-context");
    setSupplierMessage(null);
    setError("");
    try {
      const externalOrderLines = JSON.parse(externalOrderLinesJson || "[]");
      const res = await fetch(`${API_BASE}/admin/orders/${order.id}/supplier/aliexpress/context`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: supplierAccountId ? Number(supplierAccountId) : undefined,
          external_order_id: externalOrderId || undefined,
          seller_id: sellerId || undefined,
          locale: supplierLocale || undefined,
          invoice_customer_id: invoiceCustomerId || undefined,
          shipping_mode: supplierShippingMode || undefined,
          shipping_provider_code: shippingProviderCode || undefined,
          shipping_provider_name: shippingProviderName || undefined,
          carrier_code: carrierCode || undefined,
          tracking_number: supplierTrackingNumber || undefined,
          package_id: supplierPackageId || undefined,
          pickup_address_id: pickupAddressId || undefined,
          refund_address_id: refundAddressId || undefined,
          external_order_lines: externalOrderLines,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Impossible d’enregistrer le contexte AliExpress");
      setOrder(payload?.order ?? order);
      setSupplierMessage("Contexte AliExpress enregistré.");
    } catch (e: any) {
      setError(e?.message ?? "Impossible d’enregistrer le contexte AliExpress");
    } finally {
      setSupplierActionLoading(null);
    }
  };

  const runSupplierAction = async (action: "sync-order" | "resolve-mode" | "pack" | "ship" | "repack" | "print-waybill") => {
    if (!order) return;
    setSupplierActionLoading(action);
    setSupplierMessage(null);
    setError("");
    try {
      const endpoints: Record<typeof action, string> = {
        "sync-order": "sync-order",
        "resolve-mode": "resolve-mode",
        pack: "pack",
        ship: "ship",
        repack: "repack",
        "print-waybill": "print-waybill",
      };

      const res = await fetch(`${API_BASE}/admin/orders/${order.id}/supplier/aliexpress/${endpoints[action]}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: action === "print-waybill" ? JSON.stringify({ document_type: waybillDocumentType }) : undefined,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? `Action ${action} impossible`);
      setOrder(payload?.order ?? order);
      const labels: Record<typeof action, string> = {
        "sync-order": "Statut Order.get synchronisé.",
        "resolve-mode": "Mode d’expédition AliExpress résolu.",
        pack: "Pack AliExpress exécuté.",
        ship: "Expédition AliExpress déclarée.",
        repack: "Repack AliExpress exécuté.",
        "print-waybill": "Waybill AliExpress généré et persisté.",
      };
      setSupplierMessage(labels[action]);
    } catch (e: any) {
      setError(e?.message ?? `Action ${action} impossible`);
    } finally {
      setSupplierActionLoading(null);
    }
  };

  const handleCreateDsOrder = async () => {
    if (!order) return;
    setSupplierActionLoading("create-order");
    setSupplierMessage(null);
    setError("");

    try {
      const dsExtendRequest = dsExtendRequestJson.trim() ? JSON.parse(dsExtendRequestJson) : {};
      const placeOrderRequest = JSON.parse(dsPlaceOrderJson || "{}");

      const res = await fetch(`${API_BASE}/admin/orders/${order.id}/supplier/aliexpress/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ds_extend_request: dsExtendRequest,
          param_place_order_request4_open_api_d_t_o: placeOrderRequest,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Création commande DS impossible");
      setOrder(payload?.order ?? order);
      setSupplierMessage("Commande DS AliExpress créée et enregistrée.");
    } catch (e: any) {
      setError(e?.message ?? "Création commande DS impossible");
    } finally {
      setSupplierActionLoading(null);
    }
  };

  const runInvoiceAction = async (action: "invoice-query" | "invoice-upload-brazil" | "invoice-push" | "invoice-download") => {
    if (!order) return;
    setSupplierActionLoading(action);
    setInvoiceMessage(null);
    setError("");

    try {
      if (action === "invoice-download") {
        const res = await fetch(`${API_BASE}/admin/orders/${order.id}/supplier/aliexpress/invoice/document`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.message ?? "Téléchargement de la facture impossible");
        }
        const blob = await res.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fulfillment?.invoice_file_name || invoiceName || `invoice-${order.id}.${invoiceFileType}`;
        link.click();
        URL.revokeObjectURL(link.href);
        setInvoiceMessage("Facture téléchargée.");
        return;
      }

      let body: Record<string, unknown> = {};
      let endpoint = "";

      if (action === "invoice-query") {
        endpoint = "query-request";
        body = {
          customer_id: invoiceCustomerId || undefined,
        };
      }

      if (action === "invoice-upload-brazil") {
        if (!invoiceBrazilFile) {
          throw new Error("Sélectionne d’abord un fichier XML Brésil.");
        }
        if (!invoiceBrazilFile.name.toLowerCase().endsWith(".xml")) {
          throw new Error("Le fichier Brésil doit être un XML.");
        }
        if (invoiceBrazilFile.size > 3 * 1024 * 1024) {
          throw new Error("Le XML Brésil dépasse 3 Mo.");
        }

        endpoint = "upload-brazil";
        body = {
          file_name: invoiceBrazilFile.name,
          file_content_base64: await fileToBase64(invoiceBrazilFile),
          source: "ISV",
        };
      }

      if (action === "invoice-push") {
        if (!invoiceUploadFile) {
          throw new Error("Sélectionne d’abord le fichier de facture à pousser.");
        }
        if (invoiceUploadFile.size > 8 * 1024 * 1024) {
          throw new Error("Le fichier final dépasse 8 Mo.");
        }

        const nextFileType = inferInvoiceFileTypeFromName(invoiceUploadFile.name);
        const effectiveRequestNo = invoiceRequestNo.trim() || generateInvoiceRequestNo(order.id);
        const effectiveInvoiceName = invoiceName.trim() || invoiceUploadFile.name;
        const effectiveInvoiceDate = Number(invoiceDate || Date.now());

        setInvoiceRequestNo(effectiveRequestNo);
        setInvoiceFileType(nextFileType);
        setInvoiceName(effectiveInvoiceName);
        setInvoiceDate(String(effectiveInvoiceDate));

        endpoint = "push-result";
        body = {
          customer_id: invoiceCustomerId || undefined,
          invoice_no: invoiceNo,
          request_no: effectiveRequestNo,
          invoice_date: effectiveInvoiceDate,
          invoice_file_type: nextFileType,
          invoice_direction: invoiceDirection,
          invoice_name: effectiveInvoiceName,
          invoice_content_base64: await fileToBase64(invoiceUploadFile),
        };
      }

      const res = await fetch(`${API_BASE}/admin/orders/${order.id}/supplier/aliexpress/invoice/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Action de facturation AliExpress impossible");
      setOrder(payload?.order ?? order);
      if (action === "invoice-query") {
        const resolvedCustomerId = payload?.data?.invoice_request?.customerId ?? payload?.order?.currentSupplierFulfillment?.invoice_customer_id;
        if (resolvedCustomerId) {
          setInvoiceCustomerId(String(resolvedCustomerId));
        }
      }
      setInvoiceMessage(
        action === "invoice-query"
          ? "Demande de facture AliExpress synchronisée."
          : action === "invoice-upload-brazil"
            ? "Facture Brésil uploadée."
            : "Résultat de facturation poussé à AliExpress."
      );
    } catch (e: any) {
      setError(e?.message ?? "Action de facturation AliExpress impossible");
    } finally {
      setSupplierActionLoading(null);
    }
  };

  return (
    <AdminShell title="Détail commande" subtitle={`Commande #${orderId}`}>
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading || !order ? (
          <div className="text-sm text-slate-500">Chargement...</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div><span className="text-slate-400">Référence:</span> {order.reference ?? "—"}</div>
              <div><span className="text-slate-400">Statut:</span> {toOutcomeLabel(order.status)}</div>
              <div><span className="text-slate-400">Paiement:</span> {order.payment?.status ?? "—"}</div>
              <div><span className="text-slate-400">Montant:</span> {formatAmount(order.total_price)}</div>
              <div><span className="text-slate-400">Créée:</span> {order.created_at ?? "—"}</div>
            </div>
            <div className="space-y-2 text-sm">
              <div><span className="text-slate-400">Client:</span> {order.user?.name ?? "—"}</div>
              <div><span className="text-slate-400">Email:</span> {order.user?.email ?? "—"}</div>
              <div><span className="text-slate-400">Téléphone:</span> {order.shipping_phone ?? "—"}</div>
              <div><span className="text-slate-400">Pays:</span> {order.shipping_country_code ?? order.user?.country_code ?? "—"}</div>
              <div><span className="text-slate-400">Ville:</span> {order.shipping_city ?? "—"}</div>
              <div><span className="text-slate-400">Adresse:</span> {order.shipping_address_line1 ?? "—"}</div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-slate-700">Paiement</div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-slate-600">Statut actuel: {paymentStatus}</div>
          <button
            onClick={() => handlePaymentStatusSave("completed")}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs text-white"
            disabled={paymentSaving}
          >
            {paymentSaving ? "Enregistrement..." : "Marquer payé"}
          </button>
          <button
            onClick={() => handlePaymentStatusSave("failed")}
            className="rounded-xl bg-rose-600 px-3 py-2 text-xs text-white"
            disabled={paymentSaving}
          >
            {paymentSaving ? "Enregistrement..." : "Marquer échec"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-700">Remboursement</div>
          <button
            type="button"
            onClick={openRefundModal}
            disabled={!canRefund}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50"
          >
            Rembourser
          </button>
        </div>

        <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-3">
          <div>
            <div className="text-slate-400">Payé</div>
            <div className="font-semibold">{formatAmount(paidAmount)}</div>
          </div>
          <div>
            <div className="text-slate-400">Déjà remboursé</div>
            <div className="font-semibold">{formatAmount(refundedAmount)}</div>
          </div>
          <div>
            <div className="text-slate-400">Reste remboursable</div>
            <div className="font-semibold">{formatAmount(remainingRefundable)}</div>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500">
          Statut: {order?.status_refund ?? "none"}{order?.refunded_at ? ` • Full le ${order.refunded_at}` : ""}
        </div>

        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Historique</div>
          {refunds.length === 0 ? (
            <div className="text-sm text-slate-500">Aucun remboursement.</div>
          ) : (
            <div className="space-y-2">
              {refunds.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{formatAmount(Number(r.amount ?? 0))}</div>
                    <div className="text-xs text-slate-500">{r.created_at ?? "—"}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    <span className="text-slate-400">Ref:</span> {r.reference ?? "—"} • <span className="text-slate-400">Statut:</span> {r.status ?? "—"}
                  </div>
                  {r.reason ? <div className="mt-1 text-xs text-slate-600">{r.reason}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-slate-700">Livraison</div>
        {physicalItems.length === 0 ? (
          <div className="text-sm text-slate-500">Aucun article physique.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div><span className="text-slate-400">Type:</span> {deliveryType ?? "—"}</div>
              <div><span className="text-slate-400">ETA:</span> {etaDays ? `${etaDays} jours` : "—"}</div>
              <div><span className="text-slate-400">Date estimée:</span> {order?.shipping_estimated_date ?? "—"}</div>
              <div><span className="text-slate-400">Statut:</span> {order?.shipping_status ?? "pending"}</div>
              {order?.delivered_at && (
                <div><span className="text-slate-400">Livré le:</span> {order.delivered_at}</div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <select
                  value={shippingStatus}
                  onChange={(e) => setShippingStatus(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="pending">pending</option>
                  <option value="ready_for_pickup">ready_for_pickup</option>
                  <option value="out_for_delivery">out_for_delivery</option>
                  <option value="delivered">delivered</option>
                  <option value="canceled">canceled</option>
                </select>
                <button
                  onClick={handleStatusSave}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white"
                  disabled={saving}
                >
                  {saving ? "Enregistrement..." : "Sauvegarder"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {order?.shipping_document_path ? (
                  <button
                    onClick={handleDownloadDocument}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    disabled={docLoading}
                  >
                    Télécharger bon de livraison
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateDocument}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    disabled={docLoading}
                  >
                    Générer bon de livraison
                  </button>
                )}
                <button
                  onClick={() => window.history.back()}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  Retour
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {physicalItems.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-700">Fulfillment AliExpress</div>
              <div className="text-xs text-slate-500">Contexte fournisseur, résolution automatique du mode d’expédition, puis actions Pack / Ship / Repack / Print waybill.</div>
            </div>
            <div className="text-xs text-slate-500">Statut fournisseur: {order?.supplier_fulfillment_status ?? "—"}</div>
          </div>

          {supplierMessage ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {supplierMessage}
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Compte AliExpress</span>
              <select value={supplierAccountId} onChange={(e) => setSupplierAccountId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
                <option value="">Sélectionner</option>
                {supplierAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.label ?? `Compte #${account.id}`}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Trade Order ID</span>
              <input value={externalOrderId} onChange={(e) => setExternalOrderId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Seller ID</span>
              <input value={sellerId} onChange={(e) => setSellerId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Locale</span>
              <input value={supplierLocale} onChange={(e) => setSupplierLocale(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Customer ID facture</span>
              <input value={invoiceCustomerId} onChange={(e) => setInvoiceCustomerId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Mode d’expédition</span>
              <select value={supplierShippingMode} onChange={(e) => setSupplierShippingMode(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
                <option value="">Auto</option>
                <option value="dbs">dbs</option>
                <option value="platform_logistics">platform_logistics</option>
                <option value="local2local">local2local</option>
                <option value="local2local_self_pickup">local2local_self_pickup</option>
                <option value="local2local_offline">local2local_offline</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Shipping provider code</span>
              <input value={shippingProviderCode} onChange={(e) => setShippingProviderCode(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Shipping provider name</span>
              <input value={shippingProviderName} onChange={(e) => setShippingProviderName(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Carrier code</span>
              <input value={carrierCode} onChange={(e) => setCarrierCode(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Tracking number</span>
              <input value={supplierTrackingNumber} onChange={(e) => setSupplierTrackingNumber(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Package ID</span>
              <input value={supplierPackageId} onChange={(e) => setSupplierPackageId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Pickup address ID</span>
              <input value={pickupAddressId} onChange={(e) => setPickupAddressId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Refund address ID</span>
              <input value={refundAddressId} onChange={(e) => setRefundAddressId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
          </div>

          <label className="mt-3 grid gap-1 text-sm">
            <span className="text-slate-600">Lignes de commande AliExpress JSON</span>
            <textarea value={externalOrderLinesJson} onChange={(e) => setExternalOrderLinesJson(e.target.value)} rows={8} className="rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" />
          </label>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">Création commande DS</div>
                <div className="text-xs text-slate-500">Le draft utilise uniquement l’adresse hub France fournisseur. Vérifie surtout `logistics_service_name` avant exécution.</div>
              </div>
              <button onClick={() => loadDsDraft(true)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" disabled={dsDraftLoading || supplierActionLoading !== null}>
                {dsDraftLoading ? "Préparation..." : "Régénérer le draft DS"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">ds_extend_request JSON</span>
                <textarea value={dsExtendRequestJson} onChange={(e) => setDsExtendRequestJson(e.target.value)} rows={12} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">param_place_order_request4_open_api_d_t_o JSON</span>
                <textarea value={dsPlaceOrderJson} onChange={(e) => setDsPlaceOrderJson(e.target.value)} rows={12} className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs" />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={handleCreateDsOrder} className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white" disabled={supplierActionLoading !== null || dsDraftLoading}>
                {supplierActionLoading === "create-order" ? "Création..." : "Créer la commande DS"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={handleSaveSupplierContext} className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white" disabled={supplierActionLoading !== null}>
              {supplierActionLoading === "save-context" ? "Enregistrement..." : "Sauvegarder le contexte"}
            </button>
            <button onClick={() => runSupplierAction("sync-order")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" disabled={supplierActionLoading !== null}>
              {supplierActionLoading === "sync-order" ? "Sync..." : "Sync Order.get"}
            </button>
            <button onClick={() => runSupplierAction("resolve-mode")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" disabled={supplierActionLoading !== null}>
              {supplierActionLoading === "resolve-mode" ? "Résolution..." : "Déterminer le mode"}
            </button>
            <button onClick={() => runSupplierAction("pack")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" disabled={supplierActionLoading !== null}>
              {supplierActionLoading === "pack" ? "Pack..." : "Pack"}
            </button>
            <button onClick={() => runSupplierAction("ship")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" disabled={supplierActionLoading !== null}>
              {supplierActionLoading === "ship" ? "Ship..." : "Ship"}
            </button>
            <button onClick={() => runSupplierAction("repack")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" disabled={supplierActionLoading !== null}>
              {supplierActionLoading === "repack" ? "Repack..." : "Repack"}
            </button>
            <select value={waybillDocumentType} onChange={(e) => setWaybillDocumentType(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
              <option value="WAY_BILL">WAY_BILL</option>
              <option value="PICKING_ORDER">PICKING_ORDER</option>
              <option value="HANDOVER">HANDOVER</option>
              <option value="PICKING_ORDER_AND_WAY_BILL">PICKING_ORDER_AND_WAY_BILL</option>
            </select>
            <button onClick={() => runSupplierAction("print-waybill")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" disabled={supplierActionLoading !== null}>
              {supplierActionLoading === "print-waybill" ? "Génération..." : "Print waybill"}
            </button>
          </div>

          <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 md:grid-cols-2">
            <div>Mode courant: {order?.currentSupplierFulfillment?.shipping_mode ?? order?.supplier_shipping_mode ?? "—"}</div>
            <div>ASF status: {order?.currentSupplierFulfillment?.asf_status ?? "—"}</div>
            <div>Provider: {order?.currentSupplierFulfillment?.shipping_provider_name ?? order?.supplier_shipping_provider_name ?? "—"}</div>
            <div>Tracking: {order?.currentSupplierFulfillment?.tracking_number ?? order?.supplier_tracking_number ?? "—"}</div>
            <div>Package ID: {order?.currentSupplierFulfillment?.package_id ?? order?.supplier_package_id ?? "—"}</div>
            <div>Document URL: {order?.currentSupplierFulfillment?.document_url ?? order?.supplier_document_url ?? "—"}</div>
            <div>DS create: {order?.currentSupplierFulfillment?.metadata_json?.ds_order_create?.success ? `Succès (${order?.currentSupplierFulfillment?.metadata_json?.ds_order_create?.order_list?.join(", ") ?? "—"})` : order?.currentSupplierFulfillment?.metadata_json?.ds_order_create?.error_message ?? "—"}</div>
            <div>DS error code: {order?.currentSupplierFulfillment?.metadata_json?.ds_order_create?.error_code ?? "—"}</div>
            <div>Order.get status: {order?.currentSupplierFulfillment?.metadata_json?.remote_order_sync?.order_status_label ?? order?.currentSupplierFulfillment?.metadata_json?.remote_order_sync?.order_status ?? "—"}</div>
            <div>Logistics status: {order?.currentSupplierFulfillment?.metadata_json?.remote_order_sync?.logistics_status_label ?? order?.currentSupplierFulfillment?.metadata_json?.remote_order_sync?.logistics_status ?? "—"}</div>
            <div>Dernière création DS: {formatDateTime(order?.currentSupplierFulfillment?.metadata_json?.ds_order_create?.created_at)}</div>
            <div>Dernière synchro Order.get: {formatDateTime(order?.currentSupplierFulfillment?.metadata_json?.remote_order_sync?.synced_at as string | null | undefined)}</div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">Facturation AliExpress</div>
                <div className="text-xs text-slate-500">Workflow guidé: récupération de la demande, contrôles, upload XML Brésil si nécessaire, puis synchronisation finale.</div>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs font-medium ${invoiceStatusMeta.badgeClassName}`}>{invoiceStatusMeta.label}</div>
            </div>

            <div className="mb-4 rounded-2xl bg-slate-900 px-4 py-4 text-white">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Pilotage facture</div>
                  <div className="mt-2 text-lg font-semibold">{invoiceStatusMeta.description}</div>
                </div>
                <div className="grid gap-2 text-right text-xs text-slate-300">
                  <div>Dernière demande: {formatDateTime(fulfillment?.invoice_requested_at)}</div>
                  <div>Dernier upload XML: {formatDateTime(fulfillment?.invoice_uploaded_at)}</div>
                  <div>Dernière synchro finale: {formatDateTime(fulfillment?.invoice_pushed_at)}</div>
                </div>
              </div>
            </div>

            {invoiceMessage ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {invoiceMessage}
              </div>
            ) : null}

            {invoiceLastError?.message ? (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <div className="font-medium">Dernier blocage: {invoiceLastError.message}</div>
                <div className="mt-1 text-xs text-rose-600">Étape: {invoiceLastError.step ?? "—"} • {formatDateTime(invoiceLastError.at)}</div>
              </div>
            ) : null}

            {invoiceWarnings.length > 0 ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="font-medium">Contrôles avant exécution</div>
                <div className="mt-2 grid gap-1 text-xs text-amber-700">
                  {invoiceWarnings.map((warning) => (
                    <div key={warning}>• {warning}</div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mb-4 grid gap-3 lg:grid-cols-4">
              {invoiceChecklist.map((item) => (
                <div key={item.label} className={`rounded-xl border px-3 py-3 ${item.done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                  <div className={`text-xs font-semibold uppercase tracking-wide ${item.done ? "text-emerald-700" : "text-slate-500"}`}>{item.done ? "OK" : "À faire"}</div>
                  <div className="mt-2 text-sm font-medium text-slate-900">{item.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.hint}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Invoice number</span>
                <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Request number</span>
                <input value={invoiceRequestNo} onChange={(e) => setInvoiceRequestNo(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
                <span className="text-[11px] text-slate-400">Généré automatiquement si laissé vide au moment de l’envoi.</span>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Invoice date (timestamp ms)</span>
                <input value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
                <span className="text-[11px] text-slate-400">Prérempli automatiquement avec la date courante si nécessaire.</span>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Invoice name</span>
                <input value={invoiceName} onChange={(e) => setInvoiceName(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
                <span className="text-[11px] text-slate-400">Synchronisé automatiquement avec le fichier final quand tu le sélectionnes.</span>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">File type</span>
                <select value={invoiceFileType} onChange={(e) => setInvoiceFileType(e.target.value as "pdf" | "png")} className="rounded-xl border border-slate-200 px-3 py-2">
                  <option value="pdf">pdf</option>
                  <option value="png">png</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Direction</span>
                <select value={invoiceDirection} onChange={(e) => setInvoiceDirection(e.target.value as "BLUE" | "RED")} className="rounded-xl border border-slate-200 px-3 py-2">
                  <option value="BLUE">BLUE</option>
                  <option value="RED">RED</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm lg:col-span-2">
                <span className="text-slate-600">Fichier facture finale (PDF ou PNG)</span>
                <input type="file" accept=".pdf,.png" onChange={(e) => setInvoiceUploadFile(e.target.files?.[0] ?? null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                <span className="text-[11px] text-slate-400">Taille max 8 Mo. Le type est détecté automatiquement depuis l’extension.</span>
              </label>
              <label className="grid gap-1 text-sm lg:col-span-2">
                <span className="text-slate-600">Fichier XML Brésil</span>
                <input type="file" accept=".xml,text/xml,application/xml" onChange={(e) => setInvoiceBrazilFile(e.target.files?.[0] ?? null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                <span className="text-[11px] text-slate-400">Taille max 3 Mo. Utiliser uniquement pour les obligations fiscales Brésil.</span>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => runInvoiceAction("invoice-query")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" disabled={supplierActionLoading !== null}>
                {supplierActionLoading === "invoice-query" ? "Chargement..." : fulfillment?.invoice_status === "failed_query" ? "Relancer la demande" : "Charger la demande de facture"}
              </button>
              <button onClick={() => runInvoiceAction("invoice-upload-brazil")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" disabled={supplierActionLoading !== null}>
                {supplierActionLoading === "invoice-upload-brazil" ? "Upload..." : fulfillment?.invoice_status === "failed_upload" ? "Relancer l’upload XML" : "Uploader XML Brésil"}
              </button>
              <button onClick={() => runInvoiceAction("invoice-push")} className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white" disabled={supplierActionLoading !== null}>
                {supplierActionLoading === "invoice-push" ? "Envoi..." : fulfillment?.invoice_status === "failed_push" ? "Relancer la synchronisation" : "Pousser le résultat de facture"}
              </button>
              <button onClick={() => runInvoiceAction("invoice-download")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" disabled={supplierActionLoading !== null}>
                {supplierActionLoading === "invoice-download" ? "Téléchargement..." : "Télécharger la facture stockée"}
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demande client AliExpress</div>
                {!invoiceRequestData ? (
                  <div className="mt-3 text-sm text-slate-500">Aucune donnée client chargée pour l’instant.</div>
                ) : (
                  <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                    <div><span className="text-slate-400">Customer ID:</span> {invoiceRequestData.customerId ?? fulfillment?.invoice_customer_id ?? "—"}</div>
                    <div><span className="text-slate-400">Société / nom:</span> {invoiceRequestData.companyName ?? invoiceRequestData.fullName ?? "—"}</div>
                    <div><span className="text-slate-400">Email:</span> {invoiceRequestData.email ?? "—"}</div>
                    <div><span className="text-slate-400">Téléphone:</span> {invoiceRequestData.mobileNo ?? "—"}</div>
                    <div><span className="text-slate-400">Pays:</span> {invoiceRequestData.country ?? "—"}</div>
                    <div><span className="text-slate-400">Ville:</span> {invoiceRequestData.city ?? "—"}</div>
                    <div className="md:col-span-2"><span className="text-slate-400">Adresse:</span> {[invoiceRequestData.detailAddress, invoiceRequestData.district, invoiceRequestData.province, invoiceRequestData.zip].filter(Boolean).join(", ") || "—"}</div>
                    <div><span className="text-slate-400">Tax number:</span> {invoiceRequestData.taxNumber ?? "—"}</div>
                    <div><span className="text-slate-400">Tax office:</span> {invoiceRequestData.taxOffice ?? "—"}</div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Résumé opératoire</div>
                <div className="mt-3 grid gap-2 text-xs text-slate-600">
                  <div>Customer ID: {fulfillment?.invoice_customer_id ?? "—"}</div>
                  <div>Invoice no: {fulfillment?.invoice_no ?? "—"}</div>
                  <div>Request no: {fulfillment?.invoice_request_no ?? "—"}</div>
                  <div>Type: {fulfillment?.invoice_file_type ?? "—"}</div>
                  <div>Direction: {fulfillment?.invoice_direction ?? "—"}</div>
                  <div>Date facture: {formatDateTime(fulfillment?.invoice_date ?? null)}</div>
                  <div>Fichier archivé: {fulfillment?.invoice_file_name ?? "—"}</div>
                  <div>Poids fichier courant: {formatFileSize(invoiceUploadFile?.size ?? invoiceBrazilFile?.size ?? null)}</div>
                  <div>Chemin local: {fulfillment?.invoice_file_path ?? "—"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {refundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRefundModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remboursement</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">Créditer le wallet</div>
                <div className="mt-1 text-sm text-slate-600">
                  Aucun remboursement FedaPay/CinetPay: crédit interne uniquement.
                </div>
              </div>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700"
                onClick={() => setRefundModalOpen(false)}
              >
                Fermer
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-sm text-slate-700">
                Type
                <select
                  value={refundType}
                  onChange={(e) => setRefundType(e.target.value as "full" | "partial")}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option value="full">Total (reste: {formatAmount(remainingRefundable)})</option>
                  <option value="partial">Partiel</option>
                </select>
              </label>

              {refundType === "partial" && (
                <label className="block text-sm text-slate-700">
                  Montant (FCFA)
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    placeholder="1000"
                  />
                  <div className="mt-1 text-xs text-slate-500">Max: {formatAmount(remainingRefundable)}</div>
                </label>
              )}

              <label className="block text-sm text-slate-700">
                Raison (optionnel)
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="Ex: commande annulée"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={refundConfirm}
                  onChange={(e) => setRefundConfirm(e.target.checked)}
                />
                Je confirme le crédit wallet
              </label>

              {refundMessage ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {refundMessage}
                </div>
              ) : null}

              <button
                type="button"
                disabled={refundSubmitting || !refundConfirm}
                onClick={() => void submitRefund()}
                className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {refundSubmitting ? "Traitement..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-semibold text-slate-700">Articles physiques</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-2 pr-4">Produit</th>
                <th className="pb-2 pr-4">SKU</th>
                <th className="pb-2 pr-4">Quantité</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">ETA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {physicalItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    Aucun article physique.
                  </td>
                </tr>
              )}
              {physicalItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-4">{item.product?.name ?? "—"}</td>
                  <td className="py-2 pr-4">{item.product?.sku ?? "—"}</td>
                  <td className="py-2 pr-4">{item.quantity ?? 1}</td>
                  <td className="py-2 pr-4">{item.delivery_type ?? "—"}</td>
                  <td className="py-2 pr-4">{item.delivery_eta_days ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
