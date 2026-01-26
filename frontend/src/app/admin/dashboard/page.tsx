"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Boxes,
  CreditCard,
  Gift,
  Headset,
  Heart,
  Key,
  LayoutDashboard,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Star,
  Tags,
  TicketPercent,
  Users,
  Mail,
} from "lucide-react";
import Link from "next/link";
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

const MENU_ITEMS = [
  { label: "Tableau de bord", icon: LayoutDashboard, href: "/admin/dashboard" },
  { label: "Utilisateurs", icon: Users, href: "/admin/users" },
  { label: "Produits", icon: Package, href: "/admin/products" },
  { label: "Catégories", icon: Tags, href: "/admin/categories" },
  { label: "Promotions", icon: TicketPercent, href: "/admin/promotions" },
  { label: "Codes Promo", icon: Gift, href: "/admin/coupons" },
  { label: "Offres / VIP", icon: Heart, href: "/admin/offers" },
  { label: "Redeem Codes", icon: Key, href: "/admin/redeem" },
  { label: "Commandes", icon: ShoppingCart, href: "/admin/orders" },
  { label: "Paiements", icon: CreditCard, href: "/admin/payments" },
  { label: "Stock / Inventaire", icon: Boxes, href: "/admin/stock" },
  { label: "Email", icon: Mail, href: "/admin/email" },
  { label: "Support Client", icon: Headset, href: "/admin/support" },
  { label: "Avis Clients", icon: Star, href: "/admin/reviews" },
  { label: "Paramètres", icon: Settings, href: "/admin/settings" },
];

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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        <aside className="hidden min-h-screen w-64 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
          <div className="flex items-center gap-3 text-lg font-semibold text-slate-900">
            <div className="h-10 w-10 rounded-2xl bg-slate-100" />
            Admin
          </div>
          <nav className="mt-8 space-y-1">
            {MENU_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto pt-6 text-xs text-slate-400">Powered by Gestionnaire</div>
        </aside>

        <main className="flex-1 px-6 py-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <button className="rounded-lg border border-slate-200 p-2 lg:hidden">
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-red-500">Tableau de bord administratif</h1>
                <p className="text-sm text-slate-500">Bienvenue ! Voici votre aperçu.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 md:flex">
                <Search className="h-4 w-4" />
                Rechercher...
              </div>
              <button className="rounded-full border border-slate-200 p-2 text-slate-500">
                <Bell className="h-4 w-4" />
              </button>
              <button className="rounded-full border border-slate-200 p-2 text-slate-500">
                <Heart className="h-4 w-4" />
              </button>
              <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xs font-semibold">
                {adminProfile?.data?.name?.slice(0, 2)?.toUpperCase() ?? "AD"}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        </main>
      </div>
    </div>
  );
}
