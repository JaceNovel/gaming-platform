"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

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

  const doAction = useCallback(async (listingId: number, action: string) => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/marketplace/listings/${listingId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
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
                      <button className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => void doAction(l.id, "approve")}>Approuver</button>
                      <button className="rounded-lg bg-amber-600 px-2 py-1 text-xs text-white" onClick={() => void doAction(l.id, "reject")}>Rejeter</button>
                      <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => void doAction(l.id, "suspend")}>Suspendre</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
