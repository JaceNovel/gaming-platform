"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toDisplayImageSrc } from "@/lib/imageProxy";
import { Download, Plus, Search, Pencil, Trash2 } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type ProductImage = {
  id: number;
  url?: string | null;
  position?: number | null;
};

type Product = {
  id: number;
  sku?: string | null;
  name?: string | null;
  description?: string | null;
  details?: {
    image?: string | null;
    banner?: string | null;
    cover?: string | null;
  } | null;
  category?: string | null;
  category_id?: number | null;
  price?: number | string | null;
  price_fcfa?: number | null;
  stock?: number | null;
  sold_count?: number | null;
  is_active?: boolean | null;
  images?: ProductImage[];
};

type Category = {
  id: number;
  name: string;
};

type ProductsResponse = {
  data: Product[];
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

const formatPrice = (value?: number | string | null) => {
  const numberValue = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat("fr-FR").format(numberValue);
};

export default function AdminProductsListPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(buildUrl("/admin/categories"), {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) return;
      const payload = (await res.json()) as CategoriesResponse;
      setCategories(payload?.data ?? []);
    } catch {
      // ignore
    }
  }, []);

  const loadProducts = useCallback(async (term = "", category = "all") => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        buildUrl("/products", {
          active: "0",
          per_page: "100",
          q: term,
          category: category === "all" ? "" : category,
        })
      );
      if (!res.ok) {
        throw new Error("Impossible de charger les produits");
      }
      const payload = (await res.json()) as ProductsResponse;
      setProducts(payload?.data ?? []);
    } catch (err) {
      setError("Impossible de charger les produits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(search.trim(), categoryFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [categoryFilter, loadProducts, search]);

  const handleExport = () => {
    if (!products.length) return;
    const rows = [
      ["id", "sku", "name", "category", "price", "stock", "sold"].join(","),
      ...products.map((product) =>
        [
          product.id,
          product.sku ?? "",
          `"${(product.name ?? "").replaceAll("\"", "'")}"`,
          `"${(product.category ?? "").replaceAll("\"", "'")}"`,
          product.price_fcfa ?? product.price ?? 0,
          product.stock ?? 0,
          product.sold_count ?? 0,
        ].join(",")
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `produits-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleDelete = async (productId?: number) => {
    if (!productId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/products/${productId}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) {
        throw new Error("Suppression impossible");
      }
      await loadProducts(search.trim(), categoryFilter);
    } catch (err) {
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
          href="/admin/products/add"
          className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm text-white"
        >
          <Plus className="h-4 w-4" />
          Ajouter un produit
        </Link>
      </div>
    </div>
  );

  return (
    <AdminShell title="Produits" subtitle="Liste des produits" actions={actions}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher des produits..."
              className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2 text-sm text-slate-700"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="all">Toutes les catégories</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
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
                <th className="px-4 py-3">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                </th>
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Prix</th>
                <th className="px-4 py-3">Quantité</th>
                <th className="px-4 py-3">Ventes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const imageUrl =
                  product.details?.image ??
                  product.details?.cover ??
                  product.details?.banner ??
                  product.images?.[0]?.url ??
                  null;
                const sold = product.sold_count ?? 0;
                const stock = product.stock ?? 0;
                const salesPercent = stock > 0 ? Math.min(100, Math.round((sold / stock) * 100)) : 0;
                return (
                  <tr key={product.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                          {imageUrl ? (
                            <img
                              src={toDisplayImageSrc(imageUrl) ?? imageUrl}
                              alt={product.name ?? "Produit"}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                              Img
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{product.name ?? "Produit"}</div>
                          <div className="text-xs text-slate-500">
                            ID: {product.sku ?? product.id}
                          </div>
                          {product.description && (
                            <div className="mt-1 text-xs text-slate-400">
                              {product.description.length > 48
                                ? `${product.description.slice(0, 48)}...`
                                : product.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{product.category ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatPrice(product.price_fcfa ?? product.price)} FCFA
                    </td>
                    <td className="px-4 py-3 text-slate-600">{stock}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-slate-500">{sold} Ventes</div>
                      <div className="mt-2 h-2 w-24 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-rose-400"
                          style={{ width: `${salesPercent}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-700"
                          aria-label="Modifier le produit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!products.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                    {loading ? "Chargement..." : "Aucun produit"}
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
