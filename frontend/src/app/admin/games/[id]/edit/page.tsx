"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type GamePayload = {
  id: number;
  name?: string;
  slug?: string;
  category?: string | null;
  description?: string | null;
  image?: string | null;
  is_active?: boolean | null;
  sort_order?: number | null;
  enabled_for_recharge?: boolean | null;
  enabled_for_subscription?: boolean | null;
  enabled_for_marketplace?: boolean | null;
};

type GamesResponse = {
  data?: GamePayload[];
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminGamesEditPage() {
  const params = useParams<{ id: string }>();
  const gameId = params?.id;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [enabledForRecharge, setEnabledForRecharge] = useState(false);
  const [enabledForSubscription, setEnabledForSubscription] = useState(false);
  const [enabledForMarketplace, setEnabledForMarketplace] = useState(false);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [status, setStatus] = useState("");

  const canSubmit = useMemo(() => !!name.trim() && !!category.trim() && !!gameId, [name, category, gameId]);

  useEffect(() => {
    if (!gameId) return;
    let active = true;

    const loadGame = async () => {
      setInitialLoading(true);
      setStatus("");
      try {
        const res = await fetch(`${API_BASE}/admin/games`, {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        });
        if (!res.ok) throw new Error("Chargement impossible");

        const payload = (await res.json()) as GamesResponse;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const found = rows.find((row) => String(row.id) === String(gameId));
        if (!found) throw new Error("Jeu introuvable");

        if (!active) return;
        setName(String(found.name ?? ""));
        setSlug(String(found.slug ?? ""));
        setSortOrder(String(Number(found.sort_order ?? 0)));
        setCategory(String(found.category ?? ""));
        setDescription(String(found.description ?? ""));
        setImage(String(found.image ?? ""));
        setIsActive(Boolean(found.is_active ?? true));
        setEnabledForRecharge(Boolean(found.enabled_for_recharge ?? false));
        setEnabledForSubscription(Boolean(found.enabled_for_subscription ?? false));
        setEnabledForMarketplace(Boolean(found.enabled_for_marketplace ?? false));
      } catch {
        if (active) setStatus("Chargement impossible");
      } finally {
        if (active) setInitialLoading(false);
      }
    };

    void loadGame();
    return () => {
      active = false;
    };
  }, [gameId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("");
    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        sort_order: Number(sortOrder || 0),
        enabled_for_recharge: enabledForRecharge,
        enabled_for_subscription: enabledForSubscription,
        enabled_for_marketplace: enabledForMarketplace,
        category: category.trim(),
        description: description.trim() || undefined,
        image: image.trim() || undefined,
        is_active: isActive,
      };

      const res = await fetch(`${API_BASE}/admin/games/${encodeURIComponent(gameId as string)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        setStatus(err?.message ?? "Mise à jour impossible");
        return;
      }

      setStatus("Jeu mis à jour.");
    } catch {
      setStatus("Mise à jour impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Modifier un jeu" subtitle="Mettre à jour les informations du jeu">
      {initialLoading ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Chargement...</div> : null}

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <label className="text-sm font-medium">Nom *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Ordre</label>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Catégorie *</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="Action, RPG, etc."
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Image (URL)</label>
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-sm font-medium">Menus</label>
            <div className="mt-2 space-y-2 rounded-xl border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={enabledForRecharge}
                  onChange={(e) => setEnabledForRecharge(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Recharge
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={enabledForSubscription}
                  onChange={(e) => setEnabledForSubscription(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Abonnement
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={enabledForMarketplace}
                  onChange={(e) => setEnabledForMarketplace(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Marketplace
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Actif
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Mise à jour..." : "Enregistrer les modifications"}
          </button>
          {status && <p className="mt-3 text-center text-sm text-slate-500">{status}</p>}
        </div>
      </form>
    </AdminShell>
  );
}
