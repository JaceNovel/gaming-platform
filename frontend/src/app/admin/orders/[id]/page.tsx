"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

type Order = {
  id: number;
  reference?: string | null;
  status?: string | null;
  total_price?: number | null;
  created_at?: string | null;
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

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params?.id);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shippingStatus, setShippingStatus] = useState("pending");
  const [saving, setSaving] = useState(false);
  const [docLoading, setDocLoading] = useState(false);

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
              <div><span className="text-slate-400">Statut:</span> {order.status ?? "—"}</div>
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
                  onClick={() => router.back()}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  Retour
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
