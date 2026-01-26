"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type CategoryPayload = {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  is_active?: boolean;
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

export default function AdminCategoriesAddPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(() => getAuthHeaders(), []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    setImageFile(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    setLoading(true);

    const payload: CategoryPayload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      description: description.trim() || undefined,
      icon: icon.trim() || undefined,
      is_active: isActive,
    };

    try {
      const res = await fetch(buildUrl("/admin/categories"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setStatus(msg?.message ?? "Création impossible");
        return;
      }

      const created = await res.json().catch(() => ({}));
      const categoryId = created?.id ?? created?.data?.id;

      if (categoryId && imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        const upload = await fetch(`${API_BASE}/admin/categories/${categoryId}/image`, {
          method: "POST",
          headers: {
            ...authHeaders,
          },
          body: formData,
        });
        if (!upload.ok) {
          setStatus("Catégorie créée, mais upload image échoué.");
        }
      }

      setName("");
      setSlug("");
      setDescription("");
      setIcon("");
      setIsActive(true);
      setImagePreview(null);
      setImageFile(null);
      setStatus("Catégorie créée.");
    } catch {
      setStatus("Création impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Ajouter une catégorie" subtitle="Ajoutez une nouvelle catégorie">
      <div className="mb-4 text-sm text-slate-500">
        <Link href="/admin/categories" className="hover:text-slate-700">
          ← Retour aux catégories
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
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
                  placeholder="auto si vide"
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
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Image</h3>
            <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 px-6 py-10 text-center">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Prévisualisation"
                  className="h-32 w-32 rounded-2xl object-cover"
                />
              ) : (
                <div className="text-sm text-slate-400">Choose a file or drag and drop</div>
              )}
              <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm text-white">
                Choose File
                <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
              </label>
              <p className="mt-4 text-xs text-slate-400">Image (4MB)</p>
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium">Image URL ou emoji</label>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                placeholder="https://... ou 😀"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Actif
            </label>
            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
            >
              {loading ? "En cours..." : "Créer la catégorie"}
            </button>
            {status && <p className="mt-3 text-center text-sm text-slate-500">{status}</p>}
          </div>
        </div>
      </form>
    </AdminShell>
  );
}
