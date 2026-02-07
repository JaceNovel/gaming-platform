"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { API_BASE } from "@/lib/config";
import { openTidioChat } from "@/lib/tidioChat";

const HAS_API_ENV = Boolean(process.env.NEXT_PUBLIC_API_URL);
const REDEEM_GUIDE_PDF_PATH = "/images/badboy.pdf";

type OrderRow = {
  id: number;
  reference?: string | null;
  status?: string | null;
  type?: string | null;
  created_at?: string | null;
  total_price?: number | null;
  has_redeem_items?: boolean;
  orderItems?: Array<{ product?: { name?: string; type?: string } }>;
  order_items?: Array<{ product?: { name?: string; type?: string } }>;
  meta?: Record<string, unknown> | null;
};

type MeRedeemsRow = {
  id: number;
  created_at?: string | null;
  order?: {
    id: number;
    reference?: string | null;
    status?: string | null;
    created_at?: string | null;
  };
  product?: {
    id: number;
    name?: string | null;
    sku?: string | null;
  };
  denomination?: {
    id?: number | null;
    label?: string | null;
    diamonds?: number | null;
  };
  code?: string | null;
  quantity_index?: number | null;
  delivered_via?: string | null;
};

type MeRedeemsResponse = {
  data?: MeRedeemsRow[];
  current_page?: number;
  last_page?: number;
  next_page_url?: string | null;
};

const prettyOrderStatus = (status?: string | null) => {
  const s = String(status ?? "").toLowerCase();
  if (!s) return "—";
  if (["payment_success", "paid", "completed", "fulfilled"].includes(s)) return "Paiement confirmé";
  if (["payment_processing", "pending"].includes(s)) return "En validation";
  if (["payment_failed", "failed"].includes(s)) return "Échec";
  if (["paid_but_out_of_stock", "paid_waiting_stock"].includes(s)) return "En attente stock";
  return status ?? "—";
};

const statusBadgeClass = (status?: string | null) => {
  const s = String(status ?? "").toLowerCase();
  if (["payment_success", "paid", "completed", "fulfilled"].includes(s)) {
    return "bg-emerald-400/20 border-emerald-300/30 text-emerald-100";
  }
  if (["payment_processing", "pending"].includes(s)) {
    return "bg-amber-400/20 border-amber-300/30 text-amber-100";
  }
  if (["payment_failed", "failed"].includes(s)) {
    return "bg-rose-500/20 border-rose-300/30 text-rose-100";
  }
  if (["paid_but_out_of_stock", "paid_waiting_stock"].includes(s)) {
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

const isRedeemOrder = (order: OrderRow): boolean => {
  if (order.has_redeem_items === true) return true;
  const type = String(order.type ?? "").toLowerCase();
  if (type === "redeem_purchase") return true;
  const meta = order.meta ?? {};
  if (meta && typeof meta === "object") {
    const metaObj = meta as Record<string, unknown>;
    if (metaObj.requires_redeem === true) return true;
    if (metaObj.requiresRedeem === true) return true;
  }

  const items = (order.orderItems ?? order.order_items ?? []) as Array<{ product?: { type?: string | null } }>;
  const productType = String(items?.[0]?.product?.type ?? "").toLowerCase();
  return productType === "redeem";
};

function CodesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authFetch } = useAuth();

  const [loading, setLoading] = useState(HAS_API_ENV);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [deliveries, setDeliveries] = useState<MeRedeemsRow[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const [latestSeenId, setLatestSeenId] = useState<number | null>(null);

  const [banner, setBanner] = useState<string | null>(null);
  const loadSeq = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("bbshop_codes_latest_seen");
    const n = raw ? Number(raw) : NaN;
    setLatestSeenId(Number.isFinite(n) && n > 0 ? Math.trunc(n) : null);
  }, []);

  // Wallet topups have been removed.

  const redeemOrders = useMemo(() => orders.filter(isRedeemOrder), [orders]);

  const deliveredCodes = useMemo(() => {
    const rows = deliveries.filter((r) => Boolean(String(r.code ?? "").trim()));
    const getTs = (row: MeRedeemsRow) => {
      const raw = row.created_at ?? row.order?.created_at ?? null;
      if (!raw) return 0;
      const t = new Date(raw).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    return rows.sort((a, b) => getTs(b) - getTs(a));
  }, [deliveries]);

  const latestCode = deliveredCodes[0] ?? null;
  const historyCodes = deliveredCodes.slice(1, 4);
  const showNew = latestCode ? latestSeenId == null || latestCode.id !== latestSeenId : false;

  const markLatestSeen = () => {
    if (!latestCode) return;
    setLatestSeenId(latestCode.id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("bbshop_codes_latest_seen", String(latestCode.id));
    }
  };

  const formatDeliveredAt = (row: MeRedeemsRow) => {
    const raw = row.created_at ?? row.order?.created_at ?? null;
    if (!raw) return "—";
    try {
      return new Date(raw).toLocaleString("fr-FR", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const getOrderLink = (row: MeRedeemsRow) => {
    const ref = row.order?.reference;
    const id = row.order?.id;
    const key = ref ? String(ref) : id ? String(id) : "";
    return key ? `/orders/${encodeURIComponent(key)}` : null;
  };

  const loadOrders = async () => {
    if (!HAS_API_ENV) {
      setLoading(false);
      return;
    }

    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/orders`);
      if (!res.ok) return;
      const payload = await res.json().catch(() => null);
      if (loadSeq.current !== seq) return;

      const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      setOrders(rows as OrderRow[]);
    } catch {
      // ignore
    } finally {
      if (loadSeq.current === seq) setLoading(false);
    }
  };

  const resyncPaymentStatuses = async () => {
    if (!HAS_API_ENV) return;
    const candidates = orders.filter((order) => {
      const s = String(order.status ?? "").toLowerCase();
      return s === "payment_failed" || s === "payment_processing" || s === "pending" || s === "failed";
    });
    if (!candidates.length) return;

    await Promise.allSettled(
      candidates.map((order) => authFetch(`${API_BASE}/payments/fedapay/status?order_id=${order.id}`))
    );
  };

  const loadMyRedeems = async (page = 1, mode: "replace" | "append" = "replace") => {
    if (!HAS_API_ENV) return;

    setDeliveriesLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/me/redeems?per_page=20&page=${encodeURIComponent(String(page))}`);
      const payload = (await res.json().catch(() => null)) as MeRedeemsResponse | null;
      if (!res.ok) {
        if (mode === "replace") {
          setDeliveries([]);
        }
        return;
      }

      const rows = Array.isArray(payload?.data) ? payload!.data! : [];
      setDeliveries((prev) => (mode === "append" ? [...prev, ...rows] : rows));
    } catch {
      if (mode === "replace") {
        setDeliveries([]);
      }
    } finally {
      setDeliveriesLoading(false);
    }
  };

  const resendCodes = async (orderId: number) => {
    if (!HAS_API_ENV) return;

    setBanner("Envoi des codes par email...");
    try {
      const res = await authFetch(`${API_BASE}/orders/${encodeURIComponent(String(orderId))}/redeem-codes/resend`, {
        method: "POST",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.message ?? "Impossible d’envoyer l’email");
      }
      setBanner(payload?.message ?? "Codes envoyés par email.");
    } catch (error: unknown) {
      setBanner(error instanceof Error ? error.message : "Erreur inattendue");
    } finally {
      window.setTimeout(() => setBanner(null), 3500);
    }
  };

  useEffect(() => {
    void loadOrders();
    void loadMyRedeems(1, "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wallet topups have been removed.

  return (
    <div className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(180,70,255,0.30),transparent_45%),radial-gradient(circle_at_70%_50%,rgba(0,255,255,0.18),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(255,160,0,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.15),rgba(0,0,0,0.9))]" />
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />
      </div>

      <main className="w-full px-5 md:px-10 lg:px-12 py-10 pb-24">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <SectionTitle eyebrow="Livraison" label="Mes codes" />

          {banner && (
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
              {banner}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/60">Retrouve ici tous tes codes livrés (Free Fire, etc.).</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    setBanner("Vérification des paiements...");
                    await resyncPaymentStatuses();
                    await loadOrders();
                    await loadMyRedeems(1, "replace");
                    setBanner("Actualisation terminée.");
                    window.setTimeout(() => setBanner(null), 2500);
                  })();
                }}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold"
              >
                Actualiser
              </button>
              <button
                type="button"
                onClick={() => void openTidioChat({ message: "Bonjour, j’ai un souci avec mes codes / livraisons." })}
                className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
              >
                Support
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-black/45 p-5 backdrop-blur">
            {loading || deliveriesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="h-14 w-full animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : deliveredCodes.length === 0 ? (
              <div>
                {redeemOrders.length === 0 ? (
                  <>
                    <p className="text-white/80 font-semibold">Aucun code trouvé</p>
                    <p className="mt-1 text-sm text-white/60">
                      Les codes apparaissent ici après l’achat. Tu peux aussi consulter la boutique.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <GlowButton onClick={() => router.push("/shop")}>Aller à la boutique</GlowButton>
                      <GlowButton variant="secondary" onClick={() => router.push("/account")}>
                        Aller au profil
                      </GlowButton>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {redeemOrders.map((order) => {
                      const title =
                        (order.orderItems ?? order.order_items ?? [])?.[0]?.product?.name ??
                        order.reference ??
                        `Commande ${order.id}`;

                      const badgeClass = statusBadgeClass(order.status);
                      const orderStatus = prettyOrderStatus(order.status);
                      const orderRef = order.reference ?? `#${order.id}`;

                      return (
                        <div key={order.id} className="rounded-2xl border border-white/10 bg-white/5">
                          <button
                            type="button"
                            onClick={() => void resendCodes(order.id)}
                            className="w-full px-4 py-4 flex items-center justify-between gap-3 text-left"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{title}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 ${badgeClass}`}
                                >
                                  {orderStatus}
                                </span>
                                <span className="truncate">{orderRef}</span>
                              </div>
                            </div>
                            <div className="shrink-0 text-sm text-white/60">Renvoyer</div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white/85">Nouveau code</p>
                  <a
                    href={REDEEM_GUIDE_PDF_PATH}
                    download
                    className="inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                  >
                    Télécharger le guide (PDF)
                  </a>
                </div>

                {latestCode && (
                  <div
                    className={`rounded-2xl border bg-black/30 p-4 ${
                      showNew ? "border-rose-300/30 bg-rose-500/10 shadow-[0_0_0_1px_rgba(244,63,94,0.15),0_25px_80px_rgba(4,6,35,0.55)]" : "border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {showNew ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 bg-rose-400/10 px-3 py-1 text-xs font-semibold text-rose-100 animate-pulse">
                              🔴 Nouveau
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                              Code
                            </span>
                          )}
                          <span className="text-xs text-white/60">Livré le {formatDeliveredAt(latestCode)}</span>
                        </div>
                        <div className="mt-3 text-lg font-black tracking-[0.08em] text-white break-all">{latestCode.code}</div>
                        <div className="mt-2 text-xs text-white/60">
                          {latestCode.product?.name ?? latestCode.denomination?.label ?? "Recharge"}
                          {latestCode.quantity_index ? ` • #${latestCode.quantity_index}` : ""}
                          {latestCode.order?.reference ? ` • ${latestCode.order.reference}` : latestCode.order?.id ? ` • #${latestCode.order.id}` : ""}
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await copyToClipboard(String(latestCode.code ?? ""));
                            setBanner(ok ? "Code copié" : "Copie impossible");
                            if (showNew) markLatestSeen();
                            window.setTimeout(() => setBanner(null), 2000);
                          }}
                          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold"
                        >
                          Copier
                        </button>
                        {getOrderLink(latestCode) && (
                          <Link
                            href={getOrderLink(latestCode)!}
                            onClick={() => {
                              if (showNew) markLatestSeen();
                            }}
                            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-center"
                          >
                            Voir commande
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <p className="text-sm font-semibold text-white/85">Historique</p>
                  <p className="mt-1 text-xs text-white/60">Les 3 derniers codes livrés avant le nouveau.</p>
                </div>

                {historyCodes.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                    Aucun historique pour l’instant.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyCodes.map((row) => (
                      <div key={row.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                        <div className="min-w-0">
                          <div className="text-xs text-white/60">Livré le {formatDeliveredAt(row)}</div>
                          <div className="mt-1 text-sm font-semibold break-all">{row.code}</div>
                          <div className="mt-1 text-xs text-white/60">
                            {row.product?.name ?? row.denomination?.label ?? "Recharge"}
                            {row.quantity_index ? ` • #${row.quantity_index}` : ""}
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await copyToClipboard(String(row.code ?? ""));
                              setBanner(ok ? "Code copié" : "Copie impossible");
                              window.setTimeout(() => setBanner(null), 2000);
                            }}
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold"
                          >
                            Copier
                          </button>
                          {getOrderLink(row) && (
                            <Link href={getOrderLink(row)!} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-center">
                              Voir
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <GlowButton onClick={() => void loadMyRedeems(1, "replace")} variant="secondary">
                    Recharger
                  </GlowButton>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Astuce: si tu ne vois pas tes codes tout de suite, attend 5–20 secondes puis clique sur “Actualiser”.
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CodesPage() {
  return (
    <RequireAuth>
      <CodesClient />
    </RequireAuth>
  );
}
