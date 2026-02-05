"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
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
                    <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => void release(o.id)}>
                      Release
                    </button>
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
