"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import DetailsDrawer from "@/components/admin/DetailsDrawer";
import { API_BASE } from "@/lib/config";
import { toDisplayImageSrc } from "@/lib/imageProxy";

type ListingRow = {
  id: number;
  title?: string | null;
  status?: string | null;
  status_reason?: string | null;
  price?: number | string | null;
  created_at?: string | null;
  seller_id?: number | null;
  game?: { name?: string | null } | null;
  category?: { name?: string | null } | null;
  seller?: { id?: number; user?: { email?: string | null; name?: string | null } | null } | null;
};

type Paginated<T> = { data?: T[] };

type ListingDetailResponse = {
  data?: any;
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

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  headers.Accept = "application/json";
  headers["X-Requested-With"] = "XMLHttpRequest";
  return headers;
};

const buildUrl = (path: string, params: Record<string, string>) => {
  const u = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    u.searchParams.set(k, v);
  }
  return u.toString();
};

export default function AdminMarketplaceListingsPage() {
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>("");
  const [detail, setDetail] = useState<any | null>(null);

  const [status, setStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        buildUrl("/admin/marketplace/listings", {
          status: status === "all" ? "" : status,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        },
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Impossible de charger les annonces");
      const page: Paginated<ListingRow> | null = payload?.data ?? null;
      const list = Array.isArray(page?.data) ? page?.data : [];
      setRows(list);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Impossible de charger les annonces");
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
  }, []);

  const openListingDossier = useCallback(async (listingId: number) => {
    if (!Number.isFinite(listingId) || listingId <= 0) return;
    setDrawerOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setDetailError("");

    try {
      const res = await fetch(`${API_BASE}/admin/marketplace/listings/${listingId}`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      const payload = (await res.json().catch(() => null)) as ListingDetailResponse | null;
      if (!res.ok) throw new Error((payload as any)?.message ?? "Impossible de charger le dossier annonce");
      setDetail(payload?.data ?? null);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Impossible de charger le dossier annonce");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const doAction = useCallback(async (listingId: number, action: string) => {
    setError("");
    try {
      let body: string | undefined = undefined;
      if (["reject", "suspend"].includes(action)) {
        const reason = window.prompt("Raison (obligatoire)") ?? "";
        if (!reason.trim()) return;
        body = JSON.stringify({ reason: reason.trim() });
      }

      const res = await fetch(`${API_BASE}/admin/marketplace/listings/${listingId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Action impossible");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
    }
  }, [load]);

  const items = useMemo(() => rows ?? [], [rows]);

  return (
    <AdminShell title="Gestion vendeur" subtitle="Annonces marketplace">
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">Tous statuts</option>
            <option value="draft">draft</option>
            <option value="pending_review">pending_review</option>
            <option value="pending_review_update">pending_review_update</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="suspended">suspended</option>
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
              <th className="pb-2 pr-4">Annonce</th>
              <th className="pb-2 pr-4">Statut</th>
              <th className="pb-2 pr-4">Prix</th>
              <th className="pb-2 pr-4">Jeu</th>
              <th className="pb-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  {loading ? "Chargement..." : "Aucune annonce"}
                </td>
              </tr>
            ) : (
              items.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="py-3 pr-4">
                    <div className="font-semibold">#{l.id} {l.title ?? "—"}</div>
                    <div className="text-xs text-slate-500">Vendeur #{l.seller_id ?? "—"}</div>
                    {l.status_reason ? <div className="mt-1 text-xs text-slate-500">{l.status_reason}</div> : null}
                  </td>
                  <td className="py-3 pr-4">{l.status ?? "—"}</td>
                  <td className="py-3 pr-4">{String(l.price ?? "—")} FCFA</td>
                  <td className="py-3 pr-4">{l.game?.name ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => void openListingDossier(l.id)}
                        title="Voir dossier annonce"
                      >
                        <EyeIcon className="h-4 w-4" />
                        👁 Voir
                      </button>
                      <button className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => void doAction(l.id, "approve")}>✅ Approuver</button>
                      <button className="rounded-lg bg-amber-600 px-2 py-1 text-xs text-white" onClick={() => void doAction(l.id, "reject")}>⛔ Rejeter</button>
                      <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => void doAction(l.id, "suspend")}>⏸ Suspendre</button>
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
        title={detail ? `🗂️ Dossier annonce #${detail?.id ?? "—"}` : "🗂️ Dossier annonce"}
        subtitle={detail?.seller?.user?.email ?? ""}
        footer={
          detail?.id ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">🔎 Vérifie les infos + image avant publication.</div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => void doAction(Number(detail.id), "approve")}>✅ Approuver</button>
                <button className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => void doAction(Number(detail.id), "reject")}>⛔ Rejeter</button>
                <button className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" onClick={() => void doAction(Number(detail.id), "suspend")}>⏸ Suspendre</button>
              </div>
            </div>
          ) : null
        }
      >
        {detailError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{detailError}</div>
        ) : null}

        {detailLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Chargement du dossier...</div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {toDisplayImageSrc(String(detail.image_url ?? "")) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={toDisplayImageSrc(String(detail.image_url ?? "")) as string} alt="image annonce" className="h-56 w-full object-cover" />
              ) : (
                <div className="flex h-56 items-center justify-center bg-white text-sm text-slate-500">Aucune image</div>
              )}
              <div className="border-t border-slate-200 bg-white p-4">
                <div className="text-sm font-extrabold text-slate-900">{detail.title ?? "—"}</div>
                <div className="mt-1 text-xs text-slate-600">
                  {detail.category?.name ?? "—"} · {detail.game?.name ?? "—"}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Statut</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{detail.status ?? "—"}</div>
                  {detail.status_reason ? <div className="mt-1 text-xs text-slate-600">Raison: {detail.status_reason}</div> : null}
                  <div className="mt-2 text-xs text-slate-600">Créée: {detail.created_at ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">Prix</div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">{formatAmount(detail.price)}</div>
                  <div className="mt-2 text-xs text-slate-600">Livraison: {detail.delivery_window_hours ?? "—"}h</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-500">Vendeur</div>
                <div className="mt-1 text-sm font-bold text-slate-900">#{detail.seller_id ?? detail.seller?.id ?? "—"} {detail.seller?.user?.name ?? ""}</div>
                <div className="text-xs text-slate-600">{detail.seller?.user?.email ?? "—"}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Description</div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{detail.description ?? "—"}</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Level</div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">{detail.account_level ?? "—"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Rank</div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">{detail.account_rank ?? "—"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">Région</div>
                  <div className="mt-1 text-sm font-extrabold text-slate-900">{detail.account_region ?? "—"}</div>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Accès email</div>
                <div className="mt-1 text-sm font-bold text-slate-900">{detail.has_email_access ? "Oui" : "Non"}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Aucun dossier.</div>
        )}
      </DetailsDrawer>
    </AdminShell>
  );
}
