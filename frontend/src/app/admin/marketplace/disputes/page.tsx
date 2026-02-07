"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import DetailsDrawer from "@/components/admin/DetailsDrawer";
import { API_BASE } from "@/lib/config";

type DisputeRow = {
  id: number;
  status?: string | null;
  reason?: string | null;
  evidence_urls?: string[];
  opened_at?: string | null;
  resolved_at?: string | null;
  buyer?: { name?: string | null; email?: string | null } | null;
  seller?: { user?: { name?: string | null; email?: string | null } | null } | null;
  listing?: { title?: string | null } | null;
  marketplace_order?: { id?: number; status?: string | null } | null;
  marketplaceOrder?: { id?: number; status?: string | null } | null;
};

type Paginated<T> = { data?: T[] };

const EyeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className ?? "h-4 w-4"} aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  headers.Accept = "application/json";
  headers["X-Requested-With"] = "XMLHttpRequest";
  return headers;
};

export default function AdminMarketplaceDisputesPage() {
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<DisputeRow | null>(null);

  const [status, setStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = new URL(`${API_BASE}/admin/marketplace/disputes`);
      if (status !== "all") url.searchParams.set("status", status);

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Impossible de charger les litiges");
      const page: Paginated<DisputeRow> | null = payload?.data ?? null;
      setRows(Array.isArray(page?.data) ? page!.data! : []);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Impossible de charger les litiges");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelected(null);
  }, []);

  const openDisputeDossier = useCallback((row: DisputeRow) => {
    setSelected(row);
    setDrawerOpen(true);
  }, []);

  const resolve = useCallback(async (disputeId: number, resolution: "refund_buyer_wallet" | "release_to_seller") => {
    setError("");
    try {
      const note = window.prompt("Note (optionnel)") ?? "";
      const res = await fetch(`${API_BASE}/admin/marketplace/disputes/${disputeId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          resolution,
          note: note.trim() || null,
          sellerWallet: "unfreeze",
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Résolution impossible");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Résolution impossible");
    }
  }, [load]);

  const items = useMemo(() => rows ?? [], [rows]);

  return (
    <AdminShell title="Gestion vendeur" subtitle="Litiges marketplace">
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">Tous statuts</option>
            <option value="open">open</option>
            <option value="resolved">resolved</option>
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
              <th className="pb-2 pr-4">Litige</th>
              <th className="pb-2 pr-4">Acheteur</th>
              <th className="pb-2 pr-4">Vendeur</th>
              <th className="pb-2 pr-4">Annonce</th>
              <th className="pb-2 pr-4">Statut</th>
              <th className="pb-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500">
                  {loading ? "Chargement..." : "Aucun litige"}
                </td>
              </tr>
            ) : (
              items.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="py-3 pr-4">
                    <div className="font-semibold">#{d.id}</div>
                    {d.reason ? <div className="mt-1 text-xs text-slate-500">{d.reason}</div> : null}
                    {Array.isArray(d.evidence_urls) && d.evidence_urls.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {d.evidence_urls.slice(0, 6).map((u) => (
                          <a
                            key={u}
                            href={u}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                            title="Ouvrir preuve"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt="preuve" className="h-12 w-12 object-cover" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-semibold">{d.buyer?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{d.buyer?.email ?? "—"}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-semibold">{d.seller?.user?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{d.seller?.user?.email ?? "—"}</div>
                  </td>
                  <td className="py-3 pr-4">{d.listing?.title ?? "—"}</td>
                  <td className="py-3 pr-4">{d.status ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => openDisputeDossier(d)}
                        title="Voir dossier litige"
                      >
                        <EyeIcon className="h-4 w-4" />
                        Voir
                      </button>
                      <button className="rounded-lg bg-amber-600 px-2 py-1 text-xs text-white" onClick={() => void resolve(d.id, "refund_buyer_wallet")}>Rembourser wallet</button>
                      <button className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => void resolve(d.id, "release_to_seller")}>Release vendeur</button>
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
        title={selected ? `Dossier litige #${selected.id}` : "Dossier litige"}
        subtitle={selected?.marketplace_order?.id || selected?.marketplaceOrder?.id ? `Commande #${selected.marketplace_order?.id ?? selected.marketplaceOrder?.id}` : ""}
        footer={
          selected?.id ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">Décision: remboursement ou release.</div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => void resolve(selected.id, "refund_buyer_wallet")}>Rembourser wallet</button>
                <button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => void resolve(selected.id, "release_to_seller")}>Release vendeur</button>
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Statut</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{selected.status ?? "—"}</div>
                  <div className="mt-2 text-xs text-slate-600">Ouvert: {selected.opened_at ?? "—"}</div>
                  <div className="text-xs text-slate-600">Résolu: {selected.resolved_at ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">Motif</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selected.reason ?? "—"}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold text-slate-500">Acheteur</div>
                <div className="mt-1 text-sm font-bold text-slate-900">{selected.buyer?.name ?? "—"}</div>
                <div className="text-xs text-slate-600">{selected.buyer?.email ?? "—"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold text-slate-500">Vendeur</div>
                <div className="mt-1 text-sm font-bold text-slate-900">{selected.seller?.user?.name ?? "—"}</div>
                <div className="text-xs text-slate-600">{selected.seller?.user?.email ?? "—"}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold text-slate-500">Annonce</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{selected.listing?.title ?? "—"}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 text-xs font-semibold text-slate-500">Preuves</div>
              {Array.isArray(selected.evidence_urls) && selected.evidence_urls.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {selected.evidence_urls.map((u) => (
                    <div key={u} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <a href={u} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="preuve" className="h-28 w-full object-cover" />
                      </a>
                      <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2">
                        <a
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-slate-700 hover:underline"
                        >
                          Ouvrir
                        </a>
                        <a
                          href={u}
                          download
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Télécharger
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Aucune preuve.</div>
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
