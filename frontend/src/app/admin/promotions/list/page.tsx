"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, Search, Pencil, Trash2 } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Promotion = {
  id: number;
  name?: string | null;
  code?: string | null;
  description?: string | null;
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

type PromotionsResponse = {
  data: Promotion[];
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

const formatValue = (promo: Promotion) => {
  if (promo.type === "fixed") {
    const val = Number(promo.discount_value ?? 0);
    return `${val.toLocaleString()} FCFA`;
  }
  const percent = Number(promo.discount_percent ?? 0);
  return `${percent}%`;
};

const isActive = (promo: Promotion) => {
  if (!promo.is_active) return false;
  const now = Date.now();
  const start = promo.starts_at ? new Date(promo.starts_at).getTime() : null;
  const endRaw = promo.ends_at ?? promo.expires_at ?? null;
  const end = endRaw ? new Date(endRaw).getTime() : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  if (promo.max_uses !== null && promo.max_uses !== undefined) {
    if ((promo.uses_count ?? 0) >= promo.max_uses) return false;
  }
  return true;
};

export default function AdminPromotionsListPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPromotions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(buildUrl("/admin/promotions", { per_page: "100" }), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("Impossible de charger les promotions");
      const payload = (await res.json()) as PromotionsResponse;
      setPromotions(payload?.data ?? []);
    } catch {
      setError("Impossible de charger les promotions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPromotions();
  }, [loadPromotions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return promotions;
    return promotions.filter((promo) =>
      [promo.name, promo.code, promo.description]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(term))
    );
  }, [promotions, search]);

  const handleExport = () => {
    if (!filtered.length) return;
    const rows = [
      ["id", "name", "code", "type", "value", "uses", "status"].join(","),
      ...filtered.map((promo) =>
        [
          promo.id,
          `"${(promo.name ?? "").replaceAll("\"", "'")}"`,
          promo.code ?? "",
          promo.type ?? "percent",
          promo.type === "fixed" ? promo.discount_value ?? 0 : promo.discount_percent ?? 0,
          `${promo.uses_count ?? 0}/${promo.max_uses ?? "∞"}`,
          isActive(promo) ? "active" : "inactive",
        ].join(",")
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `promotions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleDelete = async (id: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/promotions/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Suppression impossible");
      await loadPromotions();
    } catch {
      setError("Suppression impossible");
    } finally {
      setLoading(false);
    }
  };

  const actions = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
        >
          <Download className="h-4 w-4" />
          Exporter
        </button>
        <Link
          href="/admin/promotions/add"
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" />
          Ajouter une promotion
        </Link>
      </div>
    </div>
  );

  return (
    <AdminShell title="Promotions" subtitle="Gérez les promotions" actions={actions}>
      <div className="space-y-4">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher des promotions..."
            className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2 text-sm text-slate-700"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Valeur</th>
                <th className="px-4 py-3">Utilisation</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Période</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((promo) => (
                <tr key={promo.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{promo.name ?? "Promotion"}</div>
                    {promo.description && (
                      <div className="mt-1 text-xs text-slate-500">
                        {promo.description.length > 90
                          ? `${promo.description.slice(0, 90)}...`
                          : promo.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {promo.code ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {promo.type === "fixed" ? "Montant fixe" : "Pourcentage"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatValue(promo)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {(promo.uses_count ?? 0)}/{promo.max_uses ?? "∞"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs ${
                        isActive(promo)
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isActive(promo) ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>Début: {formatDate(promo.starts_at)}</div>
                    <div>Fin: {formatDate(promo.ends_at ?? promo.expires_at)}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/promotions/${promo.id}`}
                        className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(promo.id)}
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
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                    {loading ? "Chargement..." : "Aucune promotion"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
