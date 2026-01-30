"use client";

import { useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type CouponPayload = {
  name: string;
  code: string;
  type: "percent" | "fixed";
  discount_percent?: number;
  discount_value?: number;
  starts_at?: string;
  ends_at?: string;
  max_uses?: number | null;
  is_active?: boolean;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminCouponsAddPage() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(() => getAuthHeaders(), []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    setLoading(true);

    const numericValue = Number(value);
    const finalName = name.trim() || code.trim().toUpperCase();

    const payload: CouponPayload = {
      name: finalName,
      code: code.trim().toUpperCase(),
      type,
      discount_percent: type === "percent" ? numericValue : undefined,
      discount_value: type === "fixed" ? numericValue : undefined,
      starts_at: startsAt || undefined,
      ends_at: endsAt || undefined,
      max_uses: maxUses ? Number(maxUses) : null,
      is_active: isActive,
    };

    try {
      const res = await fetch(`${API_BASE}/admin/coupons`, {
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

      setName("");
      setCode("");
      setType("percent");
      setValue("");
      setStartsAt("");
      setEndsAt("");
      setMaxUses("");
      setIsActive(true);
      setStatus("Code promo créé.");
    } catch {
      setStatus("Création impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Créer un code promo" subtitle="Ajoutez un code promo">
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Informations de base</h3>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Nom</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  placeholder="WELCOME10"
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
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Configuration</h3>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Type</label>
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
                  placeholder={type === "percent" ? "10" : "5000"}
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
                  placeholder="Illimité"
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
              {loading ? "Création..." : "Créer le code promo"}
            </button>
            {status && <p className="mt-3 text-center text-sm text-slate-500">{status}</p>}
          </div>
        </div>
      </form>
    </AdminShell>
  );
}
