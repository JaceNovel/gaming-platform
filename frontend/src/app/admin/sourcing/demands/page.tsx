"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Demand = {
  id: number;
  status?: string | null;
  trigger_reason?: string | null;
  quantity_requested?: number | null;
  quantity_allocated_from_stock?: number | null;
  quantity_to_procure?: number | null;
  needed_by_date?: string | null;
  required_moq?: number | null;
  pending_quantity_for_moq?: number | null;
  missing_to_moq?: number | null;
  grouping_threshold?: number | null;
  grouping_ready?: boolean | null;
  order?: {
    id: number;
    reference?: string | null;
    supplier_fulfillment_status?: string | null;
    grouping_released_at?: string | null;
    user?: { name?: string | null; email?: string | null } | null;
  } | null;
  product?: { id: number; name?: string | null; title?: string | null; stock?: number | null; grouping_threshold?: number | null } | null;
  supplier_product_sku?: { external_sku_id?: string | null; sku_label?: string | null; moq?: number | null; supplier_product?: { title?: string | null; supplier_account?: { label?: string | null } | null } | null } | null;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminSourcingDemandsPage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") === "aliexpress" ? "aliexpress" : "alibaba";
  const platformLabel = platform === "aliexpress" ? "AliExpress" : "Alibaba";
  const [demands, setDemands] = useState<Demand[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDemands = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/demands?platform=${platform}`, { headers: { Accept: "application/json", ...getAuthHeaders() } });
      if (!res.ok) throw new Error(`Impossible de charger les demandes ${platformLabel}`);
      const payload = await res.json();
      setDemands(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setError(`Impossible de charger les demandes ${platformLabel}`);
    } finally {
      setLoading(false);
    }
  }, [platform, platformLabel]);

  useEffect(() => {
    loadDemands();
  }, [loadDemands]);

  const pendingDemands = useMemo(() => demands.filter((item) => item.status === "pending"), [demands]);

  const toggle = (id: number) => {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const createDraftBatch = async () => {
    if (!selected.length) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/batches/draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ demand_ids: selected }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Création du lot impossible");
      }
      setSuccess("Lot d’achat brouillon créé.");
      setSelected([]);
      await loadDemands();
    } catch (err: any) {
      setError(err?.message ?? "Création du lot impossible");
    }
  };

  return (
    <AdminShell title={platformLabel} subtitle="Demandes d’approvisionnement générées automatiquement après paiement">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">{loading ? "Chargement..." : `${pendingDemands.length} demande(s) en attente`}</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={loadDemands} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Rafraîchir</button>
            <button type="button" onClick={createDraftBatch} disabled={!selected.length} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Créer un lot brouillon
            </button>
          </div>
        </div>
        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        {success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-3 pr-4"></th>
                <th className="pb-3 pr-4">Commande</th>
                <th className="pb-3 pr-4">Produit</th>
                <th className="pb-3 pr-4">Source</th>
                <th className="pb-3 pr-4">Quantités</th>
                <th className="pb-3 pr-4">Seuils</th>
                <th className="pb-3 pr-4">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && demands.length === 0 ? <tr><td colSpan={7} className="py-4 text-slate-500">Aucune demande.</td></tr> : null}
              {demands.map((demand) => {
                const canSelect = demand.status === "pending";
                return (
                  <tr key={demand.id}>
                    <td className="py-3 pr-4 align-top">
                      <input type="checkbox" checked={selected.includes(demand.id)} disabled={!canSelect} onChange={() => toggle(demand.id)} className="h-4 w-4 rounded border-slate-300" />
                    </td>
                    <td className="py-3 pr-4 align-top">
                      <div className="font-medium text-slate-900">#{demand.order?.id ?? "—"}</div>
                      <div className="text-xs text-slate-500">{demand.order?.reference || "—"}</div>
                      <div className="text-xs text-slate-500">{demand.order?.user?.email || demand.order?.user?.name || "—"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>{demand.product?.title || demand.product?.name || "Produit"}</div>
                      <div>stock local {demand.product?.stock ?? 0}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>{demand.supplier_product_sku?.supplier_product?.supplier_account?.label || "Non mappé"}</div>
                      <div>{demand.supplier_product_sku?.supplier_product?.title || demand.supplier_product_sku?.sku_label || demand.supplier_product_sku?.external_sku_id || "—"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>Demandé: {demand.quantity_requested ?? 0}</div>
                      <div>Stock: {demand.quantity_allocated_from_stock ?? 0}</div>
                      <div>À acheter: {demand.quantity_to_procure ?? 0}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>MOQ fournisseur: {demand.pending_quantity_for_moq ?? 0}/{demand.required_moq ?? demand.supplier_product_sku?.moq ?? 1}</div>
                      <div>Seuil groupé: {demand.grouping_ready ? "prêt" : `attente ${demand.grouping_threshold ?? demand.product?.grouping_threshold ?? 1}`}</div>
                      <div>{(demand.missing_to_moq ?? 0) > 0 ? `MOQ manquant: ${demand.missing_to_moq}` : "MOQ atteint"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>{demand.status || "—"}</div>
                      <div>{demand.trigger_reason || "—"}</div>
                      <div>{demand.order?.supplier_fulfillment_status || "—"}</div>
                      <div>{demand.needed_by_date || "—"}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}