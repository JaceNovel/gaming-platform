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
