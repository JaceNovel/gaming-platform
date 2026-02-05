"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type SellerRow = {
  id: number;
  status?: string | null;
  status_reason?: string | null;
  whatsapp_number?: string | null;
  partner_wallet_frozen?: boolean | null;
  updated_at?: string | null;
  user?: {
    id?: number;
    name?: string | null;
    email?: string | null;
  } | null;
};

type Paginated<T> = {
  data?: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
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

export default function AdminMarketplaceSellersPage() {
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        buildUrl("/admin/marketplace/sellers", {
          search: search.trim(),
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
      if (!res.ok) throw new Error(payload?.message ?? "Impossible de charger les vendeurs");
      const page: Paginated<SellerRow> | null = payload?.data ?? null;
      const list = Array.isArray(page?.data) ? page?.data : Array.isArray(payload?.data) ? payload.data : [];
      setRows(list);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Impossible de charger les vendeurs");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 200);
    return () => clearTimeout(t);
  }, [load]);

  const doAction = useCallback(async (sellerId: number, action: string) => {
    if (!Number.isFinite(sellerId) || sellerId <= 0) return;
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/marketplace/sellers/${sellerId}/${action}`, {
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
    <AdminShell title="Gestion vendeur" subtitle="Vendeurs marketplace">
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Recherche (nom, email, WhatsApp...)"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">Tous statuts</option>
            <option value="pending_verification">pending_verification</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="suspended">suspended</option>
            <option value="banned">banned</option>
          </select>
          <div className="lg:col-span-4 flex items-center justify-end">
            <button onClick={() => void load()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" disabled={loading}>
              {loading ? "Chargement..." : "Rafraîchir"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-400">
            <tr>
              <th className="pb-2 pr-4">Vendeur</th>
              <th className="pb-2 pr-4">Statut</th>
              <th className="pb-2 pr-4">WhatsApp</th>
              <th className="pb-2 pr-4">Wallet</th>
              <th className="pb-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  {loading ? "Chargement..." : "Aucun vendeur"}
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-3 pr-4">
                    <div className="font-semibold">#{s.id} {s.user?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{s.user?.email ?? "—"}</div>
                    {s.status_reason ? <div className="mt-1 text-xs text-slate-500">{s.status_reason}</div> : null}
                  </td>
                  <td className="py-3 pr-4">{s.status ?? "—"}</td>
                  <td className="py-3 pr-4">{s.whatsapp_number ?? "—"}</td>
                  <td className="py-3 pr-4">{s.partner_wallet_frozen ? "Gelé" : "Actif"}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => void doAction(s.id, "approve")}>Approuver</button>
                      <button className="rounded-lg bg-amber-600 px-2 py-1 text-xs text-white" onClick={() => void doAction(s.id, "refuse")}>Refuser</button>
                      <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => void doAction(s.id, "suspend")}>Suspendre</button>
                      <button className="rounded-lg bg-rose-600 px-2 py-1 text-xs text-white" onClick={() => void doAction(s.id, "ban")}>Bannir</button>
                      {s.partner_wallet_frozen ? (
                        <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs" onClick={() => void doAction(s.id, "unfreeze-wallet")}>Débloquer wallet</button>
                      ) : (
                        <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs" onClick={() => void doAction(s.id, "freeze-wallet")}>Bloquer wallet</button>
                      )}
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
