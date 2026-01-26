"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Category = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
};

type CategoriesResponse = {
  data: Category[];
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

const isImageUrl = (value?: string | null) =>
  !!value && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/"));

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(buildUrl("/admin/categories"), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("Impossible de charger les catégories");
      const payload = (await res.json()) as CategoriesResponse;
      setCategories(payload?.data ?? []);
    } catch {
      setError("Impossible de charger les catégories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((category) =>
      [category.name, category.slug, category.description].some((value) =>
        String(value ?? "").toLowerCase().includes(term)
      )
    );
  }, [categories, search]);

  const handleDelete = async (id: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/categories/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Suppression impossible");
      await loadCategories();
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
          placeholder="Rechercher des catégories..."
          className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2 text-sm text-slate-700"
        />
      </div>
      <Link
        href="/admin/categories/add"
        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm text-white"
      >
        <Plus className="h-4 w-4" />
        Ajouter une catégorie
      </Link>
    </div>
  );

  return (
    <AdminShell title="Catégories" subtitle="Gérez les catégories" actions={actions}>
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((category) => (
              <tr key={category.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg">
                    {isImageUrl(category.icon) ? (
                      <Image
                        src={category.icon as string}
                        alt={category.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 object-contain"
                      />
                    ) : (
                      <span>{category.icon ?? "🧩"}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{category.name}</td>
                <td className="px-4 py-3 text-slate-600">{category.slug}</td>
                <td className="px-4 py-3 text-slate-500">
                  {category.description ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-700">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
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
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  {loading ? "Chargement..." : "Aucune catégorie"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
