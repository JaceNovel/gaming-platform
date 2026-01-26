"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Promotion = {
  id: number;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  type?: "percent" | "fixed" | null;
  discount_percent?: number | string | null;
  discount_value?: number | string | null;
  max_uses?: number | null;
  uses_count?: number | null;
  is_active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

type PromotionResponse = {
  data: Promotion;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminPromotionsEditPage() {
  const params = useParams();
  const promotionId = String(params?.id ?? "");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(() => getAuthHeaders(), []);

  const loadPromotion = useCallback(async () => {
    if (!promotionId) return;
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch(`${API_BASE}/admin/promotions/${promotionId}`, {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
      });
      if (!res.ok) throw new Error("Impossible de charger la promotion");
      const payload = (await res.json()) as PromotionResponse;
      const promo = payload?.data;
      if (!promo) return;
      setName(promo.name ?? "");
      setCode(promo.code ?? "");
      setDescription(promo.description ?? "");
      setType((promo.type as "percent" | "fixed") ?? "percent");
      setValue(
        String(
          promo.type === "fixed" ? promo.discount_value ?? "" : promo.discount_percent ?? ""
        )
      );
      setStartsAt(promo.starts_at?.slice(0, 10) ?? "");
      setEndsAt(promo.ends_at?.slice(0, 10) ?? "");
      setMaxUses(promo.max_uses ? String(promo.max_uses) : "");
      setIsActive(Boolean(promo.is_active));
    } catch {
      setStatus("Impossible de charger la promotion");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, promotionId]);

  useEffect(() => {
    loadPromotion();
  }, [loadPromotion]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    setLoading(true);

    const numericValue = Number(value);
    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      type,
      discount_percent: type === "percent" ? numericValue : undefined,
      discount_value: type === "fixed" ? numericValue : undefined,
      starts_at: startsAt || undefined,
      ends_at: endsAt || undefined,
      max_uses: maxUses ? Number(maxUses) : null,
      is_active: isActive,
    };

    try {
      const res = await fetch(`${API_BASE}/admin/promotions/${promotionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setStatus(msg?.message ?? "Mise à jour impossible");
        return;
      }

      setStatus("Promotion mise à jour.");
    } catch {
      setStatus("Mise à jour impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Modifier une promotion" subtitle="Mettre à jour la promotion">
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Informations de base</h3>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Nom de la promotion *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Code promo *</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={6}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Configuration</h3>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Type de promotion</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "percent" | "fixed")}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                >
                  <option value="percent">Pourcentage</option>
                  <option value="fixed">Montant fixe</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Valeur</label>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  type="number"
                  min="0"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Période et limites</h3>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Date de début</label>
                <input
                  type="date"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Date de fin</label>
                <input
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Limite d'utilisation</label>
                <input
                  type="number"
                  min="0"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              </div>
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
              {loading ? "En cours..." : "Mettre à jour"}
            </button>
            {status && <p className="mt-3 text-center text-sm text-slate-500">{status}</p>}
          </div>
        </div>
      </form>
    </AdminShell>
  );
}
