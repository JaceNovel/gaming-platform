"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Product = {
  id: number;
  name?: string | null;
  sku?: string | null;
};

type Denomination = {
  id: number;
  product_id?: number | null;
  code?: string | null;
  label?: string | null;
  product?: { id: number; name?: string | null; sku?: string | null } | null;
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

const normalizeList = <T,>(payload: any): T[] => {
  if (Array.isArray(payload?.data)) return payload.data as T[];
  if (Array.isArray(payload)) return payload as T[];
  return [];
};

export default function AdminRedeemCodesAddPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [codes, setCodes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const productOptions = useMemo(() => {
    return (products ?? [])
      .map((p) => ({ id: p.id, name: p.name ?? `Produit ${p.id}`, sku: p.sku ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch(`${API_BASE}/products?active=0&per_page=200`);
      if (!res.ok) return;
      const payload = await res.json().catch(() => ({}));
      const list = normalizeList<Product>(payload);
      setProducts(list);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");

    if (!productId) {
      setStatus("Sélectionnez un produit.");
      return;
    }

    if (!codes.trim() && !file) {
      setStatus("Collez des codes ou ajoutez un fichier.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("product_id", productId);
      if (codes.trim()) formData.append("codes", codes.trim());
      if (file) formData.append("file", file);

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

      const payload = await res.json().catch(() => ({}));
      setStatus(`Importés: ${payload?.imported ?? 0}, doublons: ${payload?.duplicates ?? 0}`);
      setCodes("");
      setFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import impossible";
      setStatus(message || "Import impossible");
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
                }}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                required
                disabled={loadingProducts}
              >
                <option value="">{loadingProducts ? "Chargement..." : "Sélectionner un produit"}</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.sku ? `${p.name} (${p.sku})` : p.name}
                  </option>
                ))}
              </select>
              {!loadingProducts && products.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">Aucun produit trouvé. Vérifiez votre API / accès réseau.</p>
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
