"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type WalletTransaction = {
  id: string;
  wallet_account_id?: number | null;
  type?: string | null;
  amount?: number | null;
  reference?: string | null;
  status?: string | null;
  created_at?: string | null;
  wallet?: {
    wallet_id?: string | null;
    user?: { id?: number | null; name?: string | null; email?: string | null } | null;
  } | null;
};

type Paginated<T> = {
  data?: T[];
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const buildUrl = (path: string, params: Record<string, string> = {}) => {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
};

const formatAmount = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value).toLocaleString()} FCFA`;
};

export default function AdminDbWalletTransactionsPage() {
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [walletId, setWalletId] = useState("");
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  const queryParams = useMemo(
    () => ({
      per_page: "50",
      wallet_id: walletId.trim(),
      email: email.trim(),
      reference: reference.trim(),
      status: status === "all" ? "" : status,
      type: type === "all" ? "" : type,
    }),
    [walletId, email, reference, status, type]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(buildUrl("/admin/dbwallet/transactions", queryParams), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("load failed");
      const payload = (await res.json()) as Paginated<WalletTransaction>;
      setRows(payload?.data ?? []);
    } catch {
      setError("Impossible de charger l'historique DBWallet");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <AdminShell title="DBWallet" subtitle="Historique des transactions">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            placeholder="Wallet ID (DBW-...)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email client"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Référence"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">Tous types</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">Tous statuts</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm text-slate-500">
          {loading ? "Chargement..." : `${rows.length} transaction(s)`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Wallet ID</th>
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Montant</th>
                <th className="pb-2 pr-4">Statut</th>
                <th className="pb-2 pr-4">Référence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-slate-500">
                    Aucune transaction.
                  </td>
                </tr>
              )}
              {rows.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-4 text-xs text-slate-500">{tx.created_at ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-700">{tx.wallet?.wallet_id ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <div className="text-sm font-medium text-slate-700">{tx.wallet?.user?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{tx.wallet?.user?.email ?? "—"}</div>
                  </td>
                  <td className="py-2 pr-4">{tx.type ?? "—"}</td>
                  <td className="py-2 pr-4">{formatAmount(tx.amount)}</td>
                  <td className="py-2 pr-4">{tx.status ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">{tx.reference ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
