"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type SupplierAccount = {
  id: number;
  label: string;
  platform: string;
};

type SupplierProduct = {
  id: number;
  title?: string | null;
  external_product_id?: string | null;
  supplier_name?: string | null;
  source_url?: string | null;
  supplier_account?: { label?: string | null; platform?: string | null } | null;
  skus_count?: number | null;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminSourcingImportPage() {
  const [accounts, setAccounts] = useState<SupplierAccount[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [supplierAccountId, setSupplierAccountId] = useState("");
  const [externalProductId, setExternalProductId] = useState("");
  const [externalOfferId, setExternalOfferId] = useState("");
  const [title, setTitle] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState("");
  const [fetchingRemote, setFetchingRemote] = useState(false);
  const [skusJson, setSkusJson] = useState(
    JSON.stringify(
      [
        {
          external_sku_id: "sku-001",
          sku_label: "Noir / USB-C",
          moq: 10,
          unit_price: 12.5,
          currency_code: "USD",
          available_quantity: 250,
          lead_time_days: 7,
          variant_attributes_json: { color: "black", connector: "usb-c" },
          logistics_modes_json: ["air", "sea"],
        },
      ],
      null,
      2,
    ),
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accountsRes, productsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/sourcing/supplier-accounts`, { headers: { Accept: "application/json", ...getAuthHeaders() } }),
        fetch(`${API_BASE}/admin/sourcing/supplier-products`, { headers: { Accept: "application/json", ...getAuthHeaders() } }),
      ]);
      if (!accountsRes.ok || !productsRes.ok) throw new Error("Impossible de charger les données d’import");
      const accountsPayload = await accountsRes.json();
      const productsPayload = await productsRes.json();
      setAccounts(Array.isArray(accountsPayload?.data) ? accountsPayload.data : []);
      setProducts(Array.isArray(productsPayload?.data) ? productsPayload.data : []);
    } catch (err) {
      setError("Impossible de charger les données d’import");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!supplierAccountId && accounts.length) setSupplierAccountId(String(accounts[0].id));
  }, [accounts, supplierAccountId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const parsedSkus = JSON.parse(skusJson);
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          external_product_id: externalProductId.trim(),
          external_offer_id: externalOfferId.trim() || undefined,
          title: title.trim(),
          supplier_name: supplierName.trim() || undefined,
          source_url: sourceUrl.trim() || undefined,
          main_image_url: mainImageUrl.trim() || undefined,
          skus: parsedSkus,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Import impossible");
      }
      setSuccess("Catalogue fournisseur importé.");
      setExternalProductId("");
      setExternalOfferId("");
      setTitle("");
      setSupplierName("");
      setSourceUrl("");
      setMainImageUrl("");
      await loadAll();
    } catch (err: any) {
      setError(err?.message ?? "Import impossible. Vérifie le JSON des SKU.");
    }
  };

  const fetchRemoteProduct = async () => {
    setError("");
    setSuccess("");
    if (!supplierAccountId || !externalProductId.trim()) {
      setError("Sélectionne un compte fournisseur et renseigne un external product ID.");
      return;
    }

    setFetchingRemote(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/fetch-remote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: Number(supplierAccountId),
          external_product_id: externalProductId.trim(),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Chargement API impossible");
      }
      const payload = await res.json();
      const product = payload?.data;
      setExternalOfferId(product?.external_offer_id || "");
      setTitle(product?.title || "");
      setSupplierName(product?.supplier_name || "");
      setSourceUrl(product?.source_url || "");
      setMainImageUrl(product?.main_image_url || "");
      setSkusJson(JSON.stringify(product?.skus ?? [], null, 2));
      setSuccess("Produit fournisseur chargé depuis l’API et formulaire prérempli.");
    } catch (err: any) {
      setError(err?.message ?? "Chargement API impossible");
    } finally {
      setFetchingRemote(false);
    }
  };

  return (
    <AdminShell title="Sourcing" subtitle="Import catalogue fournisseur vers supplier_products et supplier_product_skus">
      <div className="grid gap-6 xl:grid-cols-[520px,1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Importer un produit fournisseur</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Compte fournisseur</span>
              <select value={supplierAccountId} onChange={(e) => setSupplierAccountId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.label} · {account.platform}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">External product ID</span>
              <input value={externalProductId} onChange={(e) => setExternalProductId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" required />
            </label>
            <button type="button" onClick={fetchRemoteProduct} disabled={fetchingRemote} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
              {fetchingRemote ? "Chargement API..." : "Préremplir depuis l’API fournisseur"}
            </button>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">External offer ID</span>
              <input value={externalOfferId} onChange={(e) => setExternalOfferId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Titre</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" required />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Nom fournisseur</span>
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">URL source</span>
              <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Image principale</span>
              <input value={mainImageUrl} onChange={(e) => setMainImageUrl(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">SKU JSON</span>
              <textarea value={skusJson} onChange={(e) => setSkusJson(e.target.value)} rows={12} className="rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs" />
            </label>
            <button type="submit" className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white">Importer</button>
            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Catalogue importé</h2>
              <p className="text-sm text-slate-500">Produits source déjà stockés côté back-office.</p>
            </div>
            <button type="button" onClick={loadAll} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Rafraîchir</button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Produit source</th>
                  <th className="pb-3 pr-4">Compte</th>
                  <th className="pb-3 pr-4">SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && products.length === 0 ? <tr><td colSpan={3} className="py-4 text-slate-500">Aucun produit importé.</td></tr> : null}
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="py-3 pr-4 align-top">
                      <div className="font-medium text-slate-900">{product.title || "Produit"}</div>
                      <div className="text-xs text-slate-500">{product.external_product_id || "—"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>{product.supplier_account?.label || "—"}</div>
                      <div>{product.supplier_account?.platform || "—"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">{product.skus_count ?? 0}</td>
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