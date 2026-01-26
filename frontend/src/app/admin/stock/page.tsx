"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Product = {
  id: number;
  name?: string | null;
  stock?: number | null;
  sold_count?: number | null;
  type?: string | null;
};

type ProductsResponse = {
  data: Product[];
};

type Denomination = {
  id: number;
  code?: string | null;
  label?: string | null;
  product?: { id: number; name?: string | null } | null;
  available_count?: number | null;
  reserved_count?: number | null;
  assigned_count?: number | null;
};

type DenomsResponse = {
  data: Denomination[];
};

type StockMovement = {
  id: number;
  product?: { id: number; name?: string | null } | null;
  denomination?: { id: number; code?: string | null } | null;
  quantity?: number | null;
  direction?: string | null;
  reason?: string | null;
  admin?: { email?: string | null } | null;
  created_at?: string | null;
};

type MovementsResponse = {
  data: StockMovement[];
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

export default function AdminStockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [denoms, setDenoms] = useState<Denomination[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productsRes, denomsRes, movementsRes] = await Promise.all([
        fetch(buildUrl("/products", { per_page: "200", active: "0" })),
        fetch(`${API_BASE}/admin/redeem-codes/denominations`, {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }),
        fetch(buildUrl("/admin/stock/movements", { per_page: "50" }), {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }),
      ]);

      if (!productsRes.ok || !denomsRes.ok || !movementsRes.ok) {
        throw new Error("Impossible de charger le stock");
      }

      const productsPayload = (await productsRes.json()) as ProductsResponse;
      const denomsPayload = (await denomsRes.json()) as DenomsResponse;
      const movementsPayload = (await movementsRes.json()) as MovementsResponse;

      setProducts(productsPayload?.data ?? []);
      setDenoms(denomsPayload?.data ?? []);
      setMovements(movementsPayload?.data ?? []);
    } catch (err) {
      setError("Impossible de charger le stock");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return (
    <AdminShell title="Stock / Inventaire" subtitle="Produits, codes et mouvements">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm text-slate-500">
          {loading ? "Chargement..." : `${products.length} produit(s)`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Produit</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Stock</th>
                <th className="pb-2 pr-4">Vendus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    Aucun produit.
                  </td>
                </tr>
              )}
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-4">#{product.id}</td>
                  <td className="py-2 pr-4">{product.name ?? "—"}</td>
                  <td className="py-2 pr-4">{product.type ?? "—"}</td>
                  <td className="py-2 pr-4">{product.stock ?? 0}</td>
                  <td className="py-2 pr-4">{product.sold_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm text-slate-500">Stock codes</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Produit</th>
                <th className="pb-2 pr-4">Dénomination</th>
                <th className="pb-2 pr-4">Dispo</th>
                <th className="pb-2 pr-4">Réservé</th>
                <th className="pb-2 pr-4">Assigné</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {denoms.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-slate-500">
                    Aucun code.
                  </td>
                </tr>
              )}
              {denoms.map((denom) => (
                <tr key={denom.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-4">#{denom.id}</td>
                  <td className="py-2 pr-4">{denom.product?.name ?? "—"}</td>
                  <td className="py-2 pr-4">{denom.label ?? denom.code ?? "—"}</td>
                  <td className="py-2 pr-4">{denom.available_count ?? 0}</td>
                  <td className="py-2 pr-4">{denom.reserved_count ?? 0}</td>
                  <td className="py-2 pr-4">{denom.assigned_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm text-slate-500">Mouvements récents</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Produit</th>
                <th className="pb-2 pr-4">Code</th>
                <th className="pb-2 pr-4">Quantité</th>
                <th className="pb-2 pr-4">Direction</th>
                <th className="pb-2 pr-4">Raison</th>
                <th className="pb-2 pr-4">Admin</th>
                <th className="pb-2 pr-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-4 text-slate-500">
                    Aucun mouvement.
                  </td>
                </tr>
              )}
              {movements.map((movement) => (
                <tr key={movement.id} className="hover:bg-slate-50">
                  <td className="py-2 pr-4">#{movement.id}</td>
                  <td className="py-2 pr-4">{movement.product?.name ?? "—"}</td>
                  <td className="py-2 pr-4">{movement.denomination?.code ?? "—"}</td>
                  <td className="py-2 pr-4">{movement.quantity ?? 0}</td>
                  <td className="py-2 pr-4">{movement.direction ?? "—"}</td>
                  <td className="py-2 pr-4">{movement.reason ?? "—"}</td>
                  <td className="py-2 pr-4">{movement.admin?.email ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-500">{movement.created_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
