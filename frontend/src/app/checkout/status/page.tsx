"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";
import { getDeliveryDisplay } from "@/lib/deliveryDisplay";

type StatusKey = "loading" | "success" | "failed" | "pending" | "error";

type OrderItemProduct = {
  type?: string | null;
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

function CheckoutStatusScreen() {
  const { authFetch } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<StatusKey>("loading");
  const [message, setMessage] = useState("Vérification du paiement...");
  const [pollStartedAt] = useState(() => Date.now());
  const [details, setDetails] = useState<{ transactionId?: string; orderId?: number }>({});
  const [checking, setChecking] = useState(false);
  const [redeemCodes, setRedeemCodes] = useState<
    Array<{ code: string; label?: string | null; diamonds?: number | null; quantity_index?: number }>
  >([]);
  const [guideUrl, setGuideUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [outOfStock, setOutOfStock] = useState(false);
  const [postPurchaseKind, setPostPurchaseKind] = useState<PostPurchaseKind>("accessory");

  const postPurchaseDeliveryLabel = useMemo(() => {
    if (postPurchaseKind === "redeem") return getDeliveryDisplay({ type: "recharge" })?.label ?? null;
    if (postPurchaseKind === "subscription") return getDeliveryDisplay({ type: "subscription" })?.label ?? null;
    if (postPurchaseKind === "account") return getDeliveryDisplay({ type: "account" })?.label ?? null;
    return null;
  }, [postPurchaseKind]);

  const orderId = searchParams.get("order_id") ?? searchParams.get("order");

  const numericOrderId = useMemo(() => {
    const n = Number(orderId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [orderId]);

  const fetchStatus = useCallback(async () => {
    if (!transactionId && !orderId) {
      setStatus("error");
      setMessage("Référence de paiement introuvable.");
      return;
    }

    setChecking(true);
    try {
      const qs = new URLSearchParams();
      if (transactionId) qs.set("transaction_id", transactionId);
      if (orderId) qs.set("order_id", orderId);
      qs.set("wait", "1");

      const endpoint = provider === "cinetpay" ? "cinetpay" : "fedapay";
      const res = await authFetch(`${API_BASE}/payments/${endpoint}/status?${qs.toString()}`);
      const payload = (await res.json().catch(() => null)) as PaymentStatusResponse | null;

      if (!res.ok) {
        setStatus("error");
        setMessage(payload?.message ?? "Impossible de vérifier le paiement.");
        return;
      }

      const paymentStatus = (payload?.data?.payment_status ?? "pending").toLowerCase();
      const orderStatus = (payload?.data?.order_status ?? "").toLowerCase();
      const orderType = String(payload?.data?.order_type ?? "").toLowerCase();
      setDetails({
        transactionId: payload?.data?.transaction_id ?? transactionId ?? undefined,
        orderId: payload?.data?.order_id ?? (orderId ? Number(orderId) : undefined),
      });

      const isPaid = ["paid", "completed", "success", "successful"].includes(paymentStatus);

      if (isPaid) {
        setStatus("success");
        if (orderType === "wallet_topup") {
          setMessage("Paiement confirmé ! Votre wallet va être rechargé.");
          setShowModal(false);
          setTimeout(() => {
            router.replace("/account?topup_status=success");
          }, 800);
          return;
        }
        if (orderType === "premium_subscription") {
          if (!numericOrderId) {
          setShowModal(false);
            setMessage("Référence de commande introuvable.");
        }
        if (orderStatus === "paid_but_out_of_stock") {
          setOutOfStock(true);
          setMessage("Commande payée – en attente de réapprovisionnement.");
          setShowModal(true);
            const orderRes = await authFetch(`${API_BASE}/orders/${numericOrderId}`);
            const orderPayload = (await orderRes.json().catch(() => null)) as OrderShowResponse | null;
            if (!orderRes.ok) {
              setStatus("error");
              setMessage("Impossible de vérifier la commande.");
              return;
            }

            const orderStatus = String(orderPayload?.status ?? "").toLowerCase();
            const orderType = String(orderPayload?.type ?? "").toLowerCase();
            setDetails({ orderId: orderPayload?.id ?? numericOrderId });

            if (orderStatus === "payment_success") {
              setStatus("success");

              if (orderType === "wallet_topup") {
                setMessage("Paiement confirmé. Votre wallet va être mis à jour.");
                setShowModal(false);
                setTimeout(() => {
                  router.replace("/account?topup_status=pending");
                }, 800);
                return;
              }

              if (orderType === "premium_subscription") {
                setMessage("Paiement confirmé. Votre abonnement VIP va être activé.");
                setShowModal(false);
                return;
              }

              const meta = (orderPayload?.meta ?? {}) as Record<string, unknown>;
              const fulfillmentStatus = String(meta?.fulfillment_status ?? "").toLowerCase();
              if (fulfillmentStatus === "out_of_stock" || fulfillmentStatus === "waiting_stock") {
                setOutOfStock(true);
                setMessage("Commande payée – en attente de réapprovisionnement.");
                setShowModal(true);
                return;
              }

              setMessage("Paiement confirmé.");

              const orderItemsRaw = orderPayload?.orderItems ?? orderPayload?.order_items ?? [];
              const orderItems = Array.isArray(orderItemsRaw) ? orderItemsRaw : [];
              const types = orderItems
                .map((row) => String(row?.product?.type ?? "").toLowerCase())
                .filter(Boolean);

              const codesRes = await authFetch(`${API_BASE}/orders/${numericOrderId}/redeem-codes`);
              const codesPayload = await codesRes.json().catch(() => null);
              if (codesRes.ok) {
                const isRedeem = Boolean(codesPayload?.has_redeem_items);
                if (isRedeem) {
                  setPostPurchaseKind("redeem");
                  setRedeemCodes(Array.isArray(codesPayload?.codes) ? codesPayload.codes : []);
                  setGuideUrl(codesPayload?.guide_url ?? null);
                  setShowModal(true);
                  return;
                }

                if (types.includes("account")) {
                  setPostPurchaseKind("account");
                  setShowModal(true);
                  return;
                }

                if (types.includes("subscription")) {
                  setPostPurchaseKind("subscription");
                  setShowModal(true);
                  return;
                }

                setPostPurchaseKind("accessory");
                setShowModal(true);
              }

              return;
            }

            if (orderStatus === "payment_failed") {
              setStatus("failed");
              if (orderType === "wallet_topup") {
                setMessage("Recharge wallet échouée ou non validée. Merci de réessayer.");
              } else {
                setMessage("Paiement échoué ou non validé. Merci de réessayer.");
              }
              return;
            }

            // Still processing
            const elapsed = Date.now() - pollStartedAt;
            if (elapsed <= 30_000) {
              setStatus("loading");
              setMessage("Vérification du paiement...");
              return;
            }

            setStatus("pending");
            setMessage("Paiement en attente de confirmation.");
            return;
      {showModal ? (
        <div className="flex min-h-[75dvh] items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#0b0b16] p-6 text-white shadow-2xl">
            {outOfStock ? (
              <>
                <h3 className="text-xl font-semibold">En attente de réapprovisionnement</h3>
        }, [authFetch, numericOrderId, pollStartedAt, router]);
                  Vos codes seront envoyés dès que le stock est réapprovisionné.
                </p>
              </>
            ) : (
              <>
                {postPurchaseKind === "redeem" ? (
                  <>
                    <h3 className="text-xl font-semibold">Recharge confirmée</h3>
                    {redeemCodes.length ? (
                      <>
                        <p className="mt-2 text-sm text-white/70">Copiez vos codes ci-dessous.</p>
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
                      </p>
                    )}
                  </>
                ) : postPurchaseKind === "account" ? (
                  <>
                    <h3 className="text-xl font-semibold">Nous préparons le compte</h3>
                    <p className="mt-2 text-sm text-white/70">
                      Les identifiants seront envoyés par email. Pensez à vérifier vos spams.
                    </p>
                  </>
                ) : postPurchaseKind === "subscription" ? (
                  <>
                    <h3 className="text-xl font-semibold">Votre demande est en attente</h3>
                    <p className="mt-2 text-sm text-white/70">Activation en préparation. Vous serez notifié dès que c’est terminé.</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-semibold">Achat confirmé</h3>
                    <p className="mt-2 text-sm text-white/70">
                      Merci pour votre achat. Votre commande est en préparation.
                    </p>
                  </>
                )}
              </>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <GlowButton className="flex-1 justify-center" onClick={() => router.push("/account")}>Mon compte</GlowButton>
              <GlowButton variant="secondary" className="flex-1 justify-center" onClick={() => router.push("/shop")}>Retour boutique</GlowButton>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card mt-6 space-y-4 rounded-2xl border border-white/10 p-6">
          <p className={`text-lg font-semibold ${statusStyle}`}>{message}</p>
          <div className="flex flex-wrap gap-3">
            <GlowButton className="flex-1 justify-center" onClick={handleOrdersRedirect}>Mon compte</GlowButton>
            <GlowButton variant="secondary" className="flex-1 justify-center" onClick={() => router.push("/shop")}>Retour boutique</GlowButton>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutStatusPage() {
  return (
    <RequireAuth>
      <CheckoutStatusScreen />
    </RequireAuth>
  );
}
