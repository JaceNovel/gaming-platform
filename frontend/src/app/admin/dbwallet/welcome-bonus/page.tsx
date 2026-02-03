"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type BonusRow = {
  user_id: number;
  email: string;
  created_at?: string | null;
  wallet_id: string;
  bonus_balance: number;
  bonus_expires_at?: string | null;
  bonus_active: boolean;
  already_granted: boolean;
};

type BonusListResponse = {
  data: BonusRow[];
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminDbWalletWelcomeBonusPage() {
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [walletId, setWalletId] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/dbwallet/welcome-bonus`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("load failed");
      const payload = (await res.json()) as BonusListResponse;
      setRows(payload?.data ?? []);
    } catch {
      setError("Impossible de charger la liste des 20 premiers utilisateurs");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grant = async () => {
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/dbwallet/welcome-bonus/grant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ wallet_id: walletId.trim(), amount }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus(payload?.message ?? "Attribution impossible");
        return;
      }
      setStatus("Welcome bonus attribué");
      setWalletId("");
      setAmount(0);
      load();
    } catch {
      setStatus("Erreur réseau");
    }
  };

  return (
    <AdminShell title="DBWallet" subtitle="Welcome Bonus (20 premiers utilisateurs)">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 max-w-3xl">
        <div className="text-sm text-slate-600">
          Règles: <span className="font-semibold">20 premiers utilisateurs</span>, validité <span className="font-semibold">24h</span>,
          utilisable uniquement pour les produits recharge.
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            placeholder="Wallet ID (DBW-...)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            placeholder="Montant (FCFA)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button
            onClick={grant}
            disabled={!walletId.trim() || amount <= 0}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Attribuer
          </button>
        </div>

        {status && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{status}</div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm text-slate-500">{loading ? "Chargement..." : `${rows.length} utilisateur(s)`}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Wallet ID</th>
                <th className="pb-2 pr-4">Bonus</th>
                <th className="pb-2 pr-4">Expire</th>
                <th className="pb-2 pr-4">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-slate-500">
                    Aucun résultat.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.user_id} className="hover:bg-slate-50">
                  <td className="py-2 pr-4">#{r.user_id}</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">{r.email}</td>
                  <td className="py-2 pr-4 text-xs text-slate-700">{r.wallet_id}</td>
                  <td className="py-2 pr-4">{Math.round(r.bonus_balance).toLocaleString()} FCFA</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{r.bonus_expires_at ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {r.already_granted ? (
                      <span className="text-xs font-semibold text-slate-700">Déjà attribué</span>
                    ) : (
                      <span className="text-xs text-slate-500">Éligible</span>
                    )}
                    {r.bonus_active ? <span className="ml-2 text-xs font-semibold text-emerald-700">(actif)</span> : null}
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
