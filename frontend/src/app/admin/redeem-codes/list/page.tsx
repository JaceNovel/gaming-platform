"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type RedeemCode = {
  id: number;
  code?: string | null;
  status?: string | null;
  denomination?: { id: number; label?: string | null; product?: { name?: string | null } | null } | null;
  assigned_order_id?: number | null;
  assigned_user?: { email?: string | null } | null;
  assignedUser?: { email?: string | null } | null;
  assigned_at?: string | null;
};

type Denomination = {
  id: number;
  label?: string | null;
  product?: { id: number; name?: string | null } | null;
};

type CodesResponse = {
  data: RedeemCode[];
};

type DenomsResponse = {
  data: Denomination[];
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const maskCode = (code?: string | null) => {
  if (!code) return "—";
  if (code.length <= 6) return "****";
  return `${code.slice(0, 4)}****${code.slice(-4)}`;
};

export default function AdminRedeemCodesListPage() {
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [denoms, setDenoms] = useState<Denomination[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [denomId, setDenomId] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDenoms = useCallback(async () => {
    const res = await fetch(`${API_BASE}/admin/redeem-codes/denominations`, {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) return;
    const payload = (await res.json()) as DenomsResponse;
    setDenoms(payload?.data ?? []);
  }, []);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("code", search.trim());
      if (status !== "all") params.set("status", status);
      if (denomId !== "all") params.set("denomination_id", denomId);

      const res = await fetch(`${API_BASE}/admin/redeem-codes?${params.toString()}`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("Impossible de charger les codes");
      const payload = (await res.json()) as CodesResponse;
      setCodes(payload?.data ?? []);
    } catch {
      setError("Impossible de charger les codes");
    } finally {
      setLoading(false);
    }
  }, [denomId, search, status]);

  useEffect(() => {
    loadDenoms();
  }, [loadDenoms]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCodes();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadCodes]);

  const actions = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-xl">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un code..."
          className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2 text-sm text-slate-700"
        />
      </div>
      <select
        value={denomId}
        onChange={(e) => setDenomId(e.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
      >
        <option value="all">Tous les produits</option>
        {denoms.map((denom) => (
          <option key={denom.id} value={String(denom.id)}>
            {denom.product?.name ?? denom.label ?? `Denomination ${denom.id}`}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
      >
        <option value="all">Tous statuts</option>
        <option value="available">Disponible</option>
        <option value="assigned">Assigné</option>
        <option value="sent">Envoyé</option>
        <option value="used">Utilisé</option>
        <option value="expired">Invalidé</option>
      </select>
    </div>
  );

  return (
    <AdminShell title="Redeem Codes" subtitle="Stock et livraisons" actions={actions}>
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
              <th className="px-4 py-3">Produit</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Commande</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Assigné</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{maskCode(item.code)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {item.denomination?.product?.name ?? item.denomination?.label ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{item.status ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{item.assigned_order_id ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {item.assignedUser?.email ?? item.assigned_user?.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{item.assigned_at ?? "—"}</td>
              </tr>
            ))}
            {!codes.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  {loading ? "Chargement..." : "Aucun code"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
