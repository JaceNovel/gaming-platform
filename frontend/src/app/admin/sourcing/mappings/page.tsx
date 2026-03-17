"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Product = {
  id: number;
  name?: string | null;
  title?: string | null;
  stock?: number | null;
};

type SupplierSku = {
  id: number;
  external_sku_id?: string | null;
  sku_label?: string | null;
  moq?: number | null;
  unit_price?: number | string | null;
  currency_code?: string | null;
  lead_time_days?: number | null;
  supplier_product?: {
    id: number;
    title?: string | null;
    external_product_id?: string | null;
    supplier_account?: {
      id: number;
      label?: string | null;
      platform?: string | null;
    } | null;
  } | null;
};

type Mapping = {
  id: number;
  priority?: number | null;
  is_default?: boolean;
  procurement_mode?: string | null;
  target_moq?: number | null;
  reorder_point?: number | null;
  reorder_quantity?: number | null;
  safety_stock?: number | null;
  warehouse_destination_label?: string | null;
  expected_inbound_days?: number | null;
  product?: Product | null;
  supplier_product_sku?: SupplierSku | null;
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

export default function AdminSourcingMappingsPage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") === "aliexpress" ? "aliexpress" : "alibaba";
  const platformLabel = platform === "aliexpress" ? "AliExpress" : "Alibaba";
  const [products, setProducts] = useState<Product[]>([]);
  const [skus, setSkus] = useState<SupplierSku[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [productId, setProductId] = useState("");
  const [supplierSkuId, setSupplierSkuId] = useState("");
  const [priority, setPriority] = useState("1");
  const [procurementMode, setProcurementMode] = useState<"manual_batch" | "auto_batch">("manual_batch");
  const [targetMoq, setTargetMoq] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");
  const [reorderQuantity, setReorderQuantity] = useState("");
  const [safetyStock, setSafetyStock] = useState("");
  const [expectedInboundDays, setExpectedInboundDays] = useState("");
  const [warehouseDestinationLabel, setWarehouseDestinationLabel] = useState("Entrepôt principal");
  const [isDefault, setIsDefault] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productsRes, skusRes, mappingsRes] = await Promise.all([
        fetch(buildUrl("/products", { active: "0", per_page: "200", shop_type: "accessory" }), { headers: { Accept: "application/json" } }),
        fetch(`${API_BASE}/admin/sourcing/supplier-skus?platform=${platform}`, { headers: { Accept: "application/json", ...getAuthHeaders() } }),
        fetch(`${API_BASE}/admin/sourcing/mappings?platform=${platform}`, { headers: { Accept: "application/json", ...getAuthHeaders() } }),
      ]);

      if (!productsRes.ok || !skusRes.ok || !mappingsRes.ok) {
        throw new Error(`Impossible de charger les données ${platformLabel}`);
      }

      const productsPayload = await productsRes.json();
      const skusPayload = await skusRes.json();
      const mappingsPayload = await mappingsRes.json();

      setProducts(Array.isArray(productsPayload?.data) ? productsPayload.data : []);
      setSkus(Array.isArray(skusPayload?.data) ? skusPayload.data : []);
      setMappings(Array.isArray(mappingsPayload?.data) ? mappingsPayload.data : []);
    } catch (err) {
      setError(`Impossible de charger les données ${platformLabel}`);
    } finally {
      setLoading(false);
    }
  }, [platform, platformLabel]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!productId && products.length) setProductId(String(products[0].id));
  }, [productId, products]);

  useEffect(() => {
    if (!supplierSkuId && skus.length) setSupplierSkuId(String(skus[0].id));
  }, [supplierSkuId, skus]);

  const selectedSku = useMemo(() => skus.find((item) => String(item.id) === supplierSkuId) ?? null, [skus, supplierSkuId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/mappings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          product_id: Number(productId),
          supplier_product_sku_id: Number(supplierSkuId),
          priority: Number(priority || 1),
          procurement_mode: procurementMode,
          target_moq: targetMoq.trim() ? Number(targetMoq) : undefined,
          reorder_point: reorderPoint.trim() ? Number(reorderPoint) : undefined,
          reorder_quantity: reorderQuantity.trim() ? Number(reorderQuantity) : undefined,
          safety_stock: safetyStock.trim() ? Number(safetyStock) : undefined,
          expected_inbound_days: expectedInboundDays.trim() ? Number(expectedInboundDays) : undefined,
          warehouse_destination_label: warehouseDestinationLabel.trim() || undefined,
          is_default: isDefault,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Enregistrement impossible");
      }
      setSuccess("Mapping enregistré.");
      await loadAll();
    } catch (err: any) {
      setError(err?.message ?? "Enregistrement impossible");
    }
  };

  return (
    <AdminShell title={platformLabel} subtitle="Mappings produit local vers SKU fournisseur">
      <div className="grid gap-6 xl:grid-cols-[460px,1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Créer un mapping</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Produit local</span>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    #{product.id} · {product.title || product.name || "Produit"} · stock {product.stock ?? 0}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">SKU fournisseur</span>
              <select value={supplierSkuId} onChange={(e) => setSupplierSkuId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
                {skus.map((sku) => (
                  <option key={sku.id} value={sku.id}>
                    #{sku.id} · {sku.supplier_product?.supplier_account?.label || "Fournisseur"} · {sku.supplier_product?.title || sku.sku_label || sku.external_sku_id}
                  </option>
                ))}
              </select>
            </label>
            {selectedSku ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                MOQ {selectedSku.moq ?? 1} · {selectedSku.unit_price ?? "—"} {selectedSku.currency_code ?? ""} · délai {selectedSku.lead_time_days ?? "—"} j
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Priorité</span>
                <input value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Mode</span>
                <select value={procurementMode} onChange={(e) => setProcurementMode(e.target.value as any)} className="rounded-xl border border-slate-200 px-3 py-2">
                  <option value="manual_batch">manual_batch</option>
                  <option value="auto_batch">auto_batch</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">MOQ cible</span>
                <input value={targetMoq} onChange={(e) => setTargetMoq(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Point de réappro</span>
                <input value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Qté réappro</span>
                <input value={reorderQuantity} onChange={(e) => setReorderQuantity(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Stock sécurité</span>
                <input value={safetyStock} onChange={(e) => setSafetyStock(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Délai inbound</span>
                <input value={expectedInboundDays} onChange={(e) => setExpectedInboundDays(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Destination</span>
                <input value={warehouseDestinationLabel} onChange={(e) => setWarehouseDestinationLabel(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Source par défaut pour ce produit
            </label>
            <button type="submit" className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white">
              Enregistrer le mapping
            </button>
            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Mappings existants</h2>
              <p className="text-sm text-slate-500">Base du futur moteur de regroupement et de réapprovisionnement.</p>
            </div>
            <button type="button" onClick={loadAll} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Rafraîchir
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Produit</th>
                  <th className="pb-3 pr-4">Source</th>
                  <th className="pb-3 pr-4">Règles</th>
                  <th className="pb-3 pr-4">Destination</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && mappings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-slate-500">Aucun mapping créé.</td>
                  </tr>
                ) : null}
                {mappings.map((mapping) => (
                  <tr key={mapping.id}>
                    <td className="py-3 pr-4 align-top">
                      <div className="font-medium text-slate-900">{mapping.product?.title || mapping.product?.name || "Produit"}</div>
                      <div className="text-xs text-slate-500">#{mapping.product?.id ?? "—"} · stock {mapping.product?.stock ?? 0}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>{mapping.supplier_product_sku?.supplier_product?.supplier_account?.label || "Fournisseur"}</div>
                      <div>{mapping.supplier_product_sku?.supplier_product?.title || mapping.supplier_product_sku?.sku_label || mapping.supplier_product_sku?.external_sku_id || "SKU"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>Défaut: {mapping.is_default ? "Oui" : "Non"}</div>
                      <div>Mode: {mapping.procurement_mode || "manual_batch"}</div>
                      <div>MOQ cible: {mapping.target_moq ?? "—"}</div>
                      <div>Réappro: {mapping.reorder_point ?? "—"} / {mapping.reorder_quantity ?? "—"}</div>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-slate-600">
                      <div>{mapping.warehouse_destination_label || "—"}</div>
                      <div>Délai: {mapping.expected_inbound_days ?? "—"} j</div>
                      <div>Stock sécurité: {mapping.safety_stock ?? "—"}</div>
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