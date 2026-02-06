"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type OrderItem = {
  id: number;
  quantity?: number | null;
  price?: number | null;
  game_user_id?: unknown;
  is_physical?: boolean | null;
  delivery_type?: string | null;
  delivery_eta_days?: number | null;
  product?: { name?: string | null; sku?: string | null; shipping_required?: boolean | null } | null;
};

type Order = {
  id: number;
  reference?: string | null;
  status?: string | null;
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

const toOutcomeLabel = (raw?: string | null) => {
  const v = String(raw ?? "").toLowerCase();
  if (["paid", "completed", "success", "fulfilled"].includes(v)) return "Complétée";
  if (!v) return "—";
  return "Échec";
};

const formatGameUserId = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((v) => String(v ?? "").trim()).filter(Boolean).join(", ");
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
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

  const items = useMemo(() => order?.order_items ?? order?.orderItems ?? [], [order]);

  const firstGameUserId = useMemo(() => {
    for (const it of items) {
      const formatted = formatGameUserId((it as any)?.game_user_id);
      if (formatted) return formatted;
    }
    return "";
  }, [items]);
  const physicalItems = useMemo(
    () =>
      items.filter(
        (item) => item.is_physical || item.product?.shipping_required,
      ),
    [items],
  );

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
              {firstGameUserId ? (
                <div><span className="text-slate-400">ID joueur:</span> {firstGameUserId}</div>
              ) : null}
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
        <div className="mb-3 text-sm font-semibold text-slate-700">Articles</div>
        {loading || !order ? (
          <div className="text-sm text-slate-500">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-slate-500">Aucun article.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-2 pr-4">Produit</th>
                  <th className="pb-2 pr-4">Quantité</th>
                  <th className="pb-2 pr-4">ID joueur</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="py-2 pr-4">{it.product?.name ?? "—"}</td>
                    <td className="py-2 pr-4">{it.quantity ?? 1}</td>
                    <td className="py-2 pr-4">{formatGameUserId((it as any)?.game_user_id) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {refundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRefundModalOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remboursement</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">Créditer le wallet</div>
                <div className="mt-1 text-sm text-slate-600">
                  Aucun remboursement Mobile Money/CinetPay: crédit interne uniquement.
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
