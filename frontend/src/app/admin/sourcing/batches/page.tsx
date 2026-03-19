"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type Batch = {
  id: number;
  batch_number?: string | null;
  status?: string | null;
  currency_code?: string | null;
  warehouse_destination_label?: string | null;
  supplier_order_reference?: string | null;
  notes?: string | null;
  supplier_order_payload_json?: {
    ds_draft?: {
      ds_extend_request?: Record<string, unknown> | null;
      param_place_order_request4_open_api_d_t_o?: Record<string, unknown> | null;
    } | null;
    ds_freight_check?: DsFreightCheckState | null;
    ds_order_create?: DsOrderCreateState | null;
    latest_request_payload_json?: Record<string, unknown> | null;
    latest_response_payload_json?: Record<string, unknown> | null;
  } | null;
  supplier_account?: { label?: string | null; platform?: string | null } | null;
  items?: Array<{ id: number; quantity_ordered?: number | null; product?: { title?: string | null; name?: string | null } | null; supplier_product_sku?: { supplier_product?: { title?: string | null } | null } | null }>;
};

type DsFreightCheckItem = {
  product_name?: string | null;
  product_id?: string | null;
  sku_id?: string | null;
  requested_logistics_service_name?: string | null;
  resolved_logistics_service_name?: string | null;
  available_services?: string[] | null;
  success?: boolean | null;
  is_valid?: boolean | null;
  error_message?: string | null;
};

type DsFreightCheckState = {
  checked_at?: string | null;
  items?: DsFreightCheckItem[] | null;
};

type DsOrderCreateState = {
  success?: boolean | null;
  order_list?: string[] | null;
  error_code?: string | null;
  error_message?: string | null;
  remote_error_message?: string | null;
  request_id?: string | null;
  created_at?: string | null;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminSourcingBatchesPage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") === "aliexpress" ? "aliexpress" : "alibaba";
  const platformLabel = platform === "aliexpress" ? "AliExpress" : "Alibaba";
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [batchId, setBatchId] = useState("");
  const [shipmentReference, setShipmentReference] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [referenceDrafts, setReferenceDrafts] = useState<Record<number, string>>({});
  const [notesDrafts, setNotesDrafts] = useState<Record<number, string>>({});
  const [dsExtendDrafts, setDsExtendDrafts] = useState<Record<number, string>>({});
  const [dsPlaceDrafts, setDsPlaceDrafts] = useState<Record<number, string>>({});
  const [dsFreightChecks, setDsFreightChecks] = useState<Record<number, DsFreightCheckState | null>>({});
  const [batchActionLoading, setBatchActionLoading] = useState<Record<number, string | null>>({});

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/batches?platform=${platform}`, { headers: { Accept: "application/json", ...getAuthHeaders() } });
      if (!res.ok) throw new Error(`Impossible de charger les lots ${platformLabel}`);
      const payload = await res.json();
      setBatches(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setError(`Impossible de charger les lots ${platformLabel}`);
    } finally {
      setLoading(false);
    }
  }, [platform, platformLabel]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (!batchId && batches.length) setBatchId(String(batches[0].id));
  }, [batchId, batches]);

  const createShipment = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/inbound-shipments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          procurement_batch_id: Number(batchId),
          shipment_reference: shipmentReference.trim() || undefined,
          carrier_name: carrierName.trim() || undefined,
          tracking_number: trackingNumber.trim() || undefined,
          tracking_url: trackingUrl.trim() || undefined,
          status: "in_transit",
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Création du shipment impossible");
      }
      setSuccess("Expédition entrante créée.");
      setShipmentReference("");
      setCarrierName("");
      setTrackingNumber("");
      setTrackingUrl("");
      await loadBatches();
    } catch (err: any) {
      setError(err?.message ?? "Création du shipment impossible");
    }
  };

  const approveBatch = async (batchIdValue: number) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/batches/${batchIdValue}/approve`, {
        method: "PATCH",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Approbation impossible");
      }
      setSuccess("Lot approuvé.");
      await loadBatches();
    } catch (err: any) {
      setError(err?.message ?? "Approbation impossible");
    }
  };

  const submitBatch = async (batchIdValue: number) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/batches/${batchIdValue}/submit`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          supplier_order_reference: referenceDrafts[batchIdValue] ?? "",
          notes: notesDrafts[batchIdValue] ?? "",
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Soumission impossible");
      }
      setSuccess("Lot soumis au fournisseur.");
      await loadBatches();
    } catch (err: any) {
      setError(err?.message ?? "Soumission impossible");
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("fr-FR");
  };

  const prettyJson = (value: unknown) => {
    if (!value) return "{}";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "{}";
    }
  };

  const getDsExtendValue = (batch: Batch) => dsExtendDrafts[batch.id] ?? prettyJson(batch.supplier_order_payload_json?.ds_draft?.ds_extend_request ?? {});
  const getDsPlaceValue = (batch: Batch) => dsPlaceDrafts[batch.id] ?? prettyJson(batch.supplier_order_payload_json?.ds_draft?.param_place_order_request4_open_api_d_t_o ?? {});
  const getFreightCheck = (batch: Batch) => dsFreightChecks[batch.id] ?? batch.supplier_order_payload_json?.ds_freight_check ?? null;

  const loadBatchDsDraft = async (batchIdValue: number) => {
    setError("");
    setSuccess("");
    setBatchActionLoading((current) => ({ ...current, [batchIdValue]: "draft" }));
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/batches/${batchIdValue}/aliexpress/ds-draft`, {
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.message ?? "Préparation du draft DS groupé impossible");
      }

      const draft = payload?.data?.draft ?? {};
      setDsExtendDrafts((current) => ({ ...current, [batchIdValue]: prettyJson(draft?.ds_extend_request ?? {}) }));
      setDsPlaceDrafts((current) => ({ ...current, [batchIdValue]: prettyJson(draft?.param_place_order_request4_open_api_d_t_o ?? {}) }));
      setDsFreightChecks((current) => ({ ...current, [batchIdValue]: (payload?.data?.freight_check ?? null) as DsFreightCheckState | null }));
      setSuccess("Draft DS groupé chargé.");
      await loadBatches();
    } catch (err: any) {
      setError(err?.message ?? "Préparation du draft DS groupé impossible");
    } finally {
      setBatchActionLoading((current) => ({ ...current, [batchIdValue]: null }));
    }
  };

  const createBatchDsOrder = async (batch: Batch) => {
    setError("");
    setSuccess("");
    setBatchActionLoading((current) => ({ ...current, [batch.id]: "create-order" }));
    try {
      const dsExtendRequest = JSON.parse(getDsExtendValue(batch) || "{}");
      const placeOrderRequest = JSON.parse(getDsPlaceValue(batch) || "{}");

      const res = await fetch(`${API_BASE}/admin/sourcing/batches/${batch.id}/aliexpress/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ds_extend_request: dsExtendRequest,
          param_place_order_request4_open_api_d_t_o: placeOrderRequest,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.message ?? "Création commande DS groupée impossible");
      }

      const orderList = Array.isArray(payload?.data?.result?.order_list) ? payload.data.result.order_list.filter(Boolean) : [];
      setSuccess(
        orderList.length > 0
          ? `Commande DS groupée créée (${orderList.join(", ")}).`
          : "Commande DS groupée créée."
      );
      await loadBatches();
    } catch (err: any) {
      setError(err?.message ?? "Création commande DS groupée impossible");
    } finally {
      setBatchActionLoading((current) => ({ ...current, [batch.id]: null }));
    }
  };

  return (
    <AdminShell title={platformLabel} subtitle="Lots d’achat et préparation des expéditions entrantes">
      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <form onSubmit={createShipment} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Créer une expédition entrante</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Lot d’achat</span>
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.batch_number} · {batch.supplier_account?.label || "Fournisseur"}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm"><span className="text-slate-600">Référence shipment</span><input value={shipmentReference} onChange={(e) => setShipmentReference(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="grid gap-1 text-sm"><span className="text-slate-600">Transporteur</span><input value={carrierName} onChange={(e) => setCarrierName(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="grid gap-1 text-sm"><span className="text-slate-600">Tracking number</span><input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" /></label>
            <label className="grid gap-1 text-sm"><span className="text-slate-600">Tracking URL</span><input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" /></label>
            <button type="submit" className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white">Créer l’expédition</button>
            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Lots existants</h2>
              <p className="text-sm text-slate-500">Suivi des groupes d’achat déjà créés.</p>
            </div>
            <button type="button" onClick={loadBatches} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Rafraîchir</button>
          </div>
          <div className="mt-4 space-y-4">
            {!loading && batches.length === 0 ? <div className="text-sm text-slate-500">Aucun lot d’achat.</div> : null}
            {batches.map((batch) => (
              <div key={batch.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{batch.batch_number}</div>
                    <div className="text-xs text-slate-500">{batch.supplier_account?.label || "Fournisseur"} · {batch.status || "draft"} · {batch.currency_code || "—"}</div>
                  </div>
                  <div className="text-xs text-slate-500">{batch.warehouse_destination_label || "Destination non définie"}</div>
                </div>
                <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr,1fr,auto,auto]">
                  <label className="grid gap-1 text-xs text-slate-600">
                    <span>Référence commande fournisseur</span>
                    <input
                      value={referenceDrafts[batch.id] ?? batch.supplier_order_reference ?? ""}
                      onChange={(e) => setReferenceDrafts((current) => ({ ...current, [batch.id]: e.target.value }))}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-slate-600">
                    <span>Notes</span>
                    <input
                      value={notesDrafts[batch.id] ?? batch.notes ?? ""}
                      onChange={(e) => setNotesDrafts((current) => ({ ...current, [batch.id]: e.target.value }))}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <button type="button" onClick={() => approveBatch(batch.id)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
                    Approuver
                  </button>
                  <button type="button" onClick={() => submitBatch(batch.id)} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white">
                    Soumettre
                  </button>
                </div>
                {batch.supplier_account?.platform === "aliexpress" ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Commande DS groupée</div>
                        <div className="text-xs text-slate-500">Prépare le draft AliExpress DS pour tout le lot groupé, exécute le précheck freight puis crée une seule commande fournisseur.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadBatchDsDraft(batch.id)}
                        disabled={Boolean(batchActionLoading[batch.id])}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 disabled:opacity-50"
                      >
                        {batchActionLoading[batch.id] === "draft" ? "Préparation..." : "Régénérer le draft DS"}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-600">ds_extend_request JSON</span>
                        <textarea
                          value={getDsExtendValue(batch)}
                          onChange={(e) => setDsExtendDrafts((current) => ({ ...current, [batch.id]: e.target.value }))}
                          rows={10}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-600">param_place_order_request4_open_api_d_t_o JSON</span>
                        <textarea
                          value={getDsPlaceValue(batch)}
                          onChange={(e) => setDsPlaceDrafts((current) => ({ ...current, [batch.id]: e.target.value }))}
                          rows={10}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => createBatchDsOrder(batch)}
                        disabled={Boolean(batchActionLoading[batch.id])}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50"
                      >
                        {batchActionLoading[batch.id] === "create-order" ? "Création..." : "Créer la commande DS groupée"}
                      </button>
                    </div>

                    {getFreightCheck(batch)?.items?.length ? (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Précheck freight DS</div>
                          <div className="text-[11px] text-slate-400">{formatDateTime(getFreightCheck(batch)?.checked_at)}</div>
                        </div>
                        <div className="space-y-3">
                          {(getFreightCheck(batch)?.items ?? []).map((item, index) => (
                            <div key={`${item.product_id ?? "item"}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                              <div className="font-semibold text-slate-900">{item.product_name ?? `Ligne batch DS #${index + 1}`}</div>
                              <div className="mt-1">Service demandé: {item.requested_logistics_service_name ?? "—"}</div>
                              <div>Service résolu: {item.resolved_logistics_service_name ?? "—"}</div>
                              <div>SKU DS: {item.sku_id ?? "—"}</div>
                              <div>Résultat: {item.success === false ? "Échec appel freight" : item.is_valid === false ? "Service refusé" : item.is_valid === true ? "Service valide" : "Réponse à vérifier"}</div>
                              {item.error_message ? <div className="mt-1 text-rose-600">{item.error_message}</div> : null}
                              <div className="mt-1">Services disponibles: {(item.available_services ?? []).length ? (item.available_services ?? []).join(", ") : "—"}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 md:grid-cols-2">
                      <div>Référence fournisseur: {batch.supplier_order_reference || "—"}</div>
                      <div>Dernière création DS: {formatDateTime(batch.supplier_order_payload_json?.ds_order_create?.created_at)}</div>
                      <div>DS status: {batch.supplier_order_payload_json?.ds_order_create?.success ? `Succès (${batch.supplier_order_payload_json?.ds_order_create?.order_list?.join(", ") ?? "—"})` : batch.supplier_order_payload_json?.ds_order_create?.error_message ?? "—"}</div>
                      <div>DS request_id: {batch.supplier_order_payload_json?.ds_order_create?.request_id ?? "—"}</div>
                      <div>Code erreur DS: {batch.supplier_order_payload_json?.ds_order_create?.error_code ?? "—"}</div>
                      <div>Message fournisseur: {batch.supplier_order_payload_json?.ds_order_create?.remote_error_message ?? "—"}</div>
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="pb-2 pr-4">Produit</th>
                        <th className="pb-2 pr-4">Source</th>
                        <th className="pb-2 pr-4">Qté</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(batch.items ?? []).map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 pr-4">{item.product?.title || item.product?.name || "Produit"}</td>
                          <td className="py-2 pr-4">{item.supplier_product_sku?.supplier_product?.title || "SKU"}</td>
                          <td className="py-2 pr-4">{item.quantity_ordered ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}