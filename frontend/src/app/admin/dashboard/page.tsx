"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Package, ShoppingCart, Users } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type OverviewResponse = {
  data: {
    revenue_total: number;
    total_orders: number;
    total_products: number;
    total_customers: number;
    conversion_rate: number | null;
    avg_order_value: number;
    failed_payments_count: number;
    pending_orders_count: number;
    available_redeems_by_category: Record<string, number>;
  };
};

type RevenueResponse = {
  data: {
    labels: string[];
    values: number[];
  };
};

type RecentOrder = {
  order_id: number;
  reference?: string | null;
  customer?: { name?: string | null; email?: string | null };
  products: string[];
  date?: string | null;
  amount: number;
  status?: string | null;
  payment_status?: string | null;
};

type RecentOrdersResponse = {
  data: RecentOrder[];
};

type AdminMeResponse = {
  data: {
    id: number;
    name: string;
    email: string;
    role: string;
    permissions: string[];
  };
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
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
  if (!value && value !== 0) return "—";
  return `${Math.round(value).toLocaleString()} FCFA`;
};

const statusColor = (status?: string | null) => {
  const normalized = String(status ?? "").toLowerCase();
  if (["paid", "success", "completed", "fulfilled"].includes(normalized)) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (["failed", "canceled", "cancelled"].includes(normalized)) {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-amber-100 text-amber-700";
};

const buildLinePath = (values: number[], width = 520, height = 180) => {
  if (!values.length) return "";
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1 || 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * height;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
};

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminMeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const fetchJson = useCallback(async <T,>(path: string, params: Record<string, string> = {}): Promise<T> => {
    const res = await fetch(buildUrl(path, params), {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });

    if (!res.ok) {
      throw new Error(`Erreur ${res.status}`);
    }

    return res.json();
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewRes, revenueRes, recentRes, meRes] = await Promise.all([
        fetchJson<OverviewResponse>("/admin/stats/overview"),
        fetchJson<RevenueResponse>("/admin/stats/revenue", { range: "month" }),
        fetchJson<RecentOrdersResponse>("/admin/orders/recent", { limit: "10" }),
        fetchJson<AdminMeResponse>("/admin/me"),
      ]);

      setOverview(overviewRes);
      setRevenue(revenueRes);
      setRecentOrders(recentRes?.data ?? []);
      setAdminProfile(meRes);
    } catch (err) {
      setError("Impossible de charger le dashboard admin.");
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const chartLabels = revenue?.data?.labels ?? [];
  const chartValues = revenue?.data?.values ?? [];
  const chartPath = useMemo(() => buildLinePath(chartValues), [chartValues]);

  const kpis = useMemo(() => {
    const data = overview?.data;
    return [
      {
        label: "Revenu Total",
        value: formatAmount(data?.revenue_total),
        icon: CreditCard,
        accent: "bg-emerald-100 text-emerald-600",
      },
      {
        label: "Total des Commandes",
        value: data?.total_orders ?? "—",
        icon: ShoppingCart,
        accent: "bg-blue-100 text-blue-600",
      },
      {
        label: "Total des Produits",
        value: data?.total_products ?? "—",
        icon: Package,
        accent: "bg-orange-100 text-orange-600",
      },
      {
        label: "Total des Clients",
        value: data?.total_customers ?? "—",
        icon: Users,
        accent: "bg-purple-100 text-purple-600",
      },
    ];
  }, [overview]);

  return (
    <AdminShell title="Tableau de bord administratif" subtitle="Bienvenue ! Voici votre aperçu.">
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold">{card.value}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.accent}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-xs text-emerald-500">↑ 0.0%</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Aperçu des Revenus</h2>
            <span className="text-xs text-slate-400">30 derniers jours</span>
          </div>
          <div className="mt-6">
            <svg viewBox="0 0 520 180" className="h-48 w-full">
              <path d={chartPath} fill="none" stroke="#3b82f6" strokeWidth="3" />
              {chartValues.map((value, index) => {
                const max = Math.max(...chartValues, 1);
                const x = (520 / (chartValues.length - 1 || 1)) * index;
                const y = 180 - (value / max) * 180;
                return <circle key={`${x}-${y}`} cx={x} cy={y} r={4} fill="#3b82f6" />;
              })}
            </svg>
            <div className="mt-4 flex justify-between text-xs text-slate-400">
              {chartLabels.slice(0, 6).map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Commandes Récentes</h2>
            <span className="text-xs text-slate-400">Derniers achats</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  <th className="pb-2">ID de commande</th>
                  <th className="pb-2">Client</th>
                  <th className="pb-2">Produit</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Montant</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.order_id} className="border-t border-slate-100">
                    <td className="py-3 text-slate-700">{order.reference ?? order.order_id}</td>
                    <td className="py-3 text-slate-700">
                      <div className="font-medium">{order.customer?.name ?? "—"}</div>
                      <div className="text-xs text-slate-400">{order.customer?.email ?? ""}</div>
                    </td>
                    <td className="py-3 text-slate-700">
                      {order.products?.[0] ?? "—"}
                    </td>
                    <td className="py-3 text-slate-500">
                      {order.date ? new Date(order.date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 font-semibold text-slate-700">
                      {formatAmount(order.amount)}
                      <span
                        className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${statusColor(order.payment_status)}`}
                      >
                        {order.payment_status ?? "pending"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!recentOrders.length && (
                  <tr>
                    <td className="py-6 text-center text-sm text-slate-400" colSpan={5}>
                      {loading ? "Chargement..." : "Aucune commande récente"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
