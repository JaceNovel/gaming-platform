"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { API_BASE } from "@/lib/config";

type InboundShipment = {
  id: number;
  shipment_reference?: string | null;
  carrier_name?: string | null;
  tracking_number?: string | null;
  status?: string | null;
  procurement_batch?: {
    id: number;
    batch_number?: string | null;
    items?: Array<{ id: number; quantity_ordered?: number | null; product?: { title?: string | null; name?: string | null } | null }>;
  } | null;
  receipts?: Array<{ id: number; received_at?: string | null; items?: Array<{ product?: { title?: string | null; name?: string | null } | null; quantity_received?: number | null }> }>;
};

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function AdminSourcingInboundPage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") === "aliexpress" ? "aliexpress" : "alibaba";
  const platformLabel = platform === "aliexpress" ? "AliExpress" : "Alibaba";
  const [shipments, setShipments] = useState<InboundShipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [shipmentId, setShipmentId] = useState("");
  const [batchItemId, setBatchItemId] = useState("");
  const [quantityReceived, setQuantityReceived] = useState("1");
  const [quantityDamaged, setQuantityDamaged] = useState("0");
  const [quantityMissing, setQuantityMissing] = useState("0");
  const [notes, setNotes] = useState("");

  const loadShipments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/inbound-shipments?platform=${platform}`, { headers: { Accept: "application/json", ...getAuthHeaders() } });
      if (!res.ok) throw new Error(`Impossible de charger les réceptions ${platformLabel}`);
      const payload = await res.json();
      setShipments(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setError(`Impossible de charger les réceptions ${platformLabel}`);
    } finally {
      setLoading(false);
    }
  }, [platform, platformLabel]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  useEffect(() => {
    if (!shipmentId && shipments.length) setShipmentId(String(shipments[0].id));
  }, [shipmentId, shipments]);

  const selectedShipment = useMemo(() => shipments.find((item) => String(item.id) === shipmentId) ?? null, [shipmentId, shipments]);
  const batchItems = selectedShipment?.procurement_batch?.items ?? [];

  useEffect(() => {
    if (!batchItemId && batchItems.length) setBatchItemId(String(batchItems[0].id));
  }, [batchItemId, batchItems]);

  const createReceipt = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/admin/sourcing/warehouse-receipts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          inbound_shipment_id: Number(shipmentId),
          notes: notes.trim() || undefined,
          items: [
            {
              procurement_batch_item_id: Number(batchItemId),
              quantity_received: Number(quantityReceived),
              quantity_damaged: Number(quantityDamaged),
              quantity_missing: Number(quantityMissing),
            },
          ],
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Création de la réception impossible");
      }
      setSuccess("Réception enregistrée et stock local mis à jour.");
      setNotes("");
      setQuantityReceived("1");
      setQuantityDamaged("0");
      setQuantityMissing("0");
      await loadShipments();
    } catch (err: any) {
      setError(err?.message ?? "Création de la réception impossible");
    }
  };

  return (
    <AdminShell title={platformLabel} subtitle="Réceptions d’entrepôt et incrément du stock local">
      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <form onSubmit={createReceipt} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Enregistrer une réception</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Expédition entrante</span>
              <select value={shipmentId} onChange={(e) => setShipmentId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
                {shipments.map((shipment) => (
                  <option key={shipment.id} value={shipment.id}>{shipment.shipment_reference || `Shipment #${shipment.id}`} · {shipment.procurement_batch?.batch_number || "Lot"}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Ligne de lot</span>
              <select value={batchItemId} onChange={(e) => setBatchItemId(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2">
                {batchItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.product?.title || item.product?.name || "Produit"} · qté {item.quantity_ordered ?? 0}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="grid gap-1 text-sm"><span className="text-slate-600">Reçu</span><input value={quantityReceived} onChange={(e) => setQuantityReceived(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="grid gap-1 text-sm"><span className="text-slate-600">Abîmé</span><input value={quantityDamaged} onChange={(e) => setQuantityDamaged(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" /></label>
              <label className="grid gap-1 text-sm"><span className="text-slate-600">Manquant</span><input value={quantityMissing} onChange={(e) => setQuantityMissing(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" /></label>
            </div>
            <label className="grid gap-1 text-sm"><span className="text-slate-600">Notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="rounded-xl border border-slate-200 px-3 py-2" /></label>
            <button type="submit" className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white">Enregistrer la réception</button>
            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Expéditions et réceptions</h2>
              <p className="text-sm text-slate-500">Suivi des entrées entrepôt et des quantités reçues.</p>
            </div>
            <button type="button" onClick={loadShipments} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Rafraîchir</button>
          </div>
          <div className="mt-4 space-y-4">
            {!loading && shipments.length === 0 ? <div className="text-sm text-slate-500">Aucune expédition entrante.</div> : null}
            {shipments.map((shipment) => (
              <div key={shipment.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{shipment.shipment_reference || `Shipment #${shipment.id}`}</div>
                    <div className="text-xs text-slate-500">{shipment.procurement_batch?.batch_number || "Lot"} · {shipment.carrier_name || "Transporteur"} · {shipment.status || "pending"}</div>
                  </div>
                  <div className="text-xs text-slate-500">{shipment.tracking_number || "Sans tracking"}</div>
                </div>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  {(shipment.receipts ?? []).length === 0 ? <div>Aucune réception enregistrée.</div> : null}
                  {(shipment.receipts ?? []).map((receipt) => (
                    <div key={receipt.id} className="rounded-xl bg-slate-50 px-3 py-2">
                      <div className="font-medium text-slate-700">Réception #{receipt.id} · {receipt.received_at || "—"}</div>
                      <div className="mt-1">
                        {(receipt.items ?? []).map((item, index) => (
                          <div key={`${receipt.id}-${index}`}>{item.product?.title || item.product?.name || "Produit"} · {item.quantity_received ?? 0}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}