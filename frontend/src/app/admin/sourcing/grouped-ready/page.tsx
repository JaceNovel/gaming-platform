"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type ReadyGroup = {
  product_ids?: number[] | null;
  product_title?: string | null;
  supplier_account?: string | null;
  sku_label?: string | null;
  country_code?: string | null;
  warehouse_destination_label?: string | null;
  quantity_to_procure?: number | null;
  required_moq?: number | null;
  grouping_threshold?: number | null;
  demand_ids?: number[] | null;
  order_references?: string[] | null;
};

type AutoBatch = {
  id: number;
  batch_number?: string | null;
  status?: string | null;
  supplier_order_reference?: string | null;
  supplier_account?: string | null;
  created_at?: string | null;
  submitted_at?: string | null;
  country_code?: string | null;
  product_ids?: number[] | null;
  items?: Array<{
    product_title?: string | null;
    sku_label?: string | null;
    quantity_ordered?: number | null;
  }> | null;
};

type GroupedReadyPayload = {
  ready_groups?: ReadyGroup[];
  auto_batches?: AutoBatch[];
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminSourcingGroupedReadyPage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") === "aliexpress" ? "aliexpress" : "alibaba";
  const platformLabel = platform === "aliexpress" ? "AliExpress" : "Alibaba";
  const [data, setData] = useState<GroupedReadyPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadGroupedReady = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/grouped-ready?platform=${platform}`, {
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`Impossible de charger les articles groupés prêts ${platformLabel}`);
      const payload = await res.json();
      setData(payload?.data ?? null);
    } catch (err: any) {
      setError(err?.message ?? `Impossible de charger les articles groupés prêts ${platformLabel}`);
    } finally {
      setLoading(false);
    }
  }, [platform, platformLabel]);

  useEffect(() => {
    loadGroupedReady();
  }, [loadGroupedReady]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fr-FR");
  };

  return (
    <AdminShell title={platformLabel} subtitle="Articles groupés prêts et lots auto-créés après atteinte du seuil">
      <div className="space-y-6">
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Prêts mais pas encore batchés</h2>
              <p className="text-sm text-slate-500">Groupes d’articles dont le seuil est libéré et dont le MOQ fournisseur est atteint, mais qui n’ont pas encore été transformés en lot.</p>
            </div>
            <button type="button" onClick={loadGroupedReady} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Rafraîchir</button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Produit</th>
                  <th className="pb-3 pr-4">Fournisseur</th>
                  <th className="pb-3 pr-4">Quantité</th>
                  <th className="pb-3 pr-4">Seuil / MOQ</th>
                  <th className="pb-3 pr-4">Commandes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && (data?.ready_groups?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-slate-500">Aucun groupe prêt en attente. Si le seuil est atteint, le lot est normalement créé automatiquement.</td>
                  </tr>
                ) : null}
                {(data?.ready_groups ?? []).map((item, index) => (
                  <tr key={`${item.product_title ?? "group"}-${index}`}>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-900">{item.product_title || "Produit"}</div>
                      <div className="text-xs text-slate-500">{item.country_code || "—"} · {item.warehouse_destination_label || "Destination non définie"}</div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-600">
                      <div>{item.supplier_account || "Compte fournisseur"}</div>
                      <div>{item.sku_label || "—"}</div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-600">{item.quantity_to_procure ?? 0}</td>
                    <td className="py-3 pr-4 text-xs text-slate-600">
                      <div>Groupage: {item.grouping_threshold ?? 1}</div>
                      <div>MOQ: {item.required_moq ?? 1}</div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-600">{(item.order_references ?? []).length ? (item.order_references ?? []).join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Lots auto-créés</h2>
            <p className="text-sm text-slate-500">Historique récent des lots générés automatiquement dès que le groupage client et le MOQ fournisseur sont satisfaits.</p>
          </div>

          <div className="mt-4 space-y-4">
            {!loading && (data?.auto_batches?.length ?? 0) === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Aucun lot auto-créé pour le moment.</div>
            ) : null}

            {(data?.auto_batches ?? []).map((batch) => (
              <div key={batch.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{batch.batch_number || `Lot #${batch.id}`}</div>
                    <div className="text-xs text-slate-500">{batch.supplier_account || "Fournisseur"} · {batch.status || "draft"} · {batch.country_code || "—"}</div>
                  </div>
                  <div className="text-xs text-slate-500">Créé {formatDateTime(batch.created_at)}{batch.submitted_at ? ` · soumis ${formatDateTime(batch.submitted_at)}` : ""}</div>
                </div>

                <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 md:grid-cols-2">
                  <div>Référence fournisseur: {batch.supplier_order_reference || "—"}</div>
                  <div>Produits locaux: {(batch.product_ids ?? []).length ? (batch.product_ids ?? []).join(", ") : "—"}</div>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="pb-2 pr-4">Produit</th>
                        <th className="pb-2 pr-4">SKU</th>
                        <th className="pb-2 pr-4">Qté</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(batch.items ?? []).map((item, index) => (
                        <tr key={`${batch.id}-${index}`}>
                          <td className="py-2 pr-4">{item.product_title || "Produit"}</td>
                          <td className="py-2 pr-4">{item.sku_label || "—"}</td>
                          <td className="py-2 pr-4">{item.quantity_ordered ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}