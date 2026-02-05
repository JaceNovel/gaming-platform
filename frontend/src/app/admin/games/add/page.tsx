"use client";

import { useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminGamesAddPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [icon, setIcon] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [enabledRecharge, setEnabledRecharge] = useState(true);
  const [enabledSubscription, setEnabledSubscription] = useState(true);
  const [enabledMarketplace, setEnabledMarketplace] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim() || undefined,
        category: category.trim(),
        description: description.trim() || undefined,
        image: image.trim() || undefined,
        icon: icon.trim() || undefined,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        enabled_for_recharge: enabledRecharge,
        enabled_for_subscription: enabledSubscription,
        enabled_for_marketplace: enabledMarketplace,
        is_active: isActive,
      };

      const res = await fetch(`${API_BASE}/admin/games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus(err?.message ?? "Création impossible");
        return;
      }

      setName("");
      setSlug("");
      setCategory("");
      setDescription("");
      setImage("");
      setIcon("");
      setSortOrder(0);
      setEnabledRecharge(true);
      setEnabledSubscription(true);
      setEnabledMarketplace(true);
      setIsActive(true);
      setStatus("Jeu ajouté.");
    } catch {
      setStatus("Création impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Ajouter un jeu" subtitle="Créer un nouveau jeu">
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
            <label className="text-sm font-medium">Slug (optionnel)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="auto si vide"
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
            <label className="text-sm font-medium">Icône (URL)</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Ordre (menu)</label>
            <input
              value={String(sortOrder)}
              onChange={(e) => setSortOrder(Math.max(0, Math.round(Number(e.target.value) || 0)))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              inputMode="numeric"
            />
            <p className="mt-1 text-xs text-slate-500">Plus petit = plus haut dans les menus.</p>
          </div>

          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Affichage par menu</p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={enabledRecharge}
                onChange={(e) => setEnabledRecharge(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Recharges
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={enabledSubscription}
                onChange={(e) => setEnabledSubscription(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Abonnements
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={enabledMarketplace}
                onChange={(e) => setEnabledMarketplace(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Comptes Gaming (Marketplace)
            </label>
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
            disabled={loading}
            className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
          >
            {loading ? "Ajout..." : "Ajouter le jeu"}
          </button>
          {status && <p className="mt-3 text-center text-sm text-slate-500">{status}</p>}
        </div>
      </form>
    </AdminShell>
  );
}
