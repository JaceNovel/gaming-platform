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

type OrderRow = {
  id: number;
  reference?: string | null;
  status?: string | null;
  type?: string | null;
  created_at?: string | null;
  total_price?: number | null;
  orderItems?: Array<{ product?: { name?: string; type?: string } }>;
  order_items?: Array<{ product?: { name?: string; type?: string } }>;
  meta?: any;
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

const prettyOrderStatus = (status?: string | null) => {
  const s = String(status ?? "").toLowerCase();
  if (!s) return "—";
  if (s === "paid" || s === "completed") return "Payée";
  if (s === "fulfilled") return "Livrée";
  if (s === "pending") return "En cours";
  if (s === "failed") return "Échouée";
  if (s === "paid_but_out_of_stock") return "Rupture";
  return status ?? "—";
};

const statusBadgeClass = (status?: string | null) => {
  const s = String(status ?? "").toLowerCase();
  if (s === "paid" || s === "fulfilled") return "bg-emerald-400/20 border-emerald-300/30 text-emerald-100";
  if (s === "failed") return "bg-rose-500/20 border-rose-300/30 text-rose-100";
  if (s === "paid_but_out_of_stock") return "bg-amber-400/20 border-amber-300/30 text-amber-100";
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
  const type = String(order.type ?? "").toLowerCase();
  if (type === "redeem_purchase") return true;
  const meta = order.meta ?? {};
  if (meta && typeof meta === "object") {
    if (meta.requires_redeem === true) return true;
    if (meta.requiresRedeem === true) return true;
  }

  const items = (order.orderItems ?? order.order_items ?? []) as Array<any>;
  const productType = String(items?.[0]?.product?.type ?? "").toLowerCase();
  return productType === "redeem";
};

function CodesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authFetch } = useAuth();

  const [loading, setLoading] = useState(HAS_API_ENV);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [codesByOrder, setCodesByOrder] = useState<Record<number, RedeemCodesResponse | null>>({});
  const [codesLoading, setCodesLoading] = useState<Record<number, boolean>>({});

  const [banner, setBanner] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const topupBanner = useMemo(() => {
    const status = (searchParams.get("topup_status") ?? "").toLowerCase();
    if (!status) return null;
    if (["success", "completed", "paid"].includes(status)) return "Recharge wallet réussie.";
    if (["failed", "cancelled", "canceled"].includes(status)) return "Recharge wallet échouée ou annulée.";
    return "Recharge wallet en attente de confirmation.";
  }, [searchParams]);

  const redeemOrders = useMemo(() => orders.filter(isRedeemOrder), [orders]);

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

  const loadCodesForOrder = async (orderId: number) => {
    if (!HAS_API_ENV) return;

    setCodesLoading((prev) => ({ ...prev, [orderId]: true }));
    try {
      const res = await authFetch(`${API_BASE}/orders/${encodeURIComponent(String(orderId))}/redeem-codes`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setCodesByOrder((prev) => ({ ...prev, [orderId]: null }));
        return;
      }
      setCodesByOrder((prev) => ({ ...prev, [orderId]: payload as RedeemCodesResponse }));
    } catch {
      setCodesByOrder((prev) => ({ ...prev, [orderId]: null }));
    } finally {
      setCodesLoading((prev) => ({ ...prev, [orderId]: false }));
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
    } catch (error: any) {
      setBanner(error?.message ?? "Erreur inattendue");
    } finally {
      window.setTimeout(() => setBanner(null), 3500);
    }
  };

  useEffect(() => {
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (topupBanner) {
      setBanner(topupBanner);
      const timer = window.setTimeout(() => {
        setBanner(null);
        router.replace("/codes");
      }, 4500);
      return () => window.clearTimeout(timer);
    }
  }, [router, topupBanner]);

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
                onClick={() => void loadOrders()}
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
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="h-14 w-full animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : redeemOrders.length === 0 ? (
              <div>
                <p className="text-white/80 font-semibold">Aucun code trouvé</p>
                <p className="mt-1 text-sm text-white/60">
                  Les codes apparaissent ici après l’achat. Tu peux aussi consulter la boutique.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <GlowButton onClick={() => router.push("/shop")}>Aller à la boutique</GlowButton>
                  <GlowButton variant="secondary" onClick={() => router.push("/account")}>Aller au profil</GlowButton>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {redeemOrders.map((order) => {
                  const title =
                    (order.orderItems ?? order.order_items ?? [])?.[0]?.product?.name ??
                    order.reference ??
                    `Commande ${order.id}`;
                  const isSelected = selectedId === order.id;
                  const codesResp = codesByOrder[order.id] ?? null;
                  const codes = codesResp?.codes ?? [];
                  const codesStatus = codesResp?.status ?? order.status;
                  const codesLoadingNow = Boolean(codesLoading[order.id]);

                  return (
                    <div key={order.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <button
                        type="button"
                        onClick={() => {
                          const next = isSelected ? null : order.id;
                          setSelectedId(next);
                          if (next && codesByOrder[order.id] === undefined) {
                            void loadCodesForOrder(order.id);
                          }
                        }}
                        className="w-full text-left"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{title}</p>
                            <p className="mt-1 text-xs text-white/60">
                              {order.reference ? `${order.reference} • ` : ""}
                              {order.created_at ? new Date(order.created_at).toLocaleString("fr-FR") : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                                codesStatus,
                              )}`}
                            >
                              {prettyOrderStatus(codesStatus)}
                            </span>
                            <p className="mt-2 text-xs text-white/60">Tap pour voir</p>
                          </div>
                        </div>
                      </button>

                      {isSelected && (
                        <div className="mt-4">
                          {codesLoadingNow ? (
                            <div className="space-y-2">
                              {Array.from({ length: 3 }).map((_, idx) => (
                                <div key={idx} className="h-10 w-full animate-pulse rounded-xl bg-black/30" />
                              ))}
                            </div>
                          ) : codesResp && codesResp.status === "paid_but_out_of_stock" ? (
                            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                              Rupture de stock: on prépare ta commande et on te prévient dès que possible.
                            </div>
                          ) : codes.length === 0 ? (
                            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                              Codes pas encore disponibles. Réessaie dans quelques instants.
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void loadCodesForOrder(order.id)}
                                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold"
                                >
                                  Réessayer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void openTidioChat({
                                    message: `Bonjour, je n’ai pas reçu mes codes. Commande: ${order.reference ?? order.id}`,
                                  })}
                                  className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100"
                                >
                                  Contacter support
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-xs text-white/60">
                                  {codes.length} code(s)
                                  {codesResp?.guide_url ? (
                                    <span>
                                      {" "}•{" "}
                                      <Link
                                        href={codesResp.guide_url}
                                        target="_blank"
                                        className="underline underline-offset-4 hover:text-white"
                                      >
                                        Guide
                                      </Link>
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const text = codes.map((c) => c.code).filter(Boolean).join("\n");
                                      const ok = await copyToClipboard(text);
                                      setBanner(ok ? "Codes copiés." : "Copie impossible sur cet appareil.");
                                      window.setTimeout(() => setBanner(null), 1600);
                                    }}
                                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold"
                                  >
                                    Copier tout
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void resendCodes(order.id)}
                                    className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100"
                                  >
                                    Renvoyer par email
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/orders/${order.id}`)}
                                    className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-xs font-semibold"
                                  >
                                    Voir commande
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3 space-y-2">
                                {codes.map((c, idx) => (
                                  <div
                                    key={`${order.id}-${c.code}-${idx}`}
                                    className="rounded-xl border border-white/10 bg-black/30 p-3"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
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
                                          setBanner(ok ? "Code copié." : "Copie impossible sur cet appareil.");
                                          window.setTimeout(() => setBanner(null), 1400);
                                        }}
                                        className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold"
                                      >
                                        Copier
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
