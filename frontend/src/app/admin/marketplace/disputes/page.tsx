"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
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
    </AdminShell>
  );
}
