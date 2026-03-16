"use client";

import { useCallback, useEffect, useState } from "react";
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
  supplier_account?: { label?: string | null; platform?: string | null } | null;
  items?: Array<{ id: number; quantity_ordered?: number | null; product?: { title?: string | null; name?: string | null } | null; supplier_product_sku?: { supplier_product?: { title?: string | null } | null } | null }>;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminSourcingBatchesPage() {
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

  const loadBatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/batches`, { headers: { Accept: "application/json", ...getAuthHeaders() } });
      if (!res.ok) throw new Error("Impossible de charger les lots d’achat");
      const payload = await res.json();
      setBatches(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setError("Impossible de charger les lots d’achat");
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <AdminShell title="Sourcing" subtitle="Lots d’achat et préparation des expéditions entrantes">
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