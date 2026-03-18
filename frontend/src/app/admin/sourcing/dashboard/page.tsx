"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type DashboardPayload = {
  kpis: Record<string, number>;
  logistics_kpis?: Record<string, number>;
  moq_blockers: Array<{
    supplier_product_sku_id?: number | null;
    supplier_account?: string | null;
    product_title?: string | null;
    sku_label?: string | null;
    quantity_to_procure?: number | null;
    required_moq?: number | null;
    missing_to_moq?: number | null;
  }>;
  unmapped_products: Array<{
    id: number;
    name?: string | null;
    title?: string | null;
    stock?: number | null;
    delivery_type?: string | null;
  }>;
  logistics_orders?: Array<{
    id: number;
    reference?: string | null;
    status?: string | null;
    supplier_fulfillment_status?: string | null;
    supplier_country_code?: string | null;
    grouping_released_at?: string | null;
    shipping_mark_ready?: boolean;
    total_price?: number | null;
    created_at?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
  }>;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const KPI_LABELS: Array<{ key: string; label: string }> = [
  { key: "active_supplier_accounts", label: "Comptes actifs" },
  { key: "imported_supplier_products", label: "Produits source" },
  { key: "active_supplier_skus", label: "SKU actifs" },
  { key: "pending_demands", label: "Demandes en attente" },
  { key: "pending_quantity_to_procure", label: "Quantité à acheter" },
  { key: "draft_batches", label: "Lots en brouillon" },
  { key: "open_batches", label: "Lots ouverts" },
  { key: "open_inbound_shipments", label: "Expéditions ouvertes" },
  { key: "unmapped_products", label: "Produits non mappés" },
  { key: "moq_blockers", label: "Blocages MOQ" },
];

const LOGISTICS_KPI_LABELS: Array<{ key: string; label: string }> = [
  { key: "grouping_orders", label: "Commandes en groupage" },
  { key: "released_groupings", label: "Groupages libérés" },
  { key: "shipping_marks_ready", label: "Shipping marks prêts" },
  { key: "warehouse_received_orders", label: "Reçus en entrepôt" },
];

export default function AdminSourcingDashboardPage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") === "aliexpress" ? "aliexpress" : "alibaba";
  const platformLabel = platform === "aliexpress" ? "AliExpress" : "Alibaba";
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/dashboard?platform=${platform}`, {
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`Impossible de charger le tableau de bord ${platformLabel}`);
      const payload = await res.json();
      setData(payload?.data ?? null);
    } catch (err: any) {
      setError(err?.message ?? `Impossible de charger le tableau de bord ${platformLabel}`);
    } finally {
      setLoading(false);
    }
  }, [platform, platformLabel]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <AdminShell title={platformLabel} subtitle="KPI sourcing, groupage logistique et produits non mappés">
      <div className="space-y-6">
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {KPI_LABELS.map((item) => (
            <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-400">{item.label}</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{data?.kpis?.[item.key] ?? 0}</div>
            </div>
          ))}
        </section>

        {platform === "aliexpress" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Logistique groupage</h2>
              <p className="text-sm text-slate-500">Suivi des commandes AliExpress en attente de groupage, libérées ou déjà documentées.</p>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {LOGISTICS_KPI_LABELS.map((item) => (
                <div key={item.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">{item.label}</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">{data?.logistics_kpis?.[item.key] ?? 0}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Blocages MOQ</h2>
                <p className="text-sm text-slate-500">Demandes encore insuffisantes pour déclencher un achat fournisseur.</p>
              </div>
              <button type="button" onClick={loadDashboard} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Rafraîchir</button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="pb-3 pr-4">Produit</th>
                    <th className="pb-3 pr-4">SKU</th>
                    <th className="pb-3 pr-4">Demandé</th>
                    <th className="pb-3 pr-4">MOQ</th>
                    <th className="pb-3 pr-4">Manque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading && (data?.moq_blockers?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-slate-500">Aucun blocage MOQ.</td>
                    </tr>
                  ) : null}
                  {(data?.moq_blockers ?? []).map((item, index) => (
                    <tr key={`${item.supplier_product_sku_id ?? "sku"}-${index}`}>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-900">{item.product_title || "Produit"}</div>
                        <div className="text-xs text-slate-500">{item.supplier_account || "Compte fournisseur"}</div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600">{item.sku_label || "—"}</td>
                      <td className="py-3 pr-4 text-xs text-slate-600">{item.quantity_to_procure ?? 0}</td>
                      <td className="py-3 pr-4 text-xs text-slate-600">{item.required_moq ?? 0}</td>
                      <td className="py-3 pr-4 text-xs font-medium text-amber-700">{item.missing_to_moq ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Produits non mappés</h2>
              <p className="text-sm text-slate-500">Accessoires physiques encore sans lien fournisseur par défaut.</p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="pb-3 pr-4">Produit</th>
                    <th className="pb-3 pr-4">Stock</th>
                    <th className="pb-3 pr-4">Livraison</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading && (data?.unmapped_products?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-slate-500">Tous les accessoires ciblés sont mappés.</td>
                    </tr>
                  ) : null}
                  {(data?.unmapped_products ?? []).map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-900">{item.title || item.name || `Produit #${item.id}`}</div>
                        <div className="text-xs text-slate-500">ID {item.id}</div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600">{item.stock ?? 0}</td>
                      <td className="py-3 pr-4 text-xs text-slate-600">{item.delivery_type || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {platform === "aliexpress" ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-base font-semibold text-slate-900">File logistique AliExpress</h2>
              <p className="text-sm text-slate-500">Dernières commandes en transit avec état de groupage et disponibilité du shipping mark.</p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="pb-3 pr-4">Commande</th>
                    <th className="pb-3 pr-4">Client</th>
                    <th className="pb-3 pr-4">Transit</th>
                    <th className="pb-3 pr-4">Montant</th>
                    <th className="pb-3 pr-4">Shipping mark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading && (data?.logistics_orders?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-slate-500">Aucune commande logistique AliExpress pour le moment.</td>
                    </tr>
                  ) : null}
                  {(data?.logistics_orders ?? []).map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-900">{item.reference || `Commande #${item.id}`}</div>
                        <div className="text-xs text-slate-500">{item.status || "—"}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="text-slate-700">{item.customer_name || "Client"}</div>
                        <div className="text-xs text-slate-500">{item.customer_email || "—"}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="text-slate-700">{item.supplier_fulfillment_status || "pending"}</div>
                        <div className="text-xs text-slate-500">{item.supplier_country_code || "—"}{item.grouping_released_at ? ` · libéré ${new Date(item.grouping_released_at).toLocaleDateString("fr-FR")}` : ""}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{Math.round(Number(item.total_price ?? 0)).toLocaleString("fr-FR")} FCFA</td>
                      <td className="py-3 pr-4 text-slate-700">{item.shipping_mark_ready ? "Prêt" : "En attente"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}