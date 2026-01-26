"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type OrderItem = {
  id: number;
  quantity?: number | null;
  price?: number | null;
  product?: { name?: string | null } | null;
};

type Order = {
  id: number;
  reference?: string | null;
  status?: string | null;
  total_price?: number | null;
  created_at?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
  payment?: { status?: string | null } | null;
  order_items?: OrderItem[];
};

type OrdersResponse = {
  data: Order[];
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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        buildUrl("/admin/orders", {
          per_page: "50",
          status: status === "all" ? "" : status,
          payment_status: paymentStatus === "all" ? "" : paymentStatus,
          email: email.trim(),
          reference: reference.trim(),
          from,
          to,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );
      if (!res.ok) throw new Error("Impossible de charger les commandes");
      const payload = (await res.json()) as OrdersResponse;
      setOrders(payload?.data ?? []);
    } catch (err) {
      setError("Impossible de charger les commandes");
    } finally {
      setLoading(false);
    }
  }, [email, from, paymentStatus, reference, status, to]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadOrders]);

  const rows = useMemo(() => orders ?? [], [orders]);

  return (
    <AdminShell title="Commandes" subtitle="Toutes les commandes clients">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
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
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">Tous statuts</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="paid_but_out_of_stock">Paid but out of stock</option>
          </select>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">Paiement</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm text-slate-500">{loading ? "Chargement..." : `${rows.length} commande(s)`}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4">Commande</th>
                <th className="pb-2 pr-4">Montant</th>
                <th className="pb-2 pr-4">Statut</th>
                <th className="pb-2 pr-4">Paiement</th>
                <th className="pb-2 pr-4">Créée</th>
                <th className="pb-2 pr-4">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-slate-500">
                    Aucune commande.
                  </td>
                </tr>
              )}
              {rows.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-4">#{order.id}</td>
                  <td className="py-2 pr-4">
                    <div className="text-sm font-medium text-slate-700">
                      {order.user?.name ?? "—"}
                    </div>
                    <div className="text-xs text-slate-500">{order.user?.email ?? "—"}</div>
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-600">
                    <div className="font-medium">{order.reference ?? "—"}</div>
                    <div className="mt-1 line-clamp-2">
                      {(order.order_items ?? [])
                        .map((item) => `${item.product?.name ?? "Produit"} x${item.quantity ?? 1}`)
                        .join(", ") || "—"}
                    </div>
                  </td>
                  <td className="py-2 pr-4">{formatAmount(order.total_price)}</td>
                  <td className="py-2 pr-4">{order.status ?? "—"}</td>
                  <td className="py-2 pr-4">{order.payment?.status ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{order.created_at ?? "—"}</td>
                  <td className="py-2 pr-4">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700"
                    >
                      Voir
                    </Link>
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
