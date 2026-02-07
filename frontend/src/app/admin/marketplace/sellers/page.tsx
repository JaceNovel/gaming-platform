"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import DetailsDrawer from "@/components/admin/DetailsDrawer";
import { API_BASE } from "@/lib/config";

type SellerRow = {
  id: number;
  status?: string | null;
  status_reason?: string | null;
  whatsapp_number?: string | null;
  partner_wallet_frozen?: boolean | null;
  updated_at?: string | null;
  user?: {
    id?: number;
    name?: string | null;
    email?: string | null;
  } | null;
};

type Paginated<T> = {
  data?: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
};

type SellerDetailResponse = {
  data?: {
    seller?: any;
    kycFiles?: any[];
    stats?: any;
    partnerWallet?: any;
  };
};

const EyeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className ?? "h-4 w-4"} aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const formatAmount = (value: any) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString()} FCFA`;
};

const downloadBlob = async (url: string, filename: string, headers: Record<string, string>) => {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error("Téléchargement impossible");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
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

const buildUrl = (path: string, params: Record<string, string>) => {
  const u = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (!v) continue;
    u.searchParams.set(k, v);
  }
  return u.toString();
};

export default function AdminMarketplaceSellersPage() {
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>("");
  const [detail, setDetail] = useState<SellerDetailResponse["data"] | null>(null);
  const [kycPreview, setKycPreview] = useState<{ id_front?: string; selfie?: string }>({});

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        buildUrl("/admin/marketplace/sellers", {
          search: search.trim(),
          status: status === "all" ? "" : status,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        },
      );
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Impossible de charger les vendeurs");
      const page: Paginated<SellerRow> | null = payload?.data ?? null;
      const list = Array.isArray(page?.data) ? page?.data : Array.isArray(payload?.data) ? payload.data : [];
      setRows(list);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Impossible de charger les vendeurs");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 200);
    return () => clearTimeout(t);
  }, [load]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDetailError("");
    setDetail(null);
    setDetailLoading(false);
    setKycPreview((prev) => {
      for (const u of Object.values(prev)) {
        if (u) URL.revokeObjectURL(u);
      }
      return {};
    });
  }, []);

  const openSellerDossier = useCallback(
    async (sellerId: number) => {
      if (!Number.isFinite(sellerId) || sellerId <= 0) return;

      setDrawerOpen(true);
      setDetailLoading(true);
      setDetailError("");
      setDetail(null);
      setKycPreview((prev) => {
        for (const u of Object.values(prev)) {
          if (u) URL.revokeObjectURL(u);
        }
        return {};
      });

      try {
        const res = await fetch(`${API_BASE}/admin/marketplace/sellers/${sellerId}`, {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        });
        const payload = (await res.json().catch(() => null)) as SellerDetailResponse | null;
        if (!res.ok) throw new Error((payload as any)?.message ?? "Impossible de charger le dossier vendeur");
        const data = payload?.data ?? null;
        setDetail(data);

        const types: Array<"id_front" | "selfie"> = ["id_front", "selfie"];
        await Promise.all(
          types.map(async (type) => {
            try {
              const fileExists = Array.isArray(data?.kycFiles) && data?.kycFiles?.some((f: any) => String(f?.type) === type);
              if (!fileExists) return;

              const fileRes = await fetch(`${API_BASE}/admin/marketplace/sellers/${sellerId}/kyc/${type}`, {
                headers: {
                  ...getAuthHeaders(),
                },
              });
              if (!fileRes.ok) return;
              const blob = await fileRes.blob();
              const objectUrl = URL.createObjectURL(blob);
              setKycPreview((prev) => ({ ...prev, [type]: objectUrl }));
            } catch {
              // ignore preview failures
            }
          }),
        );
      } catch (e) {
        setDetailError(e instanceof Error ? e.message : "Impossible de charger le dossier vendeur");
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  const doAction = useCallback(async (sellerId: number, action: string) => {
    if (!Number.isFinite(sellerId) || sellerId <= 0) return;
    setError("");
    try {
      let body: string | undefined = undefined;
      if (["refuse", "suspend", "ban"].includes(action)) {
        const reason = window.prompt("Raison (obligatoire)") ?? "";
        if (!reason.trim()) return;
        body = JSON.stringify({ reason: reason.trim() });
      }

      const res = await fetch(`${API_BASE}/admin/marketplace/sellers/${sellerId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message ?? "Action impossible");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
    }
  }, [load]);

  const items = useMemo(() => rows ?? [], [rows]);

  return (
    <AdminShell title="Gestion vendeur" subtitle="Vendeurs marketplace">
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Recherche (nom, email, WhatsApp...)"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">Tous statuts</option>
            <option value="pending_verification">pending_verification</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="suspended">suspended</option>
            <option value="banned">banned</option>
          </select>
          <div className="lg:col-span-4 flex items-center justify-end">
            <button onClick={() => void load()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white" disabled={loading}>
              {loading ? "Chargement..." : "Rafraîchir"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-400">
            <tr>
              <th className="pb-2 pr-4">Vendeur</th>
              <th className="pb-2 pr-4">Statut</th>
              <th className="pb-2 pr-4">WhatsApp</th>
              <th className="pb-2 pr-4">Wallet</th>
              <th className="pb-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  {loading ? "Chargement..." : "Aucun vendeur"}
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="py-3 pr-4">
                    <div className="font-semibold">#{s.id} {s.user?.name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{s.user?.email ?? "—"}</div>
                    {s.status_reason ? <div className="mt-1 text-xs text-slate-500">{s.status_reason}</div> : null}
                  </td>
                  <td className="py-3 pr-4">{s.status ?? "—"}</td>
                  <td className="py-3 pr-4">{s.whatsapp_number ?? "—"}</td>
                  <td className="py-3 pr-4">{s.partner_wallet_frozen ? "Gelé" : "Actif"}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => void openSellerDossier(s.id)}
                        title="Voir dossier vendeur"
                      >
                        <EyeIcon className="h-4 w-4" />
                        Voir
                      </button>
                      <button className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => void doAction(s.id, "approve")}>Approuver</button>
                      <button className="rounded-lg bg-amber-600 px-2 py-1 text-xs text-white" onClick={() => void doAction(s.id, "refuse")}>Refuser</button>
                      <button className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-white" onClick={() => void doAction(s.id, "suspend")}>Suspendre</button>
                      <button className="rounded-lg bg-rose-600 px-2 py-1 text-xs text-white" onClick={() => void doAction(s.id, "ban")}>Bannir</button>
                      {s.partner_wallet_frozen ? (
                        <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs" onClick={() => void doAction(s.id, "unfreeze-wallet")}>Débloquer wallet</button>
                      ) : (
                        <button className="rounded-lg border border-slate-200 px-2 py-1 text-xs" onClick={() => void doAction(s.id, "freeze-wallet")}>Bloquer wallet</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DetailsDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={detail?.seller ? `Dossier vendeur #${detail.seller?.id ?? "—"}` : "Dossier vendeur"}
        subtitle={detail?.seller?.user?.email ?? ""}
        footer={
          detail?.seller?.id ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">Validation rapide: tu peux vérifier KYC + wallet avant action.</div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => void doAction(Number(detail.seller.id), "approve")}>Approuver</button>
                <button className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => void doAction(Number(detail.seller.id), "refuse")}>Refuser</button>
                <button className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white" onClick={() => void doAction(Number(detail.seller.id), "suspend")}>Suspendre</button>
                <button className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => void doAction(Number(detail.seller.id), "ban")}>Bannir</button>
              </div>
            </div>
          ) : null
        }
      >
        {detailError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{detailError}</div>
        ) : null}

        {detailLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Chargement du dossier...</div>
        ) : detail?.seller ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Identité</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{detail.seller.kyc_full_name ?? "—"}</div>
                  <div className="mt-1 text-xs text-slate-600">DOB: {detail.seller.kyc_dob ?? "—"}</div>
                  <div className="text-xs text-slate-600">Pièce: {detail.seller.kyc_id_type ?? "—"} · {detail.seller.kyc_id_number ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">Contact</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{detail.seller.user?.name ?? "—"}</div>
                  <div className="mt-1 text-xs text-slate-600">{detail.seller.user?.email ?? "—"}</div>
                  <div className="text-xs text-slate-600">WhatsApp: {detail.seller.whatsapp_number ?? "—"}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Adresse</div>
                  <div className="mt-1 text-xs text-slate-700">{detail.seller.kyc_address ?? "—"}</div>
                  <div className="text-xs text-slate-600">{detail.seller.kyc_city ?? "—"} · {detail.seller.kyc_country ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500">Statut</div>
                  <div className="mt-1 text-sm font-bold text-slate-900">{detail.seller.status ?? "—"}</div>
                  <div className="mt-1 text-xs text-slate-600">Soumis: {detail.seller.kyc_submitted_at ?? "—"}</div>
                  {detail.seller.status_reason ? <div className="mt-1 text-xs text-slate-600">Raison: {detail.seller.status_reason}</div> : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 text-xs font-semibold text-slate-500">Fichiers KYC</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  { key: "id_front" as const, label: "Pièce d'identité" },
                  { key: "selfie" as const, label: "Selfie" },
                ]).map(({ key, label }) => {
                  const sellerId = Number(detail.seller?.id);
                  const hasFile = Array.isArray(detail.kycFiles) && detail.kycFiles.some((f: any) => String(f?.type) === key);
                  return (
                    <div key={key} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
                        <div className="text-xs font-semibold text-slate-700">{label}</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!hasFile || !Number.isFinite(sellerId)}
                            onClick={() =>
                              void downloadBlob(
                                `${API_BASE}/admin/marketplace/sellers/${sellerId}/kyc/${key}`,
                                `seller_${sellerId}_${key}.jpg`,
                                getAuthHeaders(),
                              )
                            }
                            className={
                              "rounded-lg border px-2 py-1 text-xs " +
                              (hasFile
                                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                : "border-slate-200 bg-slate-100 text-slate-400")
                            }
                          >
                            Télécharger
                          </button>
                        </div>
                      </div>
                      <div className="p-3">
                        {kycPreview[key] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={kycPreview[key]} alt={label} className="h-48 w-full rounded-xl object-cover" />
                        ) : hasFile ? (
                          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-500">
                            Aperçu en cours...
                          </div>
                        ) : (
                          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-xs text-slate-500">
                            Aucun fichier
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 text-xs font-semibold text-slate-500">Stats</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Ventes totales</div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900">{detail.stats?.total_sales ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Ventes OK</div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900">{detail.stats?.successful_sales ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Litiges</div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900">{detail.stats?.disputed_sales ?? 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Dernière vente</div>
                    <div className="mt-1 text-xs font-bold text-slate-900">{detail.stats?.last_sale_at ?? "—"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 text-xs font-semibold text-slate-500">Wallet vendeur</div>
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Disponible</div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900">{formatAmount(detail.partnerWallet?.available_balance)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">En attente</div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900">{formatAmount(detail.partnerWallet?.pending_balance)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Statut</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{detail.partnerWallet?.status ?? "—"}</div>
                    {detail.partnerWallet?.status_reason ? <div className="mt-1 text-xs text-slate-600">Raison: {detail.partnerWallet.status_reason}</div> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Aucun dossier.</div>
        )}
      </DetailsDrawer>
    </AdminShell>
  );
}
