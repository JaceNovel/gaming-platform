"use client";

import { useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminDbWalletRechargePage() {
  const [walletId, setWalletId] = useState("");
  const [verifyEmail, setVerifyEmail] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const submit = async () => {
    setStatus(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/dbwallet/credit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          wallet_id: walletId.trim(),
          verify_email: verifyEmail.trim(),
          amount,
          reason: reason.trim() || null,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus(payload?.message ?? "Recharge impossible.");
        return;
      }

      const data = payload?.data;
      setStatus(
        `OK: +${Math.round(Number(data?.amount ?? amount)).toLocaleString()} FCFA sur ${String(
          data?.wallet_id ?? walletId
        )} (ref: ${String(data?.reference ?? "—")})`
      );
    } catch {
      setStatus("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="DBWallet" subtitle="Recharge manuelle (admin)">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 max-w-2xl">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm text-slate-600">Wallet ID</label>
            <input
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              placeholder="DBW-..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600">Vérifier Email</label>
            <input
              value={verifyEmail}
              onChange={(e) => setVerifyEmail(e.target.value)}
              placeholder="email@client.com"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-400">Mesure anti-fraude: doit correspondre à l’email du compte.</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600">Montant (FCFA)</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600">Motif (optionnel)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: recharge manuelle suite demande support"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          onClick={submit}
          disabled={loading || !walletId.trim() || !verifyEmail.trim() || amount <= 0}
          className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Traitement..." : "Valider la recharge"}
        </button>

        {status && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {status}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
