"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";
import { getDeliveryDisplay } from "@/lib/deliveryDisplay";

type StatusKey = "loading" | "success" | "failed" | "pending" | "cancelled" | "error";

type RedeemCodeRow = {
  code: string;
  label?: string | null;
  diamonds?: number | null;
  quantity_index?: number;
};

type RedeemCodesResponse = {
  status?: string;
  codes?: RedeemCodeRow[];
  guide_url?: string | null;
  has_redeem_items?: boolean;
};

type OrderItemProduct = {
  type?: string | null;
  name?: string | null;
  delivery_estimate_label?: string | null;
  display_section?: string | null;
};

type OrderItemRow = {
  product?: OrderItemProduct | null;
};

type OrderShowResponse = {
  id?: number;
  status?: string;
  type?: string;
  meta?: Record<string, unknown> | null;
  orderItems?: OrderItemRow[];
  order_items?: OrderItemRow[];
};

type PostPurchaseKind = "redeem" | "account" | "subscription" | "accessory";

function normalizeClientStatus(raw: string | null): StatusKey | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === "success" || v === "paid" || v === "accepted" || v === "approved") return "success";
  if (v === "failed" || v === "refused" || v === "declined" || v === "expired") return "failed";
  if (v === "pending") return "pending";
  if (v === "cancelled" || v === "canceled" || v === "cancel") return "cancelled";
  return null;
}

function OrderConfirmationScreen() {
  const { authFetch } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const order = searchParams.get("order");
  const initialStatus = normalizeClientStatus(searchParams.get("status"));
  const transactionIdFromUrl = searchParams.get("transaction_id") ?? searchParams.get("id");

  const [status, setStatus] = useState<StatusKey>("loading");
  const [message, setMessage] = useState("Vérification du paiement...");
  const [pollStartedAt] = useState(() => Date.now());
  const [details, setDetails] = useState<{ transactionId?: string; orderId?: number }>({});
  const [checking, setChecking] = useState(false);
  const [redeemCodes, setRedeemCodes] = useState<RedeemCodeRow[]>([]);
  const [guideUrl, setGuideUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [outOfStock, setOutOfStock] = useState(false);
  const [postPurchaseKind, setPostPurchaseKind] = useState<PostPurchaseKind>("accessory");
  const [postPurchaseTitle, setPostPurchaseTitle] = useState<string>("Votre achat est confirmé");
  const [postPurchaseAccessoryEstimateLabel, setPostPurchaseAccessoryEstimateLabel] = useState<string | null>(null);

  const postPurchaseDeliveryLabel = useMemo(() => {
    if (postPurchaseKind === "redeem") return getDeliveryDisplay({ type: "recharge" })?.label ?? null;
    if (postPurchaseKind === "subscription") return getDeliveryDisplay({ type: "subscription" })?.label ?? null;
    if (postPurchaseKind === "account") return getDeliveryDisplay({ type: "account" })?.label ?? null;
    if (postPurchaseKind === "accessory" && postPurchaseAccessoryEstimateLabel) {
      return (
        getDeliveryDisplay({
          type: "item",
          delivery_estimate_label: postPurchaseAccessoryEstimateLabel,
        })?.label ?? null
      );
    }
    return null;
  }, [postPurchaseAccessoryEstimateLabel, postPurchaseKind]);

  const numericOrderId = useMemo(() => {
    const n = Number(order);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [order]);

  const fetchStatus = useCallback(async () => {
    if (!numericOrderId) {
      setStatus("error");
      setMessage("Référence de commande introuvable.");
      return;
    }

    setChecking(true);
    try {
      const orderRes = await authFetch(`${API_BASE}/orders/${numericOrderId}`);
      const orderPayload = (await orderRes.json().catch(() => null)) as OrderShowResponse | null;
      if (!orderRes.ok) {
        setStatus(initialStatus ?? "error");
        setMessage("Impossible de vérifier la commande.");
        return;
      }

      const orderStatus = String(orderPayload?.status ?? "").toLowerCase();
      setDetails({ orderId: orderPayload?.id ?? numericOrderId });

      if (orderStatus === "payment_success") {
        setStatus("success");

        const meta = (orderPayload?.meta ?? {}) as Record<string, unknown>;
        const fulfillmentStatus = String(meta?.fulfillment_status ?? "").toLowerCase();
        if (fulfillmentStatus === "out_of_stock" || fulfillmentStatus === "waiting_stock") {
          setOutOfStock(true);
          setMessage("Commande payée – stock indisponible pour le moment.");
          setShowModal(true);
          return;
        }

        setOutOfStock(false);
        setMessage("Paiement confirmé ! Merci pour votre achat.");

        // Vider le panier après paiement confirmé
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("bbshop_cart");
        }

        const orderItemsRaw = orderPayload?.orderItems ?? orderPayload?.order_items ?? [];
        const orderItems = Array.isArray(orderItemsRaw) ? orderItemsRaw : [];
        const types = orderItems
          .map((row) => String(row?.product?.type ?? "").toLowerCase())
          .filter(Boolean);

        const firstAccessoryEstimateLabel =
          orderItems
            .map((row) => row?.product)
            .find((p) => String(p?.type ?? "").toLowerCase() === "item")?.delivery_estimate_label ?? null;
        setPostPurchaseAccessoryEstimateLabel(firstAccessoryEstimateLabel);

        const codesRes = await authFetch(`${API_BASE}/orders/${numericOrderId}/redeem-codes`);
        const codesPayload = (await codesRes.json().catch(() => null)) as RedeemCodesResponse | null;
        if (codesRes.ok) {
          const list = Array.isArray(codesPayload?.codes) ? codesPayload!.codes! : [];
          setRedeemCodes(list);
          setGuideUrl(codesPayload?.guide_url ?? null);

          const isRedeem = Boolean(codesPayload?.has_redeem_items);
          if (isRedeem) {
            setPostPurchaseKind("redeem");
            setPostPurchaseTitle("Recharge confirmée");
            setPostPurchaseAccessoryEstimateLabel(null);
            setShowModal(true);
            return;
          }

          if (types.includes("account")) {
            setPostPurchaseKind("account");
            setPostPurchaseTitle("Nous préparons le compte");
            setPostPurchaseAccessoryEstimateLabel(null);
            setShowModal(true);
            return;
          }

          if (types.includes("subscription")) {
            setPostPurchaseKind("subscription");
            setPostPurchaseTitle("Votre demande est en attente");
            setPostPurchaseAccessoryEstimateLabel(null);
            setShowModal(true);
            return;
          }

          setPostPurchaseKind("accessory");
          setPostPurchaseTitle("Achat confirmé");
          setShowModal(true);
        }

        return;
      }

      if (orderStatus === "payment_failed") {
        setStatus("failed");
        setMessage("Paiement échoué ou non validé. Merci de réessayer.");
        return;
      }

      // Non-confirmed: keep a short grace period where we only show verification.
      const elapsed = Date.now() - pollStartedAt;
      if (elapsed <= 30_000) {
        setStatus("loading");
        setMessage("Vérification du paiement...");
        return;
      }

      setStatus("failed");
      setMessage("Paiement échoué ou non validé. Merci de réessayer.");
    } catch {
      setStatus(initialStatus ?? "error");
      setMessage("Connexion impossible pour vérifier le paiement.");
    } finally {
      setChecking(false);
    }
  }, [authFetch, initialStatus, numericOrderId, pollStartedAt]);

  useEffect(() => {
    // Affiche un message immédiat basé sur le param `status`, puis vérifie côté serveur.
    if (initialStatus === "success") setMessage("✅ Paiement accepté ! Vérification...");
    if (initialStatus === "failed") setMessage("❌ Paiement refusé. Vérification...");
    if (initialStatus === "cancelled") setMessage("Paiement annulé. Vérification...");
    if (initialStatus === "pending") setMessage("⏳ Paiement en attente. Vérification...");

    fetchStatus();
  }, [fetchStatus, initialStatus]);

  useEffect(() => {
    if (status === "success" || status === "error") return;
    if (checking) return;

    // Keep polling even when status is "failed" because "non confirmé" is treated as failed.
    const elapsed = Date.now() - pollStartedAt;
    if (elapsed > 30_000) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [checking, fetchStatus, pollStartedAt, status]);

  const statusStyle =
    status === "success"
      ? "text-emerald-300"
      : status === "failed"
        ? "text-rose-300"
        : status === "pending" || status === "cancelled"
          ? "text-amber-200"
          : "text-white";

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mobile-shell min-h-screen py-6 pb-24">
      {showModal ? null : <SectionTitle eyebrow="Paiement" label="Confirmation" />}

      {showModal ? (
        <div className="flex min-h-[75dvh] items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#0b0b16] p-6 text-white shadow-2xl">
            {outOfStock ? (
              <>
                <h3 className="text-xl font-semibold">En attente de réapprovisionnement</h3>
                <p className="mt-2 text-sm text-white/70">
                  Votre commande est payée. Les codes seront envoyés dès que le stock est réapprovisionné.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold">{postPurchaseTitle}</h3>
                {postPurchaseDeliveryLabel ? (
                  <div className="mt-3 inline-flex max-w-full rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                    {postPurchaseDeliveryLabel}
                  </div>
                ) : null}

                {postPurchaseKind === "redeem" ? (
                  redeemCodes.length ? (
                    <>
                      <p className="mt-2 text-sm text-white/70">
                        Copiez votre/vos code(s) ci-dessous. Gardez-les en sécurité.
                      </p>
                      <div className="mt-4 space-y-3">
                        {redeemCodes.map((code, index) => (
                          <div key={`${code.code}-${index}`} className="rounded-xl border border-white/10 p-3">
                            <div className="text-xs text-white/50">
                              {code.label ?? "Recharge"} {code.diamonds ? `(${code.diamonds} diamants)` : ""}
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span className="font-mono text-sm text-white">{code.code}</span>
                              <button
                                onClick={() => handleCopy(code.code)}
                                className="rounded-full border border-white/20 px-3 py-1 text-xs"
                              >
                                Copier
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => handleCopy(redeemCodes.map((c) => c.code).join("\n"))}
                          className="rounded-full bg-white/10 px-4 py-2 text-xs"
                        >
                          Copier tout
                        </button>
                        {guideUrl && (
                          <a
                            href={guideUrl}
                            className="rounded-full bg-emerald-500/80 px-4 py-2 text-xs text-white"
                          >
                            Télécharger le guide
                          </a>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-white/70">
                      Paiement confirmé. Vos codes peuvent prendre quelques instants à apparaître.
                      Vous les recevrez aussi par mail et dans l’icône mail (boîte de réception).
                    </p>
                  )
                ) : postPurchaseKind === "account" ? (
                  <p className="mt-2 text-sm text-white/70">
                    Nous préparons votre compte. Les identifiants seront envoyés par email. Pensez à vérifier vos spams.
                  </p>
                ) : postPurchaseKind === "subscription" ? (
                  <p className="mt-2 text-sm text-white/70">
                    Votre demande est en attente. Activation en préparation, vous serez notifié dès que c’est terminé.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-white/70">
                    Merci pour votre achat. Votre commande est en préparation. Vous serez notifié dès qu’elle sera prête.
                  </p>
                )}
              </>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <GlowButton className="flex-1 justify-center" onClick={() => router.push("/account")}>
                Mon compte
              </GlowButton>
              <GlowButton variant="secondary" className="flex-1 justify-center" onClick={() => router.push("/shop")}>
                Retour boutique
              </GlowButton>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card mt-6 space-y-4 rounded-2xl border border-white/10 p-6">
          <p className={`text-lg font-semibold ${statusStyle}`}>{message}</p>

          <div className="space-y-1 text-sm text-white/60">
            <p>
              Commande <span className="ml-2 font-semibold text-white">{details.orderId ?? numericOrderId ?? "N/A"}</span>
            </p>
            <p>
              Transaction <span className="ml-2 font-mono text-white/80">{details.transactionId ?? transactionIdFromUrl ?? "N/A"}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <GlowButton className="flex-1 justify-center" onClick={() => router.push("/account")}>Mon compte</GlowButton>
            <GlowButton variant="secondary" className="flex-1 justify-center" onClick={() => router.push("/shop")}>Retour boutique</GlowButton>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <RequireAuth>
      <OrderConfirmationScreen />
    </RequireAuth>
  );
}
