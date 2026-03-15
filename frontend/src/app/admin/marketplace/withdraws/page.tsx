"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type WithdrawRow = {
  id: number;
  status?: string | null;
  amount?: number | string | null;
  created_at?: string | null;
  processed_at?: string | null;
  admin_note?: string | null;
  payout_details?: {
    provider_status?: string | null;
    provider_reference?: string | null;
    provider_last_error_code?: string | null;
  } | null;
  seller?: { id?: number; user?: { name?: string | null; email?: string | null } | null } | null;
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

export default function AdminMarketplaceWithdrawsPage() {
  const [rows, setRows] = useState<WithdrawRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [status, setStatus] = useState("all");
  const [providerStatus, setProviderStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = new URL(`${API_BASE}/admin/marketplace/withdraw-requests`);
      if (status !== "all") url.searchParams.set("status", status);
      if (providerStatus !== "all") url.searchParams.set("provider_status", providerStatus);

      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Impossible de charger les retraits");
      const page: Paginated<WithdrawRow> | null = payload?.data ?? null;
      setRows(Array.isArray(page?.data) ? page!.data! : []);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Impossible de charger les retraits");
    } finally {
      setLoading(false);
    }
  }, [providerStatus, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const markPaid = useCallback(async (id: number) => {
    setError("");
    try {
      const adminNote = window.prompt("Note (optionnel)") ?? "";
      const res = await fetch(`${API_BASE}/admin/marketplace/withdraw-requests/${id}/mark-paid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ adminNote: adminNote.trim() || null }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Action impossible");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
    }
  }, [load]);

  const reject = useCallback(async (id: number) => {
    setError("");
    try {
      const adminNote = window.prompt("Note (obligatoire)") ?? "";
      if (!adminNote.trim()) {
        setError("Note obligatoire pour rejeter.");
        return;
      }
      const res = await fetch(`${API_BASE}/admin/marketplace/withdraw-requests/${id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ adminNote: adminNote.trim() }),
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
    <AdminShell title="Gestion vendeur" subtitle="Retraits vendeur">
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="all">Tous statuts</option>
              <option value="requested">requested</option>
              <option value="paid">paid</option>
              <option value="rejected">rejected</option>
            </select>
            <select value={providerStatus} onChange={(e) => setProviderStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="all">Tous provider statuts</option>
              <option value="processing">processing</option>
              <option value="sent">sent</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>
          <button onClick={() => void load()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" disabled={loading}>
            {loading ? "Chargement..." : "Rafraîchir"}
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-400">
            <tr>
              <th className="pb-2 pr-4">Demande</th>
              <th className="pb-2 pr-4">Vendeur</th>
              <th className="pb-2 pr-4">Montant</th>
              <th className="pb-2 pr-4">Statut</th>
              <th className="pb-2 pr-4">Payout FedaPay</th>
              <th className="pb-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500">
                  {loading ? "Chargement..." : "Aucune demande"}
                </td>
              </tr>
            ) : (
              items.map((w) => (
                <tr key={w.id} className="border-t border-slate-100">
                  <td className="py-3 pr-4">
                    <div className="font-semibold">#{w.id}</div>
                    <div className="text-xs text-slate-500">{w.created_at ?? "—"}</div>
                    {w.admin_note ? <div className="mt-1 text-xs text-slate-500">{w.admin_note}</div> : null}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-semibold">{w.seller?.user?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{w.seller?.user?.email ?? "—"}</div>
                  </td>
                  <td className="py-3 pr-4">{String(w.amount ?? "—")} FCFA</td>
                  <td className="py-3 pr-4">{w.status ?? "—"}</td>
                  <td className="py-3 pr-4 text-xs text-slate-600">
                    <div>{w.payout_details?.provider_status ?? "—"}</div>
                    <div>{w.payout_details?.provider_reference ?? "—"}</div>
                    {w.payout_details?.provider_last_error_code ? <div className="text-rose-600">{w.payout_details.provider_last_error_code}</div> : null}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => void markPaid(w.id)}>Lancer payout</button>
                      <button className="rounded-lg bg-rose-600 px-2 py-1 text-xs text-white" onClick={() => void reject(w.id)}>Rejeter</button>
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
