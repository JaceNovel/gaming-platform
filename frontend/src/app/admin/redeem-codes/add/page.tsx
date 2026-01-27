"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Denomination = {
  id: number;
  product_id?: number | null;
  code?: string | null;
  label?: string | null;
  product?: { id: number; name?: string | null; sku?: string | null } | null;
};

type DenomsResponse = { data: Denomination[] };

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  headers.Accept = "application/json";
  headers["X-Requested-With"] = "XMLHttpRequest";
  return headers;
};

export default function AdminRedeemCodesAddPage() {
  const [denoms, setDenoms] = useState<Denomination[]>([]);
  const [productId, setProductId] = useState("");
  const [denomId, setDenomId] = useState("");
  const [codes, setCodes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingDenoms, setLoadingDenoms] = useState(false);

  const products = Array.from(
    denoms
      .filter((d) => d.product && (d.product_id ?? d.product?.id) != null)
      .reduce((acc, denom) => {
        const id = denom.product_id ?? denom.product!.id;
        acc.set(id, denom.product!);
        return acc;
      }, new Map<number, NonNullable<Denomination["product"]>>())
      .entries(),
  )
    .map(([id, product]) => ({ id, name: product.name ?? `Produit ${id}`, sku: product.sku ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredDenoms = denoms
    .filter((d) => {
      if (!productId) return false;
      if (productId === "__unlinked__") return (d.product_id ?? null) == null;
      return String(d.product_id ?? d.product?.id ?? "") === productId;
    })
    .sort((a, b) => {
      const aLabel = (a.label ?? a.code ?? "").toLowerCase();
      const bLabel = (b.label ?? b.code ?? "").toLowerCase();
      return aLabel.localeCompare(bLabel);
    });

  const loadDenoms = useCallback(async () => {
    setLoadingDenoms(true);
    try {
      const res = await fetch(`${API_BASE}/admin/redeem-codes/denominations`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
      if (!res.ok) return;
      const payload = (await res.json()) as any;
      const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      setDenoms(items);
    } finally {
      setLoadingDenoms(false);
    }
  }, []);

  useEffect(() => {
    loadDenoms();
  }, [loadDenoms]);

  useEffect(() => {
    // If there's only one denom for this product, auto-select it.
    if (!denomId && filteredDenoms.length === 1) {
      setDenomId(String(filteredDenoms[0].id));
    }
    // If the selected denom doesn't belong to the current filter, clear it.
    if (denomId && !filteredDenoms.some((d) => String(d.id) === denomId)) {
      setDenomId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, denoms]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");

    if (!denomId) {
      setStatus("Sélectionnez une dénomination.");
      return;
    }

    if (!codes.trim() && !file) {
      setStatus("Collez des codes ou ajoutez un fichier.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("denomination_id", denomId);
      if (codes.trim()) {
        formData.append("codes", codes.trim());
      }
      if (file) {
        formData.append("file", file);
      }

      const res = await fetch(`${API_BASE}/admin/redeem-codes/import`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        setStatus(msg?.message ?? "Import impossible");
        return;
      }

      const payload = await res.json();
      setStatus(`Importés: ${payload?.imported ?? 0}, doublons: ${payload?.duplicates ?? 0}`);
      setCodes("");
      setFile(null);
    } catch {
      setStatus("Import impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminShell title="Ajouter des codes" subtitle="Import des Redeem Codes">
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold">Importer des codes</h3>
          <div className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Produit</label>
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setDenomId("");
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                required
                disabled={loadingDenoms}
              >
                <option value="">{loadingDenoms ? "Chargement..." : "Sélectionner un produit"}</option>
                {products.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.sku ? `${p.name} (${p.sku})` : p.name}
                  </option>
                ))}
                {denoms.some((d) => (d.product_id ?? null) == null) && (
                  <option value="__unlinked__">Sans produit (non lié)</option>
                )}
              </select>
              {!loadingDenoms && denoms.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Aucun produit/denomination disponible. Vérifiez votre connexion admin ou créez une denomination côté backend.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Dénomination</label>
              <select
                value={denomId}
                onChange={(e) => setDenomId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                required
                disabled={loadingDenoms || !productId}
              >
                <option value="">
                  {!productId
                    ? "Choisissez d'abord un produit"
                    : loadingDenoms
                      ? "Chargement..."
                      : filteredDenoms.length
                        ? "Sélectionner une dénomination"
                        : "Aucune dénomination pour ce produit"}
                </option>
                {filteredDenoms.map((denom) => (
                  <option key={denom.id} value={String(denom.id)}>
                    {denom.label ?? denom.code ?? `Dénomination ${denom.id}`}
                  </option>
                ))}
              </select>
              {productId && !loadingDenoms && filteredDenoms.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Aucune dénomination liée. Liez d'abord une dénomination à ce produit côté backend.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Codes (une ligne par code)</label>
              <textarea
                value={codes}
                onChange={(e) => setCodes(e.target.value)}
                rows={8}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                placeholder="ABC-123-XYZ\nDEF-456-XYZ"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Fichier .txt/.csv</label>
              <input
                type="file"
                accept=".txt,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold">Résumé</h3>
            <p className="mt-2 text-sm text-slate-500">
              Collez vos codes ou importez un fichier. Les doublons seront ignorés automatiquement.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
            >
              {loading ? "Import..." : "Importer"}
            </button>
            {status && <p className="mt-3 text-sm text-slate-500">{status}</p>}
          </div>
        </div>
      </form>
    </AdminShell>
  );
}
