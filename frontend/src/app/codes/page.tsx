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
  const [deliveriesPage, setDeliveriesPage] = useState(1);
  const [deliveriesLastPage, setDeliveriesLastPage] = useState(1);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [banner, setBanner] = useState<string | null>(null);
  const loadSeq = useRef(0);

  // Wallet topups have been removed.

  const redeemOrders = useMemo(() => orders.filter(isRedeemOrder), [orders]);

  const deliveriesByOrder = useMemo(() => {
    const map = new Map<number, { order: MeRedeemsRow["order"]; items: MeRedeemsRow[] }>();

    for (const row of deliveries) {
      const orderId = row.order?.id;
      if (!orderId) continue;
      const existing = map.get(orderId);
      if (existing) {
        existing.items.push(row);
      } else {
        map.set(orderId, { order: row.order, items: [row] });
      }
    }

    return Array.from(map.entries())
      .map(([orderId, value]) => ({ orderId, order: value.order, items: value.items }))
      .sort((a, b) => (b.orderId ?? 0) - (a.orderId ?? 0));
  }, [deliveries]);

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
      const res = await authFetch(`${API_BASE}/me/redeems?per_page=50&page=${encodeURIComponent(String(page))}`);
      const payload = (await res.json().catch(() => null)) as MeRedeemsResponse | null;
      if (!res.ok) {
        if (mode === "replace") {
          setDeliveries([]);
          setDeliveriesPage(1);
          setDeliveriesLastPage(1);
        }
        return;
      }

      const rows = Array.isArray(payload?.data) ? payload!.data! : [];
      const currentPage = Number(payload?.current_page ?? page) || page;
      const lastPage = Number(payload?.last_page ?? currentPage) || currentPage;

      setDeliveries((prev) => (mode === "append" ? [...prev, ...rows] : rows));
      setDeliveriesPage(currentPage);
      setDeliveriesLastPage(lastPage);
    } catch {
      if (mode === "replace") {
        setDeliveries([]);
        setDeliveriesPage(1);
        setDeliveriesLastPage(1);
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
            ) : deliveriesByOrder.length === 0 ? (
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

                      const isOpen = selectedId === order.id;
                      const badgeClass = statusBadgeClass(order.status);
                      const orderStatus = prettyOrderStatus(order.status);
                      const orderRef = order.reference ?? `#${order.id}`;

                      return (
                        <div key={order.id} className="rounded-2xl border border-white/10 bg-white/5">
                          <button
                            type="button"
                            onClick={() => setSelectedId(isOpen ? null : order.id)}
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
                            <div className="shrink-0 text-sm text-white/60">{isOpen ? "Fermer" : "Voir"}</div>
                          </button>

                          {isOpen && (
                            <div className="px-4 pb-4">
                              {String(order.status ?? "").toLowerCase() === "payment_failed" ? (
                                <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                                  Paiement en échec. Si vous avez payé, cliquez sur Actualiser pour revalider.
                                </div>
                              ) : String(order.status ?? "").toLowerCase() === "payment_processing" ? (
                                <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                                  Paiement en cours de validation. Réessayez Actualiser dans quelques secondes.
                                </div>
                              ) : String(order.status ?? "").toLowerCase() === "paid_but_out_of_stock" ? (
                                <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                                  Échec : rupture de stock. Contacte le support si besoin.
                                </div>
                              ) : String(order.status ?? "").toLowerCase() === "paid_waiting_stock" ? (
                                <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                                  Échec : stock indisponible pour le moment. Contacte le support si besoin.
                                </div>
                              ) : (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                                  Livraison : si votre paiement est confirmé, vos codes apparaissent ici automatiquement.
                                </div>
                              )}

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <GlowButton onClick={() => void resendCodes(order.id)} variant="secondary">
                                  Renvoyer par email
                                </GlowButton>
                                <Link
                                  href={`/orders/${encodeURIComponent(order.reference ?? String(order.id))}`}
                                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold"
                                >
                                  Voir commande
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {deliveriesByOrder.map((group) => {
                  const orderStatus = prettyOrderStatus(group.order?.status);
                  const badgeClass = statusBadgeClass(group.order?.status);
                  const orderRef = group.order?.reference ?? `#${group.orderId}`;
                  const isOpen = selectedId === group.orderId;

                  const title = group.items?.[0]?.product?.name ?? `Commande ${orderRef}`;
                  const deliveredItems = group.items.filter((x) => Boolean(x.code));

                  return (
                    <div key={group.orderId} className="rounded-2xl border border-white/10 bg-white/5">
                      <button
                        type="button"
                        onClick={() => setSelectedId(isOpen ? null : group.orderId)}
                        className="w-full px-4 py-4 flex items-center justify-between gap-3 text-left"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${badgeClass}`}>
                              {orderStatus}
                            </span>
                            <span className="truncate">{orderRef}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-sm text-white/60">{isOpen ? "Fermer" : "Voir"}</div>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4">
                          {String(group.order?.status ?? "").toLowerCase() === "payment_failed" ? (
                            <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                              Paiement en échec. Si vous avez payé, cliquez sur Actualiser pour revalider.
                            </div>
                          ) : String(group.order?.status ?? "").toLowerCase() === "payment_processing" ? (
                            <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                              Paiement en cours de validation. Réessayez Actualiser dans quelques secondes.
                            </div>
                          ) : String(group.order?.status ?? "").toLowerCase() === "paid_but_out_of_stock" ? (
                            <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                              Échec : rupture de stock. Contacte le support si besoin.
                            </div>
                          ) : String(group.order?.status ?? "").toLowerCase() === "paid_waiting_stock" ? (
                            <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                              Échec : stock indisponible pour le moment. Contacte le support si besoin.
                            </div>
                          ) : deliveredItems.length === 0 ? (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                              <p>Aucun code livré pour l’instant.</p>
                              <a
                                href={REDEEM_GUIDE_PDF_PATH}
                                download
                                className="mt-2 inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                              >
                                Télécharger le guide (PDF)
                              </a>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <a
                                href={REDEEM_GUIDE_PDF_PATH}
                                download
                                className="inline-flex items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                              >
                                Télécharger le guide (PDF)
                              </a>

                              {deliveredItems.map((row) => (
                                <div
                                  key={row.id}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold truncate">{row.code}</div>
                                    <div className="text-xs text-white/60">
                                      {row.denomination?.label ? row.denomination.label : "Code"}
                                      {row.quantity_index ? ` • #${row.quantity_index}` : ""}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const ok = await copyToClipboard(String(row.code ?? ""));
                                      setBanner(ok ? "Code copié" : "Copie impossible");
                                      window.setTimeout(() => setBanner(null), 2000);
                                    }}
                                    className="shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold"
                                  >
                                    Copier
                                  </button>
                                </div>
                              ))}

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <GlowButton onClick={() => void resendCodes(group.orderId)} variant="secondary">
                                  Renvoyer par email
                                </GlowButton>
                                <Link
                                  href={`/orders/${encodeURIComponent(group.order?.reference ?? String(group.orderId))}`}
                                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold"
                                >
                                  Voir commande
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {deliveriesPage < deliveriesLastPage && (
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={deliveriesLoading}
                      onClick={() => void loadMyRedeems(deliveriesPage + 1, "append")}
                      className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold"
                    >
                      {deliveriesLoading ? "Chargement..." : "Charger plus"}
                    </button>
                  </div>
                )}
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
