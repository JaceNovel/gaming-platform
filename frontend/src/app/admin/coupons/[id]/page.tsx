"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Coupon = {
  id: number;
  name?: string | null;
  code?: string | null;
  type?: "percent" | "fixed" | null;
  discount_percent?: number | string | null;
  discount_value?: number | string | null;
  max_uses?: number | null;
  uses_count?: number | null;
  is_active?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

type CouponResponse = {
  data: Coupon;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminCouponsEditPage() {
  const params = useParams();
  const couponId = String(params?.id ?? "");
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

  const loadCoupon = useCallback(async () => {
    if (!couponId) return;
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch(`${API_BASE}/admin/coupons/${couponId}`, {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
      });
      if (!res.ok) throw new Error("Impossible de charger le code promo");
      const payload = (await res.json()) as CouponResponse;
      const coupon = payload?.data;
      if (!coupon) return;
      setName(coupon.name ?? "");
      setCode(coupon.code ?? "");
      setType((coupon.type as "percent" | "fixed") ?? "percent");
      setValue(
        String(
          coupon.type === "fixed" ? coupon.discount_value ?? "" : coupon.discount_percent ?? ""
        )
      );
      setStartsAt(coupon.starts_at?.slice(0, 10) ?? "");
      setEndsAt(coupon.ends_at?.slice(0, 10) ?? "");
      setMaxUses(coupon.max_uses ? String(coupon.max_uses) : "");
      setIsActive(Boolean(coupon.is_active));
    } catch {
      setStatus("Impossible de charger le code promo");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, couponId]);

  useEffect(() => {
    loadCoupon();
  }, [loadCoupon]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    setLoading(true);

    const numericValue = Number(value);
    const payload = {
      name: name.trim(),
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
      const res = await fetch(`${API_BASE}/admin/coupons/${couponId}`, {
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

      setStatus("Code promo mis à jour.");
    } catch {
      setStatus("Mise à jour impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Modifier un code promo" subtitle="Mettre à jour le code promo">
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
