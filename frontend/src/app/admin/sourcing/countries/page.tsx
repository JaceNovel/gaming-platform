"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type SupplierCountry = {
  id: number;
  platform: "alibaba" | "aliexpress";
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminSourcingCountriesPage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") === "aliexpress" ? "aliexpress" : "alibaba";
  const platformLabel = platform === "aliexpress" ? "AliExpress" : "Alibaba";
  const [countries, setCountries] = useState<SupplierCountry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const resetForm = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setSortOrder("0");
    setIsActive(true);
  };

  const loadCountries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/countries?platform=${platform}`, {
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`Impossible de charger les pays ${platformLabel}`);
      const payload = await res.json();
      setCountries(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err: any) {
      setError(err?.message ?? `Impossible de charger les pays ${platformLabel}`);
    } finally {
      setLoading(false);
    }
  }, [platform, platformLabel]);

  useEffect(() => {
    loadCountries();
  }, [loadCountries]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const isEditing = editingId !== null;
      const res = await fetch(`${API_BASE}/admin/sourcing/countries${isEditing ? `/${editingId}` : ""}`, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          platform,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          is_active: isActive,
          sort_order: Number(sortOrder || 0),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Enregistrement impossible");
      }
      resetForm();
      setSuccess(isEditing ? "Pays mis a jour." : "Pays ajoute.");
      await loadCountries();
    } catch (err: any) {
      setError(err?.message ?? "Enregistrement impossible");
    }
  };

  const startEditing = (country: SupplierCountry) => {
    setEditingId(country.id);
    setCode(country.code);
    setName(country.name);
    setSortOrder(String(country.sort_order ?? 0));
    setIsActive(Boolean(country.is_active));
  };

  const removeCountry = async (countryId: number) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/countries/${countryId}`, {
        method: "DELETE",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Suppression impossible");
      setSuccess("Pays supprime.");
      if (editingId === countryId) resetForm();
      await loadCountries();
    } catch (err: any) {
      setError(err?.message ?? "Suppression impossible");
    }
  };

  return (
    <AdminShell title={platformLabel} subtitle="Pays disponibles pour l'approvisionnement par plateforme">
      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">{editingId !== null ? "Modifier un pays" : "Ajouter un pays"}</h2>
            {editingId !== null ? (
              <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                Annuler
              </button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Code ISO</span>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={2} className="rounded-xl border border-slate-200 px-3 py-2" required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Nom</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Ordre</span>
              <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Actif
            </label>
            <button type="submit" className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white">
              {editingId !== null ? "Mettre a jour" : "Enregistrer"}
            </button>
            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Pays configures</h2>
              <p className="text-sm text-slate-500">Liste active pour {platformLabel}.</p>
            </div>
            <button type="button" onClick={loadCountries} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Rafraichir
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Pays</th>
                  <th className="pb-3 pr-4">Code</th>
                  <th className="pb-3 pr-4">Ordre</th>
                  <th className="pb-3 pr-4">Statut</th>
                  <th className="pb-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && countries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-slate-500">Aucun pays configure.</td>
                  </tr>
                ) : null}
                {countries.map((country) => (
                  <tr key={country.id}>
                    <td className="py-3 pr-4 font-medium text-slate-900">{country.name}</td>
                    <td className="py-3 pr-4 text-xs text-slate-600">{country.code}</td>
                    <td className="py-3 pr-4 text-xs text-slate-600">{country.sort_order ?? 0}</td>
                    <td className="py-3 pr-4 text-xs text-slate-600">{country.is_active ? "Actif" : "Inactif"}</td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEditing(country)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700">
                          Modifier
                        </button>
                        <button type="button" onClick={() => removeCountry(country.id)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs text-rose-700">
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}