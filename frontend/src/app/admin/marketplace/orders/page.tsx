"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import DetailsDrawer from "@/components/admin/DetailsDrawer";
import { API_BASE } from "@/lib/config";

type MarketplaceOrderRow = {
  id: number;
  status?: string | null;
  created_at?: string | null;
  price?: number | string | null;
  order?: {
    id?: number;
    reference?: string | null;
    meta?: any;
    status?: string | null;
  } | null;
  buyer?: { id?: number; name?: string | null; email?: string | null } | null;
  seller?: { id?: number; user?: { name?: string | null; email?: string | null } | null } | null;
  listing?: { id?: number; title?: string | null } | null;
};

type Paginated<T> = { data?: T[] };

type MarketplaceOrderDetailResponse = {
  data?: {
    marketplaceOrder?: any;
    deliveryProof?: {
      note?: string | null;
      hasFile?: boolean;
      file?: { mime?: string | null; size?: number | null; name?: string | null } | null;
    };
  };
};

const EyeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className ?? "h-4 w-4"} aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const formatAmount = (value: any) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString()} FCFA`;
};

const downloadBlob = async (url: string, filename: string, headers: Record<string, string>) => {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("Téléchargement impossible");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  headers.Accept = "application/json";
  headers["X-Requested-With"] = "XMLHttpRequest";
  return headers;
};

export default function AdminMarketplaceOrdersPage() {
  const [rows, setRows] = useState<MarketplaceOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>("");
  const [detail, setDetail] = useState<MarketplaceOrderDetailResponse["data"] | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string>("");

  const [status, setStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = new URL(`${API_BASE}/admin/marketplace/orders`);
      if (status !== "all") url.searchParams.set("status", status);

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Impossible de charger les commandes");
      const page: Paginated<MarketplaceOrderRow> | null = payload?.data ?? null;
      setRows(Array.isArray(page?.data) ? page!.data! : []);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Impossible de charger les commandes");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDetail(null);
    setDetailError("");
    setDetailLoading(false);
    setProofPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
  }, []);

  const openOrderDossier = useCallback(async (id: number) => {
    if (!Number.isFinite(id) || id <= 0) return;

    setDrawerOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setDetailError("");
    setProofPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });

    try {
      const res = await fetch(`${API_BASE}/admin/marketplace/orders/${id}`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      const payload = (await res.json().catch(() => null)) as MarketplaceOrderDetailResponse | null;
      if (!res.ok) throw new Error((payload as any)?.message ?? "Impossible de charger le dossier commande");

      const data = payload?.data ?? null;
      setDetail(data);

      if (data?.deliveryProof?.hasFile) {
        try {
          const fileRes = await fetch(`${API_BASE}/admin/marketplace/orders/${id}/delivery-proof`, {
            headers: {
              ...getAuthHeaders(),
            },
          });
          if (fileRes.ok) {
            const blob = await fileRes.blob();
            const objectUrl = URL.createObjectURL(blob);
            setProofPreviewUrl(objectUrl);
          }
        } catch {
          // ignore preview failures
        }
      }
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Impossible de charger le dossier commande");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const release = useCallback(async (id: number) => {
    setError("");
    try {
      const note = window.prompt("Note (optionnel)") ?? "";
      const res = await fetch(`${API_BASE}/admin/marketplace/orders/${id}/release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ note: note.trim() || null }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Release impossible");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Release impossible");
    }
  }, [load]);

  const items = useMemo(() => rows ?? [], [rows]);

  const phoneFor = (row: MarketplaceOrderRow) => {
    const meta = row?.order?.meta;
    const p = meta?.buyer_phone ?? meta?.buyerPhone ?? meta?.phone;
    return typeof p === "string" && p.trim() ? p.trim() : "—";
  };

  return (
    <AdminShell title="Gestion vendeur" subtitle="Commandes marketplace">
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">Tous statuts</option>
            <option value="paid">paid</option>
            <option value="delivered">delivered</option>
            <option value="disputed">disputed</option>
            <option value="resolved_refund">resolved_refund</option>
            <option value="resolved_release">resolved_release</option>
          </select>
          <button onClick={() => void load()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" disabled={loading}>
            {loading ? "Chargement..." : "Rafraîchir"}
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-400">
            <tr>
              <th className="pb-2 pr-4">Commande</th>
              <th className="pb-2 pr-4">Acheteur</th>
              <th className="pb-2 pr-4">Téléphone</th>
              <th className="pb-2 pr-4">Annonce</th>
              <th className="pb-2 pr-4">Statut</th>
              <th className="pb-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500">
                  {loading ? "Chargement..." : "Aucune commande"}
                </td>
              </tr>
            ) : (
              items.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="py-3 pr-4">
                    <div className="font-semibold">#{o.id} {o.order?.reference ?? "—"}</div>
                    <div className="text-xs text-slate-500">Order #{o.order?.id ?? "—"}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-semibold">{o.buyer?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{o.buyer?.email ?? "—"}</div>
                  </td>
                  <td className="py-3 pr-4">{phoneFor(o)}</td>
                  <td className="py-3 pr-4">{o.listing?.title ?? "—"}</td>
                  <td className="py-3 pr-4">{o.status ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => void openOrderDossier(o.id)}
                        title="Voir dossier commande"
                      >
                        <EyeIcon className="h-4 w-4" />
                        Voir
                      </button>
                      <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => void release(o.id)}>
                        Release
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DetailsDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={detail?.marketplaceOrder ? `Dossier commande #${detail.marketplaceOrder?.id ?? "—"}` : "Dossier commande"}
        subtitle={detail?.marketplaceOrder?.order?.reference ?? ""}
        footer={
          detail?.marketplaceOrder?.id ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">Check preuve + statut avant release.</div>
              <button
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                onClick={() => void release(Number(detail.marketplaceOrder.id))}
              >
                Release
              </button>
            </div>
          ) : null
        }
      >
        {detailError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{detailError}</div>
        ) : null}

        {detailLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Chargement du dossier...</div>
        ) : detail?.marketplaceOrder ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Commande marketplace</div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">#{detail.marketplaceOrder.id}</div>
                  <div className="mt-1 text-xs text-slate-600">Statut: {detail.marketplaceOrder.status ?? "—"}</div>
                  <div className="text-xs text-slate-600">Créée: {detail.marketplaceOrder.created_at ?? "—"}</div>
                  <div className="text-xs text-slate-600">Livrée: {detail.marketplaceOrder.delivered_at ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">Montants</div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">{formatAmount(detail.marketplaceOrder.price)}</div>
                  <div className="mt-1 text-xs text-slate-600">Commission: {formatAmount(detail.marketplaceOrder.commission_amount)}</div>
                  <div className="text-xs text-slate-600">Gain vendeur: {formatAmount(detail.marketplaceOrder.seller_earnings)}</div>
                  <div className="mt-2 text-xs text-slate-600">Deadline: {detail.marketplaceOrder.delivery_deadline_at ?? "—"}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold text-slate-500">Acheteur</div>
                <div className="mt-1 text-sm font-bold text-slate-900">{detail.marketplaceOrder.buyer?.name ?? "—"}</div>
                <div className="text-xs text-slate-600">{detail.marketplaceOrder.buyer?.email ?? "—"}</div>
                <div className="mt-3 text-xs text-slate-600">Téléphone: {detail.marketplaceOrder.order?.meta?.buyer_phone ?? detail.marketplaceOrder.order?.meta?.buyerPhone ?? detail.marketplaceOrder.order?.meta?.phone ?? "—"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold text-slate-500">Vendeur</div>
                <div className="mt-1 text-sm font-bold text-slate-900">{detail.marketplaceOrder.seller?.user?.name ?? "—"}</div>
                <div className="text-xs text-slate-600">{detail.marketplaceOrder.seller?.user?.email ?? "—"}</div>
                <div className="mt-3 text-xs text-slate-600">Seller #{detail.marketplaceOrder.seller_id ?? detail.marketplaceOrder.seller?.id ?? "—"}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Annonce</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{detail.marketplaceOrder.listing?.title ?? "—"}</div>
              <div className="mt-1 text-xs text-slate-600">Listing #{detail.marketplaceOrder.seller_listing_id ?? detail.marketplaceOrder.listing?.id ?? "—"}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Commande shop liée</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{detail.marketplaceOrder.order?.reference ?? "—"}</div>
                  <div className="text-xs text-slate-600">Order #{detail.marketplaceOrder.order?.id ?? "—"}</div>
                </div>
                {detail.marketplaceOrder.order?.id ? (
                  <a
                    href={`/admin/orders/${detail.marketplaceOrder.order.id}`}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ouvrir
                  </a>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 text-xs font-semibold text-slate-500">Preuve de livraison</div>
              {detail.deliveryProof?.note ? (
                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="text-xs font-semibold text-slate-500">Note vendeur</div>
                  <div className="mt-1 whitespace-pre-wrap">{detail.deliveryProof.note}</div>
                </div>
              ) : null}

              {detail.deliveryProof?.hasFile ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
                    <div className="text-xs font-semibold text-slate-700">{detail.deliveryProof.file?.name ?? "Fichier"}</div>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      onClick={() =>
                        void downloadBlob(
                          `${API_BASE}/admin/marketplace/orders/${detail.marketplaceOrder.id}/delivery-proof`,
                          `marketplace_order_${detail.marketplaceOrder.id}_delivery_proof.jpg`,
                          getAuthHeaders(),
                        )
                      }
                    >
                      Télécharger
                    </button>
                  </div>
                  <div className="p-3">
                    {proofPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={proofPreviewUrl} alt="preuve" className="h-56 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-500">
                        Aperçu en cours...
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Aucune preuve fichier.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Aucun dossier.</div>
        )}
      </DetailsDrawer>
    </AdminShell>
  );
}
