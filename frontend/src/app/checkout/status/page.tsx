"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";

type StatusKey = "loading" | "success" | "failed" | "pending" | "error";

type PaymentStatusResponse = {
  data?: {
    payment_status?: string;
    order_status?: string;
    order_type?: string;
    transaction_id?: string;
    order_id?: number;
  };
  message?: string;
};

type OrderItemProduct = {
  type?: string | null;
};

type OrderItemRow = {
  product?: OrderItemProduct | null;
};

type OrderShowResponse = {
  orderItems?: OrderItemRow[];
  order_items?: OrderItemRow[];
};

type PostPurchaseKind = "redeem" | "account" | "subscription" | "accessory";

function CheckoutStatusScreen() {
  const { authFetch } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<StatusKey>("loading");
  const [message, setMessage] = useState("Vérification du paiement en cours...");
  const [details, setDetails] = useState<{ transactionId?: string; orderId?: number }>({});
  const [checking, setChecking] = useState(false);
  const [redeemCodes, setRedeemCodes] = useState<
    Array<{ code: string; label?: string | null; diamonds?: number | null; quantity_index?: number }>
  >([]);
  const [guideUrl, setGuideUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [outOfStock, setOutOfStock] = useState(false);
  const [postPurchaseKind, setPostPurchaseKind] = useState<PostPurchaseKind>("accessory");

  const transactionId = searchParams.get("transaction_id") ?? searchParams.get("id");
  const orderId = searchParams.get("order_id");
  const provider = String(searchParams.get("provider") ?? "fedapay").toLowerCase();

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
          setMessage("Paiement confirmé ! Votre abonnement VIP est activé.");
          setShowModal(false);
          return;
        }
        if (orderStatus === "paid_but_out_of_stock") {
          setOutOfStock(true);
          setMessage("Commande payée – en attente de réapprovisionnement.");
          setShowModal(true);
          return;
        }

        setMessage("Paiement confirmé !");
        const resolvedOrderId = payload?.data?.order_id ?? (orderId ? Number(orderId) : undefined);
        if (resolvedOrderId) {
          const orderRes = await authFetch(`${API_BASE}/orders/${resolvedOrderId}`);
          const orderPayload = (await orderRes.json().catch(() => null)) as OrderShowResponse | null;
          const orderItemsRaw = orderPayload?.orderItems ?? orderPayload?.order_items ?? [];
          const orderItems = Array.isArray(orderItemsRaw) ? orderItemsRaw : [];
          const types = orderItems
            .map((row) => String(row?.product?.type ?? "").toLowerCase())
            .filter(Boolean);

          const codesRes = await authFetch(`${API_BASE}/orders/${resolvedOrderId}/redeem-codes`);
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
        }
      } else if (paymentStatus === "failed") {
        setStatus("failed");
        if (orderType === "wallet_topup") {
          setMessage("Recharge wallet échouée ou annulée.");
        } else {
          setMessage("Paiement refusé ou expiré. Merci de réessayer.");
        }
      } else {
        setStatus("pending");
        if (orderType === "wallet_topup") {
          setMessage("Recharge wallet en attente de confirmation...");
        } else {
          setMessage("Paiement en attente de confirmation...");
        }
      }
    } catch (error) {
      setStatus("error");
      setMessage("Connexion impossible pour vérifier le paiement.");
    } finally {
      setChecking(false);
    }
  }, [authFetch, orderId, provider, transactionId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const statusStyle =
    status === "success"
      ? "text-emerald-300"
      : status === "failed"
        ? "text-rose-300"
        : status === "pending"
          ? "text-amber-200"
          : "text-white";

  const handleOrdersRedirect = () => router.push("/account");
  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mobile-shell min-h-screen space-y-6 py-6 pb-24">
      <SectionTitle eyebrow="Paiement" label="Statut du paiement" />
      <div className="glass-card space-y-4 rounded-2xl border border-white/10 p-6">
        <p className={`text-lg font-semibold ${statusStyle}`}>{message}</p>
        <p className="text-sm text-white/60">
          Transaction
          <span className="ml-2 font-mono text-white/80">
            {details.transactionId ?? transactionId ?? "N/A"}
          </span>
        </p>
        <p className="text-sm text-white/60">
          Commande
          <span className="ml-2 font-semibold text-white">
            {details.orderId ?? orderId ?? "N/A"}
          </span>
        </p>
        <div className="h-px bg-white/10" />
        <div className="flex flex-wrap gap-3">
          <GlowButton
            className="flex-1 justify-center"
            onClick={fetchStatus}
            disabled={checking}
          >
            {checking ? "Vérification..." : "Actualiser"}
          </GlowButton>
          {status === "success" && (
            <GlowButton
              variant="secondary"
              className="flex-1 justify-center"
              onClick={handleOrdersRedirect}
            >
              Voir mes commandes
            </GlowButton>
          )}
          {(status === "failed" || status === "error") && (
            <GlowButton
              variant="secondary"
              className="flex-1 justify-center"
              onClick={() => router.push("/checkout")}
            >
              Revenir au checkout
            </GlowButton>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#0b0b16] p-6 text-white shadow-2xl">
            {outOfStock ? (
              <>
                <h3 className="text-xl font-semibold">En attente de réapprovisionnement</h3>
                <p className="mt-2 text-sm text-white/70">
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
                    <h3 className="text-xl font-semibold">Compte en préparation</h3>
                    <p className="mt-2 text-sm text-white/70">
                      Les identifiants seront envoyés par email dans un délai de 24h. Pensez à vérifier vos spams.
                    </p>
                  </>
                ) : postPurchaseKind === "subscription" ? (
                  <>
                    <h3 className="text-xl font-semibold">Abonnement confirmé</h3>
                    <p className="mt-2 text-sm text-white/70">Veuillez vérifier votre compte dans 2h.</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-semibold">Achat confirmé</h3>
                    <p className="mt-2 text-sm text-white/70">
                      Merci pour votre achat. Votre commande est en cours de traitement.
                    </p>
                  </>
                )}
              </>
            )}
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full rounded-full bg-white/10 px-4 py-2 text-sm"
            >
              Fermer
            </button>
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
