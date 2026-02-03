"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type WalletAccount = {
  id: number;
  wallet_id?: string | null;
  recharge_blocked_at?: string | null;
  recharge_blocked_reason?: string | null;
  user?: { id?: number | null; name?: string | null; email?: string | null } | null;
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

export default function AdminDbWalletFraudPage() {
  const [rows, setRows] = useState<WalletAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const [walletIdToBlock, setWalletIdToBlock] = useState("");
  const [blockReason, setBlockReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/dbwallet/blocked?per_page=50`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("load failed");
      const payload = (await res.json()) as Paginated<WalletAccount>;
      setRows(payload?.data ?? []);
    } catch {
      setError("Impossible de charger la liste");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const block = async () => {
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/dbwallet/block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ wallet_id: walletIdToBlock.trim(), reason: blockReason.trim() || null }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus(payload?.message ?? "Blocage impossible");
        return;
      }
      setStatus("Blocage effectué");
      setWalletIdToBlock("");
      setBlockReason("");
      load();
    } catch {
      setStatus("Erreur réseau");
    }
  };

  const unblock = async (walletId: string) => {
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/dbwallet/unblock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ wallet_id: walletId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus(payload?.message ?? "Déblocage impossible");
        return;
      }
      setStatus("Déblocage effectué");
      load();
    } catch {
      setStatus("Erreur réseau");
    }
  };

  return (
    <AdminShell title="DBWallet" subtitle="Fraude / blocage des recharges">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 max-w-2xl">
        <div className="text-sm text-slate-600 font-semibold">Bloquer définitivement les recharges</div>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={walletIdToBlock}
            onChange={(e) => setWalletIdToBlock(e.target.value)}
            placeholder="Wallet ID (DBW-...)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Raison (optionnel)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={block}
          disabled={!walletIdToBlock.trim()}
          className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Bloquer
        </button>
        {status && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {status}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm text-slate-500">{loading ? "Chargement..." : `${rows.length} wallet(s) bloqué(s)`}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-2 pr-4">Wallet ID</th>
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4">Raison</th>
                <th className="pb-2 pr-4">Bloqué le</th>
                <th className="pb-2 pr-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    Aucun wallet bloqué.
                  </td>
                </tr>
              )}
              {rows.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-4 text-xs text-slate-700">{w.wallet_id ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <div className="text-sm font-medium text-slate-700">{w.user?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{w.user?.email ?? "—"}</div>
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-600">{w.recharge_blocked_reason ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{w.recharge_blocked_at ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <button
                      onClick={() => unblock(String(w.wallet_id ?? ""))}
                      disabled={!w.wallet_id}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Débloquer
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
