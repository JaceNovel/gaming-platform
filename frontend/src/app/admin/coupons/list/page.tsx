"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Coupon = {
  id: number;
  name?: string | null;
  code?: string | null;
  type?: "percent" | "fixed" | null;
  discount_percent?: number | string | null;
  discount_value?: number | string | null;
  max_uses?: number | null;
  uses_count?: number | null;
  is_active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
  expires_at?: string | null;
};

type CouponsResponse = {
  data: Coupon[];
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

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR");
};

const formatValue = (coupon: Coupon) => {
  if (coupon.type === "fixed") {
    const val = Number(coupon.discount_value ?? 0);
    return `${val.toLocaleString()} FCFA`;
  }
  const percent = Number(coupon.discount_percent ?? 0);
  return `${percent}%`;
};

const isActive = (coupon: Coupon) => {
  if (!coupon.is_active) return false;
  const now = Date.now();
  const start = coupon.starts_at ? new Date(coupon.starts_at).getTime() : null;
  const endRaw = coupon.ends_at ?? coupon.expires_at ?? null;
  const end = endRaw ? new Date(endRaw).getTime() : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  if (coupon.max_uses !== null && coupon.max_uses !== undefined) {
    if ((coupon.uses_count ?? 0) >= coupon.max_uses) return false;
  }
  return true;
};

export default function AdminCouponsListPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(buildUrl("/admin/coupons", { per_page: "100" }), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("Impossible de charger les codes promo");
      const payload = (await res.json()) as CouponsResponse;
      setCoupons(payload?.data ?? []);
    } catch {
      setError("Impossible de charger les codes promo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return coupons;
    return coupons.filter((coupon) =>
      [coupon.name, coupon.code]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(term))
    );
  }, [coupons, search]);

  const handleDelete = async (id: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/coupons/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Suppression impossible");
      await loadCoupons();
    } catch {
      setError("Suppression impossible");
    } finally {
      setLoading(false);
    }
  };

  const actions = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative w-full max-w-xl">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher des codes promo..."
          className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2 text-sm text-slate-700"
        />
      </div>
      <Link
        href="/admin/coupons/add"
        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm text-white"
      >
        <Plus className="h-4 w-4" />
        Créer un code promo
      </Link>
    </div>
  );

  return (
    <AdminShell title="Gestion des Codes Promo" subtitle="Codes promo actifs" actions={actions}>
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Valeur</th>
              <th className="px-4 py-3">Utilisations</th>
              <th className="px-4 py-3">Validité</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((coupon) => (
              <tr key={coupon.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{coupon.code ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {coupon.type === "fixed" ? "Montant" : "Pourcentage"}
                </td>
                <td className="px-4 py-3 text-slate-700">{formatValue(coupon)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(coupon.uses_count ?? 0)}/{coupon.max_uses ?? "∞"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(coupon.starts_at)} - {formatDate(coupon.ends_at ?? coupon.expires_at)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      isActive(coupon)
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {isActive(coupon) ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/coupons/${coupon.id}`}
                      className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-700"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(coupon.id)}
                      className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  {loading ? "Chargement..." : "Aucun code promo"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
