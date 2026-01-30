"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type RedeemLot = {
  id: number;
  code?: string | null;
  label?: string | null;
  supplier?: string | null;
  purchase_price_fcfa?: number | null;
  received_at?: string | null;
  created_at?: string | null;
  denomination?: {
    id: number;
    label?: string | null;
    code?: string | null;
    product?: { id: number; name?: string | null; sku?: string | null } | null;
  } | null;
  total_codes?: number | null;
  available_count?: number | null;
  assigned_count?: number | null;
  expired_count?: number | null;
};

type LotsResponse = {
  data: RedeemLot[];
  current_page?: number;
  last_page?: number;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  headers.Accept = "application/json";
  headers["X-Requested-With"] = "XMLHttpRequest";
  return headers;
};

export default function AdminRedeemLotsListPage() {
  const [lots, setLots] = useState<RedeemLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadLots = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/redeem-lots?per_page=50`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("Impossible de charger les lots");
      const payload = (await res.json().catch(() => ({}))) as LotsResponse;
      setLots(Array.isArray(payload?.data) ? payload.data : []);
    } catch {
      setError("Impossible de charger les lots");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  const actions = (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm text-slate-500">{loading ? "Chargement..." : `${lots.length} lot(s)`}</div>
      <Link
        href="/admin/redeem-lots/add"
        className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
      >
        Nouveau lot
      </Link>
    </div>
  );

  return (
    <AdminShell title="Lots Redeem" subtitle="Traçabilité des imports" actions={actions}>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Lot</th>
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Dispo</th>
              <th className="px-4 py-3">Assigné</th>
              <th className="px-4 py-3">Invalidé</th>
              <th className="px-4 py-3">Reçu</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{lot.code ?? `Lot #${lot.id}`}</div>
                  <div className="text-xs text-slate-500">{lot.label ?? lot.supplier ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{lot.denomination?.product?.name ?? lot.denomination?.label ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700">{lot.available_count ?? 0}</td>
                <td className="px-4 py-3 text-slate-700">{lot.assigned_count ?? 0}</td>
                <td className="px-4 py-3 text-slate-700">{lot.expired_count ?? 0}</td>
                <td className="px-4 py-3 text-slate-500">{lot.received_at ?? lot.created_at ?? "—"}</td>
              </tr>
            ))}

            {!loading && lots.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  Aucun lot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
