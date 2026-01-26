"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Product = {
  id: number;
  name?: string | null;
  likes_count?: number | null;
};

type ProductsResponse = {
  data: Product[];
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminOffersPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [minLikes, setMinLikes] = useState("50");
  const [maxLikes, setMaxLikes] = useState("60");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/products?active=0&per_page=200`);
      if (!res.ok) return;
      const payload = (await res.json()) as ProductsResponse;
      setProducts(payload?.data ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const selectedProduct = useMemo(
    () => products.find((product) => String(product.id) === productId),
    [productId, products]
  );

  const handlePreset = (min: number, max: number) => {
    setMinLikes(String(min));
    setMaxLikes(String(max));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");

    if (!productId) {
      setStatus("Sélectionnez un produit.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/offers/likes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          product_id: Number(productId),
          min: Number(minLikes),
          max: Number(maxLikes),
        }),
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setStatus(msg?.message ?? "Impossible d'ajouter les likes.");
        return;
      }

      const payload = await res.json();
      const added = payload?.data?.added ?? 0;
      const total = payload?.data?.total_likes ?? 0;
      setStatus(`+${added} likes ajoutés. Total: ${total}`);
      await loadProducts();
    } catch {
      setStatus("Impossible d'ajouter les likes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Offres" subtitle="Boost des likes produits">
      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold">Attribuer des likes automatiquement</h3>
          <p className="mt-2 text-sm text-slate-500">
            Choisissez un produit et une plage (ex: 50-60 ou 100-200) pour booster les likes.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Produit</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                required
              >
                <option value="">Sélectionner un produit</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name ?? `Produit #${product.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Min</label>
                <input
                  type="number"
                  min="1"
                  value={minLikes}
                  onChange={(e) => setMinLikes(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Max</label>
                <input
                  type="number"
                  min="1"
                  value={maxLikes}
                  onChange={(e) => setMaxLikes(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handlePreset(50, 60)}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600"
              >
                50-60
              </button>
              <button
                type="button"
                onClick={() => handlePreset(100, 200)}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600"
              >
                100-200
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
            >
              {loading ? "En cours..." : "Ajouter les likes"}
            </button>
            {status && <p className="text-sm text-slate-500">{status}</p>}
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold">Résumé</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Produit sélectionné</span>
              <span className="font-semibold text-slate-800">
                {selectedProduct?.name ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Likes actuels</span>
              <span className="font-semibold text-slate-800">{selectedProduct?.likes_count ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
