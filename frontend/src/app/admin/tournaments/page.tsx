"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Tournament = {
  id: number;
  name: string;
  slug: string;
  status: string;
  is_free?: boolean;
  is_active?: boolean;
  prize_pool_fcfa?: number;
  entry_fee_fcfa?: number;
};

type ResponsePayload = {
  data?: Tournament[];
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(value)));

export default function AdminTournamentsPage() {
  const [items, setItems] = useState<Tournament[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/tournaments?per_page=100`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("Chargement impossible");
      const payload = (await res.json()) as ResponsePayload;
      setItems(Array.isArray(payload?.data) ? payload.data : []);
    } catch {
      setError("Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => [item.name, item.slug, item.status].some((v) => String(v ?? "").toLowerCase().includes(term)));
  }, [items, search]);

  const handleDelete = async (id: number) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/tournaments/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Suppression impossible");
      await load();
    } catch {
      setError("Suppression impossible");
      setLoading(false);
    }
  };

  return (
    <AdminShell
      title="Tournois"
      subtitle="Gérez les tournois gaming"
      actions={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un tournoi..."
              className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2 text-sm text-slate-700"
            />
          </div>
          <Link href="/admin/tournaments/add" className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm text-white">
            <Plus className="h-4 w-4" />
            Ajouter un tournoi
          </Link>
        </div>
      }
    >
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Prix</th>
              <th className="px-4 py-3">Inscription</th>
              <th className="px-4 py-3">Actif</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                <td className="px-4 py-3 text-slate-600">{item.slug}</td>
                <td className="px-4 py-3 text-slate-600">{item.status}</td>
                <td className="px-4 py-3 text-slate-600">{formatNumber(Number(item.prize_pool_fcfa ?? 0))} FCFA</td>
                <td className="px-4 py-3 text-slate-600">{item.is_free ? "Gratuite" : `${formatNumber(Number(item.entry_fee_fcfa ?? 0))} FCFA`}</td>
                <td className="px-4 py-3 text-slate-600">{item.is_active ? "Oui" : "Non"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-rose-500"
                    aria-label={`Supprimer ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}

            {!filtered.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  {loading ? "Chargement..." : "Aucun tournoi"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
