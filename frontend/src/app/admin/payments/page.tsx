"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Payment = {
  id: number;
  order_id?: number | null;
  transaction_id?: string | null;
  amount?: number | null;
  status?: string | null;
  created_at?: string | null;
  order?: { id?: number | null; user?: { name?: string | null; email?: string | null } | null } | null;
};

type PaymentsResponse = {
  data: Payment[];
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

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [transactionId, setTransactionId] = useState("");

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        buildUrl("/admin/payments", {
          per_page: "50",
          status: status === "all" ? "" : status,
          transaction_id: transactionId.trim(),
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );
      if (!res.ok) throw new Error("Impossible de charger les paiements");
      const payload = (await res.json()) as PaymentsResponse;
      setPayments(payload?.data ?? []);
    } catch (err) {
      setError("Impossible de charger les paiements");
    } finally {
      setLoading(false);
    }
  }, [status, transactionId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPayments();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadPayments]);

  return (
    <AdminShell title="Paiements" subtitle="Historique des paiements">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="Transaction ID"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">Tous statuts</option>
            <option value="paid">Paid</option>
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
        <div className="mb-3 text-sm text-slate-500">{loading ? "Chargement..." : `${payments.length} paiement(s)`}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Commande</th>
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4">Montant</th>
                <th className="pb-2 pr-4">Statut</th>
                <th className="pb-2 pr-4">Transaction</th>
                <th className="pb-2 pr-4">Créé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-slate-500">
                    Aucun paiement.
                  </td>
                </tr>
              )}
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-4">#{payment.id}</td>
                  <td className="py-2 pr-4">{payment.order_id ?? payment.order?.id ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <div className="text-sm font-medium text-slate-700">
                      {payment.order?.user?.name ?? "—"}
                    </div>
                    <div className="text-xs text-slate-500">{payment.order?.user?.email ?? "—"}</div>
                  </td>
                  <td className="py-2 pr-4">{formatAmount(payment.amount)}</td>
                  <td className="py-2 pr-4">{payment.status ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-600">{payment.transaction_id ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{payment.created_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
