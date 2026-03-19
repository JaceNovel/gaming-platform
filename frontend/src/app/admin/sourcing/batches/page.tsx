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
  const [advancedMode, setAdvancedMode] = useState<Record<number, boolean>>({});

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

  const parseJsonObject = (raw: string, label: string) => {
    try {
      const parsed = JSON.parse(raw || "{}");
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        throw new Error(`${label} doit être un objet JSON.`);
      }

      return parsed as Record<string, unknown>;
    } catch (error: any) {
      throw new Error(error?.message ?? `${label} est invalide.`);
    }
  };

  const getDsExtendValue = (batch: Batch) => dsExtendDrafts[batch.id] ?? prettyJson(batch.supplier_order_payload_json?.ds_draft?.ds_extend_request ?? {});
  const getDsPlaceValue = (batch: Batch) => dsPlaceDrafts[batch.id] ?? prettyJson(batch.supplier_order_payload_json?.ds_draft?.param_place_order_request4_open_api_d_t_o ?? {});
  const getFreightCheck = (batch: Batch) => dsFreightChecks[batch.id] ?? batch.supplier_order_payload_json?.ds_freight_check ?? null;
  const getDsOrderState = (batch: Batch) => batch.supplier_order_payload_json?.ds_order_create ?? null;

  const fetchBatchDsDraft = async (batchIdValue: number) => {
    const res = await fetch(`${API_BASE}/admin/sourcing/batches/${batchIdValue}/aliexpress/ds-draft`, {
      headers: { Accept: "application/json", ...getAuthHeaders() },
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(payload?.message ?? "Préparation du draft DS groupé impossible");
    }

    return payload;
  };

  const loadBatchDsDraft = async (batchIdValue: number) => {
    setError("");
    setSuccess("");
    setBatchActionLoading((current) => ({ ...current, [batchIdValue]: "draft" }));
    try {
      const payload = await fetchBatchDsDraft(batchIdValue);

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
      let dsExtendRequest = parseJsonObject(getDsExtendValue(batch), "ds_extend_request");
      let placeOrderRequest = parseJsonObject(getDsPlaceValue(batch), "param_place_order_request4_open_api_d_t_o");

      if (Object.keys(placeOrderRequest).length === 0) {
        const payload = await fetchBatchDsDraft(batch.id);
        const draft = payload?.data?.draft ?? {};
        const freightCheck = (payload?.data?.freight_check ?? null) as DsFreightCheckState | null;

        dsExtendRequest = (draft?.ds_extend_request ?? {}) as Record<string, unknown>;
        placeOrderRequest = (draft?.param_place_order_request4_open_api_d_t_o ?? {}) as Record<string, unknown>;

        setDsExtendDrafts((current) => ({ ...current, [batch.id]: prettyJson(dsExtendRequest) }));
        setDsPlaceDrafts((current) => ({ ...current, [batch.id]: prettyJson(placeOrderRequest) }));
        setDsFreightChecks((current) => ({ ...current, [batch.id]: freightCheck }));
      }

      const res = await fetch(`${API_BASE}/admin/sourcing/batches/${batch.id}/aliexpress/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          ds_extend_request: Object.keys(dsExtendRequest).length > 0 ? dsExtendRequest : undefined,
          param_place_order_request4_open_api_d_t_o: Object.keys(placeOrderRequest).length > 0 ? placeOrderRequest : undefined,
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
                {(() => {
                  const freightCheck = getFreightCheck(batch);
                  const dsOrderState = getDsOrderState(batch);
                  const hasDraft = getDsPlaceValue(batch).trim() !== "{}" || getDsExtendValue(batch).trim() !== "{}";
                  const freightItems = freightCheck?.items ?? [];
                  const validFreightItems = freightItems.filter((item) => item.success !== false && item.is_valid === true).length;
                  const invalidFreightItems = freightItems.filter((item) => item.success === false || item.is_valid === false).length;
                  const showAdvanced = advancedMode[batch.id] === true;
                  const dsStateTone = dsOrderState?.success
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : dsOrderState?.error_message
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-amber-200 bg-amber-50 text-amber-700";

                  return (
                    <>
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
                  <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_45%),linear-gradient(135deg,_#fff_0%,_#f8fafc_100%)] px-5 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Workflow DS groupé</div>
                          <div className="mt-2 text-lg font-semibold text-slate-900">Créer une seule commande AliExpress pour ce lot</div>
                          <div className="mt-1 max-w-2xl text-sm text-slate-500">Le flux est maintenant guidé en 3 étapes : générer le draft, valider le freight, puis lancer la commande DS. Si le JSON est vide, le draft est régénéré automatiquement avant envoi.</div>
                        </div>
                        <div className={`rounded-2xl border px-3 py-2 text-xs font-medium ${dsStateTone}`}>
                          {dsOrderState?.success
                            ? `Commande créée${dsOrderState.order_list?.length ? ` · ${dsOrderState.order_list.join(", ")}` : ""}`
                            : dsOrderState?.error_message
                              ? "Dernière tentative en erreur"
                              : "Aucune commande DS envoyée"}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Étape 1</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">Draft</div>
                          <div className="mt-1 text-xs text-slate-500">{hasDraft ? "Draft prêt ou personnalisé" : "Aucun draft chargé"}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Étape 2</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">Freight</div>
                          <div className="mt-1 text-xs text-slate-500">{freightItems.length ? `${validFreightItems} valide(s)${invalidFreightItems ? ` · ${invalidFreightItems} à corriger` : ""}` : "Précheck non lancé"}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Étape 3</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">Commande</div>
                          <div className="mt-1 text-xs text-slate-500">{dsOrderState?.created_at ? formatDateTime(dsOrderState.created_at) : "Pas encore envoyée"}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Référence</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{batch.supplier_order_reference || "En attente"}</div>
                          <div className="mt-1 text-xs text-slate-500">AliExpress / fournisseur</div>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => loadBatchDsDraft(batch.id)}
                          disabled={Boolean(batchActionLoading[batch.id])}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
                        >
                          {batchActionLoading[batch.id] === "draft" ? "Préparation du draft..." : "1. Générer / régénérer le draft"}
                        </button>
                        <button
                          type="button"
                          onClick={() => createBatchDsOrder(batch)}
                          disabled={Boolean(batchActionLoading[batch.id])}
                          className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                        >
                          {batchActionLoading[batch.id] === "create-order" ? "Création de la commande..." : "2. Créer la commande DS groupée"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdvancedMode((current) => ({ ...current, [batch.id]: !showAdvanced }))}
                          className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
                        >
                          {showAdvanced ? "Masquer le mode avancé" : "Mode avancé"}
                        </button>
                      </div>

                      <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr,0.85fr]">
                        <div className="space-y-4">
                          {showAdvanced ? (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">JSON de préparation</div>
                                  <div className="text-xs text-slate-500">Laisse vide si tu veux repartir du draft automatique. Tu peux aussi ajuster un champ à la main.</div>
                                </div>
                                <div className="text-[11px] text-slate-400">Fallback automatique si le draft est vide</div>
                              </div>
                              <div className="grid gap-3 lg:grid-cols-2">
                                <label className="grid gap-1 text-sm">
                                  <span className="text-slate-600">ds_extend_request</span>
                                  <textarea
                                    value={getDsExtendValue(batch)}
                                    onChange={(e) => setDsExtendDrafts((current) => ({ ...current, [batch.id]: e.target.value }))}
                                    rows={11}
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700"
                                  />
                                </label>
                                <label className="grid gap-1 text-sm">
                                  <span className="text-slate-600">param_place_order_request4_open_api_d_t_o</span>
                                  <textarea
                                    value={getDsPlaceValue(batch)}
                                    onChange={(e) => setDsPlaceDrafts((current) => ({ ...current, [batch.id]: e.target.value }))}
                                    rows={11}
                                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700"
                                  />
                                </label>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">Mode simplifié</div>
                                  <div className="mt-1 text-xs text-slate-500">Les JSON techniques sont masqués. Le système utilise automatiquement le draft généré et le régénère si nécessaire avant l’envoi.</div>
                                </div>
                                <div className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white">Recommandé</div>
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Draft disponible: <span className="font-medium text-slate-900">{hasDraft ? "Oui" : "Le draft sera régénéré automatiquement"}</span></div>
                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Édition manuelle: <span className="font-medium text-slate-900">désactivée</span></div>
                              </div>
                            </div>
                          )}

                          {freightItems.length ? (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">Précheck freight DS</div>
                                  <div className="text-xs text-slate-500">Vérifie ici les services logistiques réellement acceptés par AliExpress pour chaque ligne du lot.</div>
                                </div>
                                <div className="text-[11px] text-slate-400">{formatDateTime(freightCheck?.checked_at)}</div>
                              </div>
                              <div className="space-y-3">
                                {freightItems.map((item, index) => {
                                  const ok = item.success !== false && item.is_valid === true;
                                  const tone = ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50";

                                  return (
                                    <div key={`${item.product_id ?? "item"}-${index}`} className={`rounded-2xl border p-3 text-xs text-slate-700 ${tone}`}>
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                          <div className="font-semibold text-slate-900">{item.product_name ?? `Ligne batch DS #${index + 1}`}</div>
                                          <div className="mt-1 text-slate-500">SKU DS: {item.sku_id ?? "—"}</div>
                                        </div>
                                        <div className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                          {ok ? "Valide" : item.success === false ? "Erreur freight" : "Service refusé"}
                                        </div>
                                      </div>
                                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                                        <div>Service demandé: <span className="font-medium text-slate-900">{item.requested_logistics_service_name ?? "—"}</span></div>
                                        <div>Service résolu: <span className="font-medium text-slate-900">{item.resolved_logistics_service_name ?? "—"}</span></div>
                                      </div>
                                      {item.error_message ? <div className="mt-2 font-medium text-rose-700">{item.error_message}</div> : null}
                                      <div className="mt-2 text-slate-600">Services disponibles: {(item.available_services ?? []).length ? (item.available_services ?? []).join(", ") : "—"}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-sm font-semibold text-slate-900">État DS</div>
                            <div className="mt-3 grid gap-2 text-xs text-slate-600">
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Référence fournisseur: <span className="font-medium text-slate-900">{batch.supplier_order_reference || "—"}</span></div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Dernière création: <span className="font-medium text-slate-900">{formatDateTime(dsOrderState?.created_at)}</span></div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Request ID: <span className="font-medium text-slate-900">{dsOrderState?.request_id ?? "—"}</span></div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Code erreur: <span className="font-medium text-slate-900">{dsOrderState?.error_code ?? "—"}</span></div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-sm font-semibold text-slate-900">Diagnostic rapide</div>
                            <div className="mt-3 space-y-2 text-xs text-slate-600">
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Draft chargé: <span className="font-medium text-slate-900">{hasDraft ? "Oui" : "Non"}</span></div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Lignes freight valides: <span className="font-medium text-slate-900">{validFreightItems}/{freightItems.length || 0}</span></div>
                              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">Message fournisseur: <span className="font-medium text-slate-900">{dsOrderState?.remote_error_message ?? dsOrderState?.error_message ?? "—"}</span></div>
                            </div>
                          </div>
                        </div>
                      </div>
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
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}