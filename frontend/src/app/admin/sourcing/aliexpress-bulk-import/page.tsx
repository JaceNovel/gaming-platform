"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type SupplierAccount = {
  id: number;
  label: string;
  platform: "alibaba" | "aliexpress";
  is_active: boolean;
  currency_code?: string | null;
  last_sync_at?: string | null;
};

type BulkImportResponse = {
  summary?: {
    operation?: string;
    requested_limit?: number;
    fetched_rows?: number;
    imported_supplier_products?: number;
    created_storefront_products?: number;
    updated_storefront_products?: number;
    skipped_storefront_products?: number;
  };
  imported?: Array<{
    supplier_product_id?: number;
    external_product_id?: string | null;
    title?: string | null;
    supplier_name?: string | null;
    skus_count?: number | null;
    local_product?: {
      id?: number;
      title?: string | null;
      price_fcfa?: number | null;
      is_active?: boolean;
    } | null;
  }>;
  created_products?: Array<{
    id: number;
    title?: string | null;
    price_fcfa?: number | null;
    is_active?: boolean;
    grouping_threshold?: number | null;
  }>;
  updated_products?: Array<{
    id: number;
    title?: string | null;
    price_fcfa?: number | null;
    is_active?: boolean;
    grouping_threshold?: number | null;
  }>;
};

type DsAutoMapResponse = {
  summary?: {
    requested?: number;
    imported_ds_products?: number;
    mapped?: number;
    skipped?: number;
    failed?: number;
  };
  mapped?: Array<{
    local_product?: {
      id?: number;
      title?: string | null;
    } | null;
    external_product_id?: string | null;
    title?: string | null;
    supplier_product_id?: number;
    supplier_product_sku_id?: number;
    supplier_account?: {
      id?: number;
      label?: string | null;
    } | null;
    is_default?: boolean;
  }>;
  skipped?: Array<{
    local_product_id?: number | null;
    external_product_id?: string | null;
    title?: string | null;
    reason?: string | null;
  }>;
  failed?: Array<{
    local_product_id?: number | null;
    external_product_id?: string | null;
    title?: string | null;
    reason?: string | null;
  }>;
};

type BulkImportDiagnostic = {
  reason?: string;
  provider_message?: string;
  provider_code?: string;
  missing_keys?: string[];
  remediation?: string[];
};

const buildBulkImportErrorMessage = (payloadRes: { message?: string; diagnostic?: BulkImportDiagnostic } | null): string => {
  const message = payloadRes?.message ?? "Import automatique impossible.";
  const diagnostic = payloadRes?.diagnostic;

  if (!diagnostic) {
    return message;
  }

  if (diagnostic.reason === "affiliate_permission_missing") {
    const extra = diagnostic.remediation?.length
      ? ` ${diagnostic.remediation.join(" ")}`
      : "";
    const provider = diagnostic.provider_message ? ` Provider: ${diagnostic.provider_message}.` : "";
    return `${message}.${provider}${extra}`.trim();
  }

  if (diagnostic.reason === "affiliate_provider_rejected_request") {
    const providerCode = diagnostic.provider_code ? ` Code: ${diagnostic.provider_code}.` : "";
    const providerMessage = diagnostic.provider_message ? ` Provider: ${diagnostic.provider_message}.` : "";
    const extra = diagnostic.remediation?.length ? ` ${diagnostic.remediation.join(" ")}` : "";
    return `${message}. ${providerCode}${providerMessage}${extra}`.trim();
  }

  if (diagnostic.reason === "affiliate_request_payload_incomplete") {
    const missing = diagnostic.missing_keys?.length ? ` Champs manquants: ${diagnostic.missing_keys.join(", ")}.` : "";
    const extra = diagnostic.remediation?.length ? ` ${diagnostic.remediation.join(" ")}` : "";
    return `${message}. ${missing}${extra}`.trim();
  }

  return message;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const TEMPLATES: Record<string, string> = {
  "ae-affiliate-hotproduct-download": JSON.stringify(
    {
      category_id: "7",
      fields: "app_sale_price,shop_id,commission_rate,original_price,sale_price",
      page_no: 1,
      page_size: 50,
      target_currency: "USD",
      target_language: "FR",
      country: "TG",
    },
    null,
    2,
  ),
  "ae-affiliate-hotproduct-query": JSON.stringify(
    {
      keywords: "gaming",
      page_no: 1,
      page_size: 50,
      sort: "LAST_VOLUME_DESC",
      target_currency: "USD",
      target_language: "FR",
      ship_to_country: "TG",
    },
    null,
    2,
  ),
  "ae-affiliate-product-query": JSON.stringify(
    {
      keywords: "gaming accessories",
      page_no: 1,
      page_size: 50,
      sort: "SALE_PRICE_ASC",
      target_currency: "USD",
      target_language: "FR",
      ship_to_country: "TG",
    },
    null,
    2,
  ),
  "ae-affiliate-product-smartmatch": JSON.stringify(
    {
      page_no: 1,
      device_id: "primegaming-bulk-import",
      fields: "app_sale_price,shop_id,commission_rate",
      keywords: "gaming setup",
      country: "TG",
      target_currency: "USD",
      target_language: "FR",
    },
    null,
    2,
  ),
};

const OPERATIONS = [
  "ae-affiliate-hotproduct-download",
  "ae-affiliate-hotproduct-query",
  "ae-affiliate-product-query",
  "ae-affiliate-product-smartmatch",
] as const;

export default function AdminAliExpressBulkImportPage() {
  const [accounts, setAccounts] = useState<SupplierAccount[]>([]);
  const [accountId, setAccountId] = useState<number | "">("");
  const [dsAccountId, setDsAccountId] = useState<number | "">("");
  const [operation, setOperation] = useState<(typeof OPERATIONS)[number]>("ae-affiliate-hotproduct-download");
  const [payload, setPayload] = useState(TEMPLATES["ae-affiliate-hotproduct-download"]);
  const [limit, setLimit] = useState(50);
  const [usdToXofRate, setUsdToXofRate] = useState(620);
  const [groupingThreshold, setGroupingThreshold] = useState(3);
  const [marginPercent, setMarginPercent] = useState(17);
  const [deliveryEtaDays, setDeliveryEtaDays] = useState(12);
  const [targetMoq, setTargetMoq] = useState(1);
  const [reorderQuantity, setReorderQuantity] = useState(1);
  const [defaultWeightGrams, setDefaultWeightGrams] = useState(350);
  const [defaultEstimatedCbm, setDefaultEstimatedCbm] = useState(0.003);
  const [publishProducts, setPublishProducts] = useState(true);
  const [running, setRunning] = useState(false);
  const [mappingRunning, setMappingRunning] = useState(false);
  const [error, setError] = useState("");
  const [mappingError, setMappingError] = useState("");
  const [success, setSuccess] = useState("");
  const [mappingSuccess, setMappingSuccess] = useState("");
  const [result, setResult] = useState<BulkImportResponse | null>(null);
  const [mappingResult, setMappingResult] = useState<DsAutoMapResponse | null>(null);

  const activeAccount = useMemo(
    () => accounts.find((item: SupplierAccount) => item.id === Number(accountId)) ?? null,
    [accountId, accounts],
  );

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/supplier-accounts?platform=aliexpress&active=1`, {
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Impossible de charger les comptes AliExpress.");
      const payloadRes = await res.json();
      const nextAccounts = Array.isArray(payloadRes?.data) ? payloadRes.data : [];
      setAccounts(nextAccounts);
      if (!accountId && nextAccounts[0]?.id) {
        setAccountId(nextAccounts[0].id);
      }
      if (!dsAccountId) {
        const fallbackDsAccount = nextAccounts.find((item: SupplierAccount) => item.id !== Number(accountId)) ?? nextAccounts[0] ?? null;
        if (fallbackDsAccount?.id) {
          setDsAccountId(fallbackDsAccount.id);
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les comptes AliExpress.");
    }
  }, [accountId, dsAccountId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    setPayload(TEMPLATES[operation]);
  }, [operation]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setResult(null);
    setMappingError("");
    setMappingSuccess("");
    setMappingResult(null);

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      setError("Le JSON de requête est invalide.");
      return;
    }

    if (!accountId) {
      setError("Sélectionne un compte AliExpress actif.");
      return;
    }

    setRunning(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/aliexpress/bulk-import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: accountId,
          operation,
          request_payload: parsedPayload,
          limit,
          auto_create_products: true,
          publish_products: publishProducts,
          usd_to_xof_rate: usdToXofRate,
          grouping_threshold: groupingThreshold,
          margin_percent: marginPercent,
          target_moq: targetMoq,
          reorder_quantity: reorderQuantity,
          delivery_eta_days: deliveryEtaDays,
          default_country_code: "TG",
          source_logistics_profile: "ordinary",
          default_weight_grams: defaultWeightGrams,
          default_estimated_cbm: defaultEstimatedCbm,
        }),
      });

      const payloadRes = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(buildBulkImportErrorMessage(payloadRes));
      }

      setResult(payloadRes?.data ?? null);
      setSuccess("Import AliExpress terminé.");
      loadAccounts();
    } catch (err: any) {
      setError(err?.message ?? "Import automatique impossible.");
    } finally {
      setRunning(false);
    }
  };

  const handleAutoMapDs = async () => {
    setMappingError("");
    setMappingSuccess("");
    setMappingResult(null);

    if (!dsAccountId) {
      setMappingError("Sélectionne le compte AliExpress activé DS à utiliser pour le mapping.");
      return;
    }

    const items = (result?.imported ?? [])
      .map((item: NonNullable<BulkImportResponse["imported"]>[number]) => ({
        local_product_id: item.local_product?.id,
        external_product_id: item.external_product_id,
        title: item.title,
      }))
      .filter((item: { local_product_id?: number; external_product_id?: string | null }) => item.local_product_id && item.external_product_id);

    if (!items.length) {
      setMappingError("Aucun produit storefront importé dans cette exécution ne peut être mappé vers DS.");
      return;
    }

    setMappingRunning(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/catalog/aliexpress/auto-map-ds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_account_id: dsAccountId,
          items,
          ship_to_country: "TG",
          target_currency: "USD",
          target_language: "fr",
          priority: 1,
          is_default: true,
          procurement_mode: "auto_batch",
          target_moq: targetMoq,
          reorder_quantity: reorderQuantity,
          expected_inbound_days: deliveryEtaDays,
          warehouse_destination_label: "Hub France-Lome TG",
        }),
      });

      const payloadRes = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payloadRes?.message ?? "Mapping DS automatique impossible.");
      }

      setMappingResult(payloadRes?.data ?? null);
      setMappingSuccess("Mapping DS automatique terminé.");
    } catch (err: any) {
      setMappingError(err?.message ?? "Mapping DS automatique impossible.");
    } finally {
      setMappingRunning(false);
    }
  };

  return (
    <AdminShell title="AliExpress" subtitle="Import automatique de 200 produits et création des mappings storefront">
      <div className="grid gap-6 xl:grid-cols-[480px,1fr]">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Bulk Import</h2>
              <p className="mt-1 text-sm text-slate-500">Interroge les endpoints affiliés AliExpress, importe le catalogue fournisseur puis crée automatiquement les produits physiques et leur mapping par défaut.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Compte AliExpress</span>
                <select value={accountId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setAccountId(Number(event.target.value) || "")} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                  <option value="">Sélectionner</option>
                  {accounts.map((account: SupplierAccount) => (
                    <option key={account.id} value={account.id}>{account.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span>Opération</span>
                <select value={operation} onChange={(event: ChangeEvent<HTMLSelectElement>) => setOperation(event.target.value as (typeof OPERATIONS)[number])} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                  {OPERATIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Volume cible</span>
                <input type="number" min={1} max={200} value={limit} onChange={(event: ChangeEvent<HTMLInputElement>) => setLimit(Number(event.target.value) || 1)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Taux USD vers FCFA</span>
                <input type="number" min={1} step="0.01" value={usdToXofRate} onChange={(event: ChangeEvent<HTMLInputElement>) => setUsdToXofRate(Number(event.target.value) || 1)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5" />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Seuil de groupage</span>
                <input type="number" min={1} max={500} value={groupingThreshold} onChange={(event: ChangeEvent<HTMLInputElement>) => setGroupingThreshold(Number(event.target.value) || 1)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Marge %</span>
                <input type="number" min={0} step="0.1" value={marginPercent} onChange={(event: ChangeEvent<HTMLInputElement>) => setMarginPercent(Number(event.target.value) || 0)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5" />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>ETA inbound jours</span>
                <input type="number" min={1} max={90} value={deliveryEtaDays} onChange={(event: ChangeEvent<HTMLInputElement>) => setDeliveryEtaDays(Number(event.target.value) || 1)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>MOQ cible</span>
                <input type="number" min={1} max={1000} value={targetMoq} onChange={(event: ChangeEvent<HTMLInputElement>) => setTargetMoq(Number(event.target.value) || 1)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5" />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span>Quantité de réassort</span>
                <input type="number" min={1} max={1000} value={reorderQuantity} onChange={(event: ChangeEvent<HTMLInputElement>) => setReorderQuantity(Number(event.target.value) || 1)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                <span>Poids par défaut g</span>
                <input type="number" min={0} max={200000} value={defaultWeightGrams} onChange={(event: ChangeEvent<HTMLInputElement>) => setDefaultWeightGrams(Number(event.target.value) || 0)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5" />
              </label>
            </div>

            <label className="space-y-2 text-sm text-slate-700">
              <span>CBM par défaut</span>
              <input type="number" min={0} step="0.0001" value={defaultEstimatedCbm} onChange={(event: ChangeEvent<HTMLInputElement>) => setDefaultEstimatedCbm(Number(event.target.value) || 0)} className="w-full rounded-2xl border border-slate-200 px-3 py-2.5" />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={publishProducts} onChange={(event: ChangeEvent<HTMLInputElement>) => setPublishProducts(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Publier directement les produits storefront après import
            </label>

            <label className="space-y-2 text-sm text-slate-700">
              <span>Payload JSON</span>
              <textarea value={payload} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPayload(event.target.value)} rows={18} className="w-full rounded-2xl border border-slate-200 px-3 py-3 font-mono text-xs text-slate-800" />
            </label>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setPayload(TEMPLATES[operation])} className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700">Réinitialiser le payload</button>
              <button type="submit" disabled={running} className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{running ? "Import en cours..." : "Lancer l'import"}</button>
            </div>

            {activeAccount ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Compte actif: <span className="font-semibold">{activeAccount.label}</span>
                {activeAccount.currency_code ? ` · Devise compte: ${activeAccount.currency_code}` : ""}
                {activeAccount.last_sync_at ? ` · Dernier sync: ${new Date(activeAccount.last_sync_at).toLocaleString("fr-FR")}` : ""}
              </div>
            ) : null}

            {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
          </div>
        </form>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Résumé d'exécution</h2>
              <p className="mt-1 text-sm text-slate-500">Le backend importe d'abord le catalogue source, puis crée ou met à jour les produits storefront liés.</p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                ["Produits source", result?.summary?.imported_supplier_products ?? 0],
                ["Produits storefront créés", result?.summary?.created_storefront_products ?? 0],
                ["Produits storefront mis à jour", result?.summary?.updated_storefront_products ?? 0],
                ["Produits storefront ignorés", result?.summary?.skipped_storefront_products ?? 0],
                ["Lignes récupérées", result?.summary?.fetched_rows ?? 0],
                ["Limite demandée", result?.summary?.requested_limit ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Produits storefront créés ou mis à jour</h2>
              <p className="mt-1 text-sm text-slate-500">Les prix sont convertis en FCFA au moment de l'import, puis repris par la tarification transit par pays au storefront.</p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="pb-3 pr-4">Produit</th>
                    <th className="pb-3 pr-4">Prix</th>
                    <th className="pb-3 pr-4">Groupage</th>
                    <th className="pb-3 pr-4">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...(result?.created_products ?? []), ...(result?.updated_products ?? [])].slice(0, 30).map((item) => (
                    <tr key={`${item.id}-${item.title ?? "product"}`}>
                      <td className="py-3 pr-4 font-medium text-slate-900">{item.title || `Produit #${item.id}`}</td>
                      <td className="py-3 pr-4 text-slate-600">{Math.round(Number(item.price_fcfa ?? 0)).toLocaleString("fr-FR")} FCFA</td>
                      <td className="py-3 pr-4 text-slate-600">{item.grouping_threshold ?? 0}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.is_active ? "Publié" : "Brouillon"}</td>
                    </tr>
                  ))}
                  {!result?.created_products?.length && !result?.updated_products?.length ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-slate-500">Aucun produit storefront créé ou mis à jour pour l'instant.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Catalogue source importé</h2>
              <p className="mt-1 text-sm text-slate-500">Aperçu des derniers produits AliExpress importés pendant cette exécution.</p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="pb-3 pr-4">Source</th>
                    <th className="pb-3 pr-4">Produit</th>
                    <th className="pb-3 pr-4">SKU</th>
                    <th className="pb-3 pr-4">Storefront</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(result?.imported ?? []).slice(0, 30).map((item) => (
                    <tr key={`${item.supplier_product_id}-${item.external_product_id ?? "source"}`}>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-900">{item.supplier_name || "AliExpress"}</div>
                        <div className="text-xs text-slate-500">{item.external_product_id || "—"}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-700">{item.title || "Produit"}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.skus_count ?? 0}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.local_product?.title || "Aucun mapping"}</td>
                    </tr>
                  ))}
                  {!result?.imported?.length ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-slate-500">Aucune exécution récente sur cette session.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Mapping automatique DS</h2>
                <p className="mt-1 text-sm text-slate-500">Après import affiliation, choisis ici le compte AliExpress activé DS pour importer les fiches DS correspondantes et basculer le mapping storefront dessus.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(240px,1fr),auto]">
                <label className="space-y-2 text-sm text-slate-700">
                  <span>Compte DS</span>
                  <select value={dsAccountId} onChange={(event: ChangeEvent<HTMLSelectElement>) => setDsAccountId(Number(event.target.value) || "")} className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                    <option value="">Sélectionner</option>
                    {accounts.map((account: SupplierAccount) => (
                      <option key={account.id} value={account.id}>{account.label}</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={handleAutoMapDs} disabled={mappingRunning || running || !(result?.imported?.length)} className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  {mappingRunning ? "Mapping en cours..." : "Faire le mapping"}
                </button>
              </div>
            </div>

            {mappingError ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{mappingError}</div> : null}
            {mappingSuccess ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{mappingSuccess}</div> : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                ["Demandés", mappingResult?.summary?.requested ?? 0],
                ["Produits DS importés", mappingResult?.summary?.imported_ds_products ?? 0],
                ["Mappings créés", mappingResult?.summary?.mapped ?? 0],
                ["Ignorés", mappingResult?.summary?.skipped ?? 0],
                ["En échec", mappingResult?.summary?.failed ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="pb-3 pr-4">Produit local</th>
                    <th className="pb-3 pr-4">Produit DS</th>
                    <th className="pb-3 pr-4">Compte</th>
                    <th className="pb-3 pr-4">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(mappingResult?.mapped ?? []).slice(0, 30).map((item) => (
                    <tr key={`${item.local_product?.id ?? "local"}-${item.external_product_id ?? "external"}`}>
                      <td className="py-3 pr-4 text-slate-700">{item.local_product?.title || `Produit #${item.local_product?.id ?? "—"}`}</td>
                      <td className="py-3 pr-4 text-slate-700">{item.title || item.external_product_id || "Produit DS"}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.supplier_account?.label || "Compte DS"}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.is_default ? "Défaut DS" : "Ajouté"}</td>
                    </tr>
                  ))}
                  {!(mappingResult?.mapped?.length) ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-slate-500">Aucun mapping DS automatique exécuté sur cette session.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {(mappingResult?.failed?.length || mappingResult?.skipped?.length) ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="text-sm font-semibold text-rose-800">Échecs</div>
                  <div className="mt-3 space-y-2 text-sm text-rose-700">
                    {(mappingResult?.failed ?? []).slice(0, 10).map((item, index) => (
                      <div key={`${item.local_product_id ?? "product"}-${index}`}>{item.title || item.external_product_id || `Produit #${item.local_product_id ?? "—"}`} · {item.reason || "Erreur inconnue"}</div>
                    ))}
                    {!mappingResult?.failed?.length ? <div>Aucun.</div> : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-semibold text-amber-800">Ignorés</div>
                  <div className="mt-3 space-y-2 text-sm text-amber-700">
                    {(mappingResult?.skipped ?? []).slice(0, 10).map((item, index) => (
                      <div key={`${item.local_product_id ?? "product"}-${index}`}>{item.title || item.external_product_id || `Produit #${item.local_product_id ?? "—"}`} · {item.reason || "Ignoré"}</div>
                    ))}
                    {!mappingResult?.skipped?.length ? <div>Aucun.</div> : null}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
