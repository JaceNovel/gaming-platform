"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Denomination = {
  id: number;
  label?: string | null;
  code?: string | null;
  product?: { id: number; name?: string | null; sku?: string | null } | null;
};

type DenomsResponse = {
  data: Denomination[];
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  headers.Accept = "application/json";
  headers["X-Requested-With"] = "XMLHttpRequest";
  return headers;
};

export default function AdminRedeemLotsAddPage() {
  const router = useRouter();
  const [denoms, setDenoms] = useState<Denomination[]>([]);
  const [denomId, setDenomId] = useState("");

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [supplier, setSupplier] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const denomOptions = useMemo(() => {
    return (denoms ?? []).map((d) => {
      const name = d.product?.name ?? d.label ?? d.code ?? `Denom ${d.id}`;
      const sku = d.product?.sku ? ` (${d.product.sku})` : "";
      return { id: d.id, label: `${name}${sku}` };
    });
  }, [denoms]);

  const loadDenoms = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/redeem-codes/denominations`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) return;
      const payload = (await res.json().catch(() => ({}))) as DenomsResponse;
      setDenoms(payload?.data ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadDenoms();
  }, [loadDenoms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("");

    if (!denomId) {
      setStatus("Sélectionnez une dénomination.");
      return;
    }

    setLoading(true);
    try {
      const body = {
        denomination_id: Number(denomId),
        code: code.trim() || undefined,
        label: label.trim() || undefined,
        supplier: supplier.trim() || undefined,
        purchase_price_fcfa: purchasePrice ? Number(purchasePrice) : undefined,
      };

      const res = await fetch(`${API_BASE}/admin/redeem-lots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(payload?.message ?? "Création impossible");
        return;
      }

      setStatus("Lot créé.");
      router.push("/admin/redeem-lots/list");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Création impossible";
      setStatus(message || "Création impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Nouveau lot" subtitle="Créer un lot (optionnel) pour traçabilité">
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold">Informations lot</h3>
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Dénomination</label>
              <select
                value={denomId}
                onChange={(e) => setDenomId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                required
              >
                <option value="">Sélectionner</option>
                {denomOptions.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Code lot (optionnel)</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                placeholder="LOT-2026-01"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Label (optionnel)</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                placeholder="Free Fire - Janvier"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Fournisseur (optionnel)</label>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                placeholder="Fournisseur"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Prix achat (FCFA) (optionnel)</label>
              <input
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                placeholder="0"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Action</h3>
            <p className="mt-2 text-sm text-slate-500">
              Tu peux ensuite importer les codes et renseigner le champ &quot;lot_code&quot; (ou &quot;lot_id&quot;) dans l’import.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
            >
              {loading ? "Création..." : "Créer"}
            </button>
            {status && <p className="mt-3 text-sm text-slate-500">{status}</p>}
          </div>
        </div>
      </form>
    </AdminShell>
  );
}
