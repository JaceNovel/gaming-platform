"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type LowStockItem = {
  denomination_id: number;
  product_id: number;
  product_name?: string | null;
  label?: string | null;
  available: number;
  threshold?: number | null;
};

type LowStockResponse = { data: LowStockItem[] };

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminRedeemLowStockPage() {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [error, setError] = useState("");

  const loadLowStock = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/redeem-codes/low-stock`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("Erreur");
      const payload = (await res.json()) as LowStockResponse;
      setItems(payload?.data ?? []);
    } catch {
      setError("Impossible de charger les alertes de stock");
    }
  }, []);

  useEffect(() => {
    loadLowStock();
  }, [loadLowStock]);

  return (
    <AdminShell title="Low Stock" subtitle="Produits à réapprovisionner">
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Dénomination</th>
              <th className="px-4 py-3">Stock dispo</th>
              <th className="px-4 py-3">Seuil</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.denomination_id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-700">{item.product_name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{item.label ?? "—"}</td>
                <td className="px-4 py-3 text-rose-600 font-semibold">{item.available}</td>
                <td className="px-4 py-3 text-slate-600">{item.threshold ?? "—"}</td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                  Aucun stock bas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
