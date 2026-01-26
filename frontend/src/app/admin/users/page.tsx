"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Plus, Search, Download } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  country_code?: string | null;
  country_name?: string | null;
  role?: string | null;
  is_premium?: boolean | null;
  total_spent?: number | string | null;
  last_order_at?: string | null;
};

type UsersResponse = {
  data: AdminUser[];
  meta?: {
    current_page: number;
    per_page: number;
    total: number;
  };
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async (term = "", role = "all") => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        buildUrl("/admin/users", {
          name: term,
          email: term,
          role: role === "all" ? "" : role,
          per_page: "100",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );
      if (!res.ok) {
        throw new Error("Impossible de charger les utilisateurs");
      }
      const data = (await res.json()) as UsersResponse;
      setUsers(data?.data ?? []);
    } catch (err) {
      setError("Impossible de charger les utilisateurs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers(search.trim(), roleFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [loadUsers, roleFilter, search]);

  const filteredUsers = useMemo(() => {
    if (statusFilter === "all") return users;
    return users.filter((user) => {
      const isActive = Number(user.total_spent ?? 0) > 0;
      return statusFilter === "active" ? isActive : !isActive;
    });
  }, [statusFilter, users]);

  const handleExport = async () => {
    const res = await fetch(buildUrl("/admin/users/export"), {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      setError("Export impossible");
      return;
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const actions = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="relative w-full max-w-xl">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Recherche rapide..."
          className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2 text-sm text-slate-700"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
          Filtres
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="all">Tous les rôles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="support">Support</option>
          <option value="customer">Client</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          <option value="all">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="new">Nouveaux</option>
        </select>
        <button
          onClick={() => {
            setSearch("");
            setRoleFilter("all");
            setStatusFilter("all");
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
        >
          Réinitialiser
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
        >
          <Download className="h-4 w-4" />
          Télécharger
        </button>
        <button className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm text-white">
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>
    </div>
  );

  return (
    <AdminShell title="Utilisateurs" subtitle="Gestion des comptes clients" actions={actions}>
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Localisation</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Dépensé</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {user.name?.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="font-medium text-slate-800">{user.name}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3 text-slate-600">
                  {user.country_name ?? user.country_code ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {Number(user.total_spent ?? 0) > 0 ? "active" : "new"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {Number(user.total_spent ?? 0).toLocaleString()} FCFA
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-700"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {!filteredUsers.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  {loading ? "Chargement..." : "Aucun utilisateur"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
