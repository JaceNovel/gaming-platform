"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type PayoutRow = {
  id: string;
  amount?: number | string | null;
  fee?: number | string | null;
  total_debit?: number | string | null;
  phone?: string | null;
  country?: string | null;
  provider_ref?: string | null;
  status?: string | null;
  failure_reason?: string | null;
  created_at?: string | null;
  wallet?: {
    wallet_id?: string | null;
    user?: { name?: string | null; email?: string | null } | null;
  } | null;
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

const formatAmount = (value?: number | string | null) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "—";
  return `${Math.round(numeric).toLocaleString("fr-FR")} FCFA`;
};

export default function AdminDbWalletPayoutsPage() {
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [syncingId, setSyncingId] = useState("");

  const [walletId, setWalletId] = useState("");
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("all");

  const filters = useMemo(
    () => ({
      per_page: "50",
      wallet_id: walletId.trim(),
      email: email.trim(),
      reference: reference.trim(),
      status: status === "all" ? "" : status,
    }),
    [walletId, email, reference, status],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = new URL(`${API_BASE}/admin/dbwallet/payouts`);
      Object.entries(filters).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
      const res = await fetch(url.toString(), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      const payload = (await res.json().catch(() => null)) as Paginated<PayoutRow> | null;
      if (!res.ok) throw new Error("Impossible de charger les payouts wallet");
      setRows(Array.isArray(payload?.data) ? payload.data ?? [] : []);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Impossible de charger les payouts wallet");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const syncPayout = useCallback(async (id: string) => {
    setSyncingId(id);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/dbwallet/payouts/${id}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Synchronisation impossible");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Synchronisation impossible");
    } finally {
      setSyncingId("");
    }
  }, [load]);

  return (
    <AdminShell title="DBWallet" subtitle="Payouts FedaPay wallet">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <input value={walletId} onChange={(e) => setWalletId(e.target.value)} placeholder="Wallet ID" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email client" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Réf payout / idempotency" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">Tous statuts</option>
            <option value="queued">queued</option>
            <option value="processing">processing</option>
            <option value="sent">sent</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-500">
          <span>{loading ? "Chargement..." : `${rows.length} payout(s)`}</span>
          <button onClick={() => void load()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white" disabled={loading}>Rafraîchir</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Wallet</th>
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4">Montants</th>
                <th className="pb-2 pr-4">Destination</th>
                <th className="pb-2 pr-4">Statut</th>
                <th className="pb-2 pr-4">Référence</th>
                <th className="pb-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-4 text-slate-500">Aucun payout.</td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-4 text-xs text-slate-500">{row.created_at ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-700">{row.wallet?.wallet_id ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <div className="font-medium">{row.wallet?.user?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{row.wallet?.user?.email ?? "—"}</div>
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-600">
                    <div>Net: {formatAmount(row.amount)}</div>
                    <div>Frais: {formatAmount(row.fee)}</div>
                    <div>Total: {formatAmount(row.total_debit)}</div>
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-600">{row.phone ?? "—"} {row.country ? `(${row.country})` : ""}</td>
                  <td className="py-2 pr-4">
                    <div>{row.status ?? "—"}</div>
                    {row.failure_reason ? <div className="mt-1 text-xs text-rose-600">{row.failure_reason}</div> : null}
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-600">{row.provider_ref ?? row.id}</td>
                  <td className="py-2 pr-4">
                    <button onClick={() => void syncPayout(row.id)} disabled={syncingId === row.id} className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-60">
                      {syncingId === row.id ? "Sync..." : "Sync"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}