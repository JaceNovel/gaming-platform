"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Search, Trash2 } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Game = {
  id: number;
  name: string;
  slug: string;
  category?: string | null;
  description?: string | null;
  image?: string | null;
  is_active?: boolean | null;
};

type GamesResponse = {
  data: Game[];
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const isImageUrl = (value?: string | null) =>
  !!value && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/"));

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/games`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) throw new Error("Impossible de charger les jeux");
      const payload = (await res.json()) as GamesResponse;
      setGames(payload?.data ?? []);
    } catch {
      setError("Impossible de charger les jeux");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return games;
    return games.filter((game) =>
      [game.name, game.slug, game.category].some((value) =>
        String(value ?? "").toLowerCase().includes(term)
      )
    );
  }, [games, search]);

  const handleDelete = async (id: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/games/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Suppression impossible");
      await loadGames();
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
          placeholder="Rechercher des jeux..."
          className="w-full rounded-xl border border-slate-200 bg-white px-10 py-2 text-sm text-slate-700"
        />
      </div>
      <Link
        href="/admin/games/add"
        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm text-white"
      >
        <Plus className="h-4 w-4" />
        Ajouter un jeu
      </Link>
    </div>
  );

  return (
    <AdminShell title="Jeux" subtitle="Gérez les jeux" actions={actions}>
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
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Actif</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((game) => (
              <tr key={game.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg">
                    {isImageUrl(game.image) ? (
                      <Image
                        src={game.image as string}
                        alt={game.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 object-contain"
                      />
                    ) : (
                      <span>🎮</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{game.name}</td>
                <td className="px-4 py-3 text-slate-600">{game.slug}</td>
                <td className="px-4 py-3 text-slate-500">{game.category ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{game.is_active ? "Oui" : "Non"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleDelete(game.id)}
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
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  {loading ? "Chargement..." : "Aucun jeu"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
