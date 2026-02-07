"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";
import { openTidioChat } from "@/lib/tidioChat";
import DeliveryBadge from "@/components/ui/DeliveryBadge";
import { getDeliveryBadgeDisplay } from "@/lib/deliveryDisplay";

const HAS_API_ENV = Boolean(process.env.NEXT_PUBLIC_API_URL);

type OrderItem = {
  id: number | string;
  quantity: number;
  price: number;
  game_user_id?: string | null;
  delivery_status?: string | null;
  is_physical?: boolean;
  delivery_type?: string | null;
  delivery_eta_days?: number | null;
  product?: {
    id?: number | string;
    name?: string;
    type?: string;
    display_section?: string | null;
    delivery_estimate_label?: string | null;
  };
};

type OrderDetail = {
  id: number;
  reference?: string;
  status?: string;
  type?: string;
  total_price?: number;
  created_at?: string;
  delivered_at?: string | null;
  meta?: any;
  shipping_status?: string | null;
  shipping_eta_days?: number | null;
  shipping_estimated_date?: string | null;
  shipping_address_line1?: string | null;
  shipping_city?: string | null;
  shipping_country_code?: string | null;
  shipping_phone?: string | null;
  orderItems?: OrderItem[];
  order_items?: OrderItem[];
  payment?: {
    method?: string | null;
    status?: string | null;
  };
};

type RedeemCodesResponse = {
  status?: string;
  codes?: Array<{
    code: string;
    label?: string | null;
    diamonds?: number | null;
    quantity_index?: number | null;
  }>;
  has_redeem_items?: boolean;
  guide_url?: string;
};

const formatCurrency = (amount: number, countryCode?: string | null) => {
  const normalized = (countryCode ?? "CI").toUpperCase();
  const currency = ["FR", "BE"].includes(normalized) ? "EUR" : normalized === "US" ? "USD" : "XOF";
  const locale = currency === "EUR" ? "fr-FR" : currency === "USD" ? "en-US" : "fr-FR";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(
      Number.isFinite(amount) ? amount : 0,
    );
  } catch {
    return `${amount} ${currency === "XOF" ? "FCFA" : currency}`;
  }
};

const prettyStatus = (status?: string | null) => {
  const s = String(status ?? "").toLowerCase();
  if (!s) return "—";
  if (["paid", "completed", "fulfilled", "delivered"].includes(s)) return "Livrée";
  if (["failed", "payment_failed", "cancelled", "canceled", "refused", "error"].includes(s)) return "Échouée";
  if (["pending", "awaiting_payment", "payment_processing", "payment_success"].includes(s)) return "En cours";
  if (["paid_but_out_of_stock", "paid_waiting_stock"].includes(s)) return "En cours";
  return status ?? "—";
};

const statusBadgeClass = (status?: string | null) => {
  const s = String(status ?? "").toLowerCase();
  if (["paid", "completed", "fulfilled", "delivered"].includes(s)) return "bg-emerald-400/20 border-emerald-300/30 text-emerald-100";
  if (["failed", "payment_failed", "cancelled", "canceled", "refused", "error"].includes(s)) {
    return "bg-rose-500/20 border-rose-400/30 text-rose-100";
  }
  if (["pending", "awaiting_payment", "payment_processing", "payment_success", "paid_but_out_of_stock", "paid_waiting_stock"].includes(s)) {
    return "bg-amber-400/20 border-amber-300/30 text-amber-100";
  }
  return "bg-white/10 border-white/20 text-white/80";
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
};

function OrderTrackingClient({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { authFetch } = useAuth();

  const [loading, setLoading] = useState(HAS_API_ENV);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [codes, setCodes] = useState<RedeemCodesResponse | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">("idle");

  const numericId = useMemo(() => {
    const trimmed = String(params.id ?? "").trim();
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? String(Math.trunc(n)) : null;
  }, [params.id]);

  useEffect(() => {
    let active = true;
    if (!HAS_API_ENV) {
      setLoading(false);
      setOrder(null);
      setCodes(null);
      return () => {
        active = false;
      };
    }

    const resolveOrderId = async (): Promise<string | null> => {
      if (numericId) return numericId;

      try {
        const res = await authFetch(`${API_BASE}/orders`);
        if (!res.ok) return null;
        const data = await res.json();
        const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        const needle = decodeURIComponent(String(params.id ?? "")).trim();
        const match = items.find((row: any) => String(row?.reference ?? "").trim() === needle);
        const id = match?.id;
        return id ? String(id) : null;
      } catch {
        return null;
      }
    };

    (async () => {
      setLoading(true);
      setOrder(null);
      setCodes(null);
      try {
        const resolved = await resolveOrderId();
        if (!resolved) {
          if (active) setOrder(null);
          return;
        }

        const res = await authFetch(`${API_BASE}/orders/${encodeURIComponent(resolved)}`);
        if (!res.ok) {
          if (active) setOrder(null);
          return;
        }
        const detail = (await res.json()) as OrderDetail;
        if (!active) return;
        setOrder(detail);

        const codesRes = await authFetch(`${API_BASE}/orders/${encodeURIComponent(resolved)}/redeem-codes`);
        if (!codesRes.ok) {
          setCodes(null);
          return;
        }
        const codesPayload = (await codesRes.json()) as RedeemCodesResponse;
        if (!active) return;
        setCodes(codesPayload);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [API_BASE, authFetch, numericId, params.id]);

  const orderItems: OrderItem[] = useMemo(() => {
    const raw = order?.orderItems ?? order?.order_items ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [order]);

  const hasPhysicalItems = useMemo(() => orderItems.some((it) => Boolean(it?.is_physical)), [orderItems]);

  const redeemCodes = codes?.codes ?? [];
  const showRedeemBlock = Boolean(codes?.has_redeem_items);

  const handleCopyAll = async () => {
    const text = redeemCodes.map((c) => c.code).filter(Boolean).join("\n");
    if (!text) return;
    const ok = await copyToClipboard(text);
    setCopyState(ok ? "success" : "error");
    window.setTimeout(() => setCopyState("idle"), 2500);
  };

  const supportMessage = useMemo(() => {
    const ref = order?.reference ? `Référence: ${order.reference}` : `Commande: ${params.id}`;
    return `Bonjour, j’ai besoin d’aide pour ma commande. ${ref}`;
  }, [order?.reference, params.id]);

  const currencyCountryCode = (order?.shipping_country_code ?? "CI") as string;

  const orderDelivered = Boolean(order?.delivered_at) || String(order?.meta?.fulfillment_status ?? "").toLowerCase() === "fulfilled";
  const orderStatusLabel = orderDelivered ? "Livrée" : prettyStatus(order?.status);
  const orderStatusClass = orderDelivered
    ? "bg-emerald-400/20 border-emerald-300/30 text-emerald-100"
    : statusBadgeClass(order?.status);

  return (
    <div className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(180,70,255,0.30),transparent_45%),radial-gradient(circle_at_70%_50%,rgba(0,255,255,0.18),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(255,160,0,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.15),rgba(0,0,0,0.9))]" />
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />
      </div>

      <main className="w-full px-5 md:px-10 lg:px-12 py-10">
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">Suivi commande</p>
              <h1 className="mt-1 text-2xl md:text-3xl font-semibold">Détails & livraison</h1>
              <p className="mt-1 text-sm text-white/60">Tu peux retrouver ici l’état de la commande et tes codes.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={() => void openTidioChat({ message: supportMessage })}
                className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
              >
                Support
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div className="rounded-[28px] border border-white/10 bg-black/45 p-5 backdrop-blur">
              {loading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-2/3 rounded bg-white/10" />
                  <div className="h-4 w-1/2 rounded bg-white/10" />
                  <div className="h-4 w-1/3 rounded bg-white/10" />
                </div>
              ) : !order ? (
                <div>
                  <p className="text-white/80 font-semibold">Commande introuvable</p>
                  <p className="mt-1 text-sm text-white/60">
                    Impossible de charger la commande. Vérifie l’identifiant, ou ouvre le support.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/45">Identifiant</p>
                    <p className="mt-1 text-lg font-semibold text-white">#{order.id}</p>
                    <p className="mt-1 text-sm text-white/60">Référence: {order.reference ?? "—"}</p>
                    <p className="mt-1 text-sm text-white/60">
                      {order.created_at ? `Créée le ${new Date(order.created_at).toLocaleString("fr-FR")}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${orderStatusClass}`}
                    >
                      {orderStatusLabel}
                    </span>
                    <p className="mt-2 text-lg font-semibold text-amber-200">
                      {formatCurrency(Number(order.total_price ?? 0), currencyCountryCode)}
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      Paiement: {order.payment?.method ?? "—"} {order.payment?.status ? `• ${order.payment.status}` : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {order && (
              <div className="rounded-[28px] border border-white/10 bg-black/45 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.35em] text-white/45">Articles</p>
                <div className="mt-4 space-y-3">
                  {orderItems.length === 0 ? (
                    <p className="text-sm text-white/60">Aucun article détecté.</p>
                  ) : (
                    orderItems.map((it, idx) => (
                      <div key={String(it.id ?? idx)} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{it.product?.name ?? "Produit"}</p>
                            {(() => {
                              const delivery = getDeliveryBadgeDisplay({
                                type: it.product?.type ?? null,
                                display_section: it.product?.display_section ?? null,
                                delivery_estimate_label: it.product?.delivery_estimate_label ?? null,
                              });
                              return delivery ? (
                                <div className="mt-2 flex justify-start">
                                  <DeliveryBadge delivery={delivery} />
                                </div>
                              ) : null;
                            })()}
                            <p className="mt-1 text-xs text-white/60">
                              Quantité: {it.quantity} • {formatCurrency(Number(it.price ?? 0), currencyCountryCode)}
                            </p>
                            {it.game_user_id && (
                              <p className="mt-1 text-xs text-white/60">ID jeu: {it.game_user_id}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-white/60">Statut livraison</p>
                            <p className="mt-1 text-sm font-semibold text-white">{prettyStatus(it.delivery_status)}</p>
                            {it.delivery_eta_days ? (
                              <p className="mt-1 text-xs text-white/60">ETA: {it.delivery_eta_days} jours</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {order && hasPhysicalItems && (
              <div className="rounded-[28px] border border-white/10 bg-black/45 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.35em] text-white/45">Livraison</p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/60">Statut</p>
                    <p className="mt-1 text-sm font-semibold text-white">{prettyStatus(order.shipping_status)}</p>
                    <p className="mt-2 text-xs text-white/60">
                      ETA: {order.shipping_eta_days ? `${order.shipping_eta_days} jours` : "—"}
                      {order.shipping_estimated_date ? ` • ${order.shipping_estimated_date}` : ""}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/60">Adresse</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {order.shipping_address_line1 || "Adresse non renseignée"}
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      {order.shipping_city ? `${order.shipping_city} ` : ""}
                      {order.shipping_country_code ? `(${order.shipping_country_code})` : ""}
                    </p>
                    {order.shipping_phone ? (
                      <p className="mt-1 text-xs text-white/60">Téléphone: {order.shipping_phone}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {order && showRedeemBlock && (
              <div className="rounded-[28px] border border-white/10 bg-black/45 p-5 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/45">Codes</p>
                    <h2 className="mt-1 text-lg font-semibold">Tes redeem codes</h2>
                    <p className="mt-1 text-sm text-white/60">
                      {codes?.status === "paid_but_out_of_stock"
                        ? "Rupture de stock : on prépare ta commande et on te prévient dès que possible."
                        : redeemCodes.length
                          ? "Copie tes codes puis utilise le guide si besoin."
                          : "Les codes ne sont pas encore disponibles. Réessaie dans quelques instants."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {codes?.guide_url ? (
                      <Link
                        href={codes.guide_url}
                        target="_blank"
                        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold"
                      >
                        Guide
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleCopyAll}
                      disabled={redeemCodes.length === 0}
                      className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60"
                    >
                      Copier tout
                    </button>
                  </div>
                </div>

                {copyState !== "idle" && (
                  <div
                    className={`mt-4 rounded-2xl border p-3 text-sm ${
                      copyState === "success"
                        ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                        : "border-rose-300/30 bg-rose-500/10 text-rose-100"
                    }`}
                  >
                    {copyState === "success" ? "Codes copiés." : "Copie impossible sur cet appareil."}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {redeemCodes.map((c, idx) => (
                    <div key={`${c.code}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white break-all">{c.code}</p>
                          <p className="mt-1 text-xs text-white/60">
                            {c.label ? `${c.label}` : ""}
                            {c.diamonds ? ` • ${c.diamonds} diamonds` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await copyToClipboard(c.code);
                            setCopyState(ok ? "success" : "error");
                            window.setTimeout(() => setCopyState("idle"), 1800);
                          }}
                          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold"
                        >
                          Copier
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function OrderTrackingPage({ params }: { params: { id: string } }) {
  return (
    <RequireAuth>
      <OrderTrackingClient params={params} />
    </RequireAuth>
  );
}
