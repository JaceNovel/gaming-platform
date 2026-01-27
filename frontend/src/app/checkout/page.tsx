"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";
import { API_BASE } from "@/lib/config";

declare global {
  interface Window {
    CinetPay?: any;
  }
}

function CheckoutScreen() {
  const { authFetch, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = Number(searchParams.get("product"));
  const [quantity, setQuantity] = useState(1);
  const [productType, setProductType] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const cinetpayHandlersBoundRef = useRef(false);

  const hasSeamlessConfig = Boolean(
    process.env.NEXT_PUBLIC_CINETPAY_API_KEY && process.env.NEXT_PUBLIC_CINETPAY_SITE_ID,
  );

  const isValidProduct = useMemo(() => Number.isFinite(productId) && productId > 0, [productId]);

  useEffect(() => {
    if (!isValidProduct) return;
    let active = true;
    (async () => {
      const res = await fetch(`${API_BASE}/products/${productId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!active) return;
      setProductType(data?.type ?? null);
    })();
    return () => {
      active = false;
    };
  }, [isValidProduct, productId]);

  useEffect(() => {
    const src = "https://cdn.cinetpay.com/seamless/main.js";
    if (document.querySelector(`script[src="${src}"]`)) return;

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const buildCustomerPayload = () => {
    const rawUser: any = user ?? {};
    const fullName = String(rawUser?.name ?? rawUser?.full_name ?? "").trim();
    const parts = fullName ? fullName.split(/\s+/) : [];
    const firstName = String(rawUser?.first_name ?? parts[0] ?? "Client").trim() || "Client";
    const lastName = String(rawUser?.last_name ?? parts.slice(1).join(" ") ?? "").trim();

    const email = String(rawUser?.email ?? "").trim();
    const phone = String(rawUser?.phone ?? rawUser?.phone_number ?? "").trim() || "000000000";

    const country = String(rawUser?.country ?? rawUser?.country_code ?? rawUser?.countryCode ?? "CM").trim() || "CM";
    const city = String(rawUser?.city ?? "").trim();
    const address = String(rawUser?.address ?? "").trim() || "Non spécifié";

    return {
      customer_name: firstName,
      customer_surname: lastName,
      customer_email: email,
      customer_phone_number: phone,
      customer_address: address,
      customer_city: city,
      customer_country: country,
      customer_state: country,
      customer_zip_code: String(rawUser?.zip_code ?? rawUser?.zipcode ?? "").trim(),
    };
  };

  const initCinetPayPayment = (order: any, transactionId: string) => {
    const cinetpay = typeof window !== "undefined" ? window.CinetPay : null;
    if (!cinetpay) {
      setStatus("Système de paiement non chargé. Veuillez réessayer.");
      setShowPaymentModal(false);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_CINETPAY_API_KEY || "";
    const siteId = process.env.NEXT_PUBLIC_CINETPAY_SITE_ID || "";

    if (!apiKey || !siteId) {
      setStatus("Paiement indisponible : configuration manquante.");
      setShowPaymentModal(false);
      return;
    }

    const amount = Number(order?.total_price);
    const currency = String(order?.currency || "XOF").toUpperCase();
    const orderId = order?.id;
    const customer = buildCustomerPayload();

    cinetpay.setConfig({
      apikey: apiKey,
      site_id: siteId,
      notify_url: `${window.location.origin}/api/cinetpay/notify`,
      mode: "PRODUCTION",
    });

    cinetpay.getCheckout({
      transaction_id: transactionId,
      amount,
      currency,
      channels: "ALL",
      description: `Commande #${orderId} - ${customer.customer_email || ""}`,
      ...customer,
    });

    if (!cinetpayHandlersBoundRef.current) {
      cinetpayHandlersBoundRef.current = true;

      cinetpay.waitResponse((data: any) => {
        setLoading(false);
        setShowPaymentModal(false);

        const rawStatus = String(data?.status ?? "").toUpperCase();

        if (rawStatus === "ACCEPTED") {
          router.push(`/order-confirmation?order=${orderId}&status=success&transaction_id=${encodeURIComponent(transactionId)}`);
          return;
        }

        if (rawStatus === "PENDING") {
          router.push(`/order-confirmation?order=${orderId}&status=pending&transaction_id=${encodeURIComponent(transactionId)}`);
          return;
        }

        if (rawStatus === "CANCELED" || rawStatus === "CANCELLED") {
          router.push(`/order-confirmation?order=${orderId}&status=cancelled&transaction_id=${encodeURIComponent(transactionId)}`);
          return;
        }

        if (rawStatus === "REFUSED" || rawStatus === "FAILED") {
          router.push(`/order-confirmation?order=${orderId}&status=failed&transaction_id=${encodeURIComponent(transactionId)}`);
          return;
        }

        setStatus(`Statut de paiement: ${data?.status || "inconnu"}`);
      });

      cinetpay.onError((error: any) => {
        console.error("CinetPay Error:", error);
        setStatus("❌ Erreur lors du traitement du paiement. Veuillez réessayer.");
        setLoading(false);
        setShowPaymentModal(false);
      });
    }
  };

  const handleCreateOrder = async () => {
    setStatus(null);
    if (!isValidProduct) {
      setStatus("Produit invalide.");
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/orders`, {
        method: "POST",
        body: JSON.stringify({
          items: [{ product_id: productId, quantity }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus(err.message ?? "Impossible de créer la commande.");
        return;
      }

      const data = await res.json();
      const order = data?.order;
      const orderId = order?.id;
      if (!orderId) {
        setStatus("Commande invalide.");
        return;
      }

      const amountToCharge = Number(Number(order?.total_price ?? 0).toFixed(2));
      if (!Number.isFinite(amountToCharge) || amountToCharge <= 0) {
        setStatus("Montant de commande invalide.");
        return;
      }
      const currency = String(order?.currency ?? "XOF").toUpperCase();

      const transactionId = `${orderId}_${Date.now()}`;
      const customer = buildCustomerPayload();

      // Init côté backend: crée le Payment + transaction_id (utilisé par le webhook)
      // On garde aussi ces URLs pour cohérence production.
      const returnUrl = `${window.location.origin}/order-confirmation?order=${orderId}&status=success&transaction_id=${encodeURIComponent(transactionId)}`;
      const cancelUrl = `${window.location.origin}/order-confirmation?order=${orderId}&status=cancelled&transaction_id=${encodeURIComponent(transactionId)}`;
      const notifyUrl = `${window.location.origin}/api/cinetpay/notify`;

      const payRes = await authFetch(`${API_BASE}/payments/cinetpay/init`, {
        method: "POST",
        body: JSON.stringify({
          order_id: orderId,
          payment_method: "cinetpay",
          amount: amountToCharge,
          currency,
          customer_email: customer.customer_email,
          transaction_id: transactionId,
          notify_url: notifyUrl,
          return_url: returnUrl,
          cancel_url: cancelUrl,
          channels: "ALL",
          customer_name: customer.customer_name,
          customer_phone: customer.customer_phone_number,
          description: `Commande #${orderId} - ${customer.customer_email || ""}`,
          metadata: {
            source: "checkout",
            product_id: productId,
            quantity,
          },
        }),
      });

      if (!payRes.ok) {
        const err = await payRes.json().catch(() => ({}));
        setStatus(err.message ?? "Impossible de démarrer le paiement.");
        return;
      }

      const payData = await payRes.json().catch(() => null);
      const resolvedTransactionId = String(payData?.data?.transaction_id ?? transactionId);
      const paymentUrl = typeof payData?.data?.payment_url === "string" ? payData.data.payment_url : "";

      // Si la config seamless n'est pas dispo côté front, on bascule sur l'URL de paiement hébergée.
      if (!hasSeamlessConfig) {
        if (paymentUrl) {
          setStatus("Redirection vers CinetPay...");
          window.location.href = paymentUrl;
          return;
        }
        setStatus("Paiement indisponible : URL de paiement manquante.");
        return;
      }

      setOrderData(order);
      setShowPaymentModal(true);

      // Laisse le temps au script de se charger (au besoin)
      setTimeout(() => initCinetPayPayment(order, resolvedTransactionId), 300);
    } catch (error) {
      if (error instanceof Error && error.message) {
        setStatus(error.message);
      } else {
        setStatus("Connexion au serveur impossible.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPayment = () => {
    setShowPaymentModal(false);
    setStatus("Paiement annulé.");
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="mobile-shell py-6 space-y-6">
        <SectionTitle eyebrow="Checkout" label="Finaliser l'achat" />

        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-3">
          <p className="text-sm text-white/70">Produit sélectionné: #{isValidProduct ? productId : "-"}</p>
          <label className="text-sm text-white/70">Quantité</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 1)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
          />
          <GlowButton onClick={handleCreateOrder} disabled={loading} className="w-full justify-center">
            {loading ? "Création..." : "Confirmer la commande"}
          </GlowButton>
          {status && <p className="text-sm text-amber-200">{status}</p>}
        </div>

        <GlowButton variant="secondary" className="w-full justify-center" onClick={() => router.back()}>
          Retour boutique
        </GlowButton>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-gray-900">
            <div className="border-b border-white/10 bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Paiement sécurisé</h3>
                <button
                  onClick={handleCancelPayment}
                  className="text-lg text-white/70 hover:text-white"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-white/70">Commande #{orderData?.id}</span>
                <span className="font-semibold text-white">
                  {orderData?.total_price} {orderData?.currency || "XOF"}
                </span>
              </div>
            </div>

            <div className="p-6">
              <div id="cinetpay-widget" className="min-h-[400px]">
                <div className="py-10 text-center">
                  <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500" />
                  <p className="text-white/80">Initialisation du paiement sécurisé...</p>
                  <p className="mt-4 text-sm text-white/50">Powered by CinetPay</p>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-gray-800/50 p-4 text-center">
              <p className="text-xs text-white/50">Vos informations sont cryptées et sécurisées.</p>
            </div>
          </div>

          <style jsx global>{`
            .cp-widget-container {
              background: transparent !important;
              font-family: inherit !important;
            }
            .cp-card-body {
              background: rgba(30, 41, 59, 0.5) !important;
              border-radius: 12px !important;
              border: 1px solid rgba(255, 255, 255, 0.1) !important;
              padding: 20px !important;
            }
            .cp-btn {
              border-radius: 8px !important;
              font-weight: 500 !important;
              font-family: inherit !important;
              transition: all 0.3s ease !important;
            }
            .cp-btn-primary {
              background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
              border: none !important;
              color: white !important;
            }
            .cp-btn-primary:hover {
              opacity: 0.9 !important;
              transform: translateY(-2px) !important;
            }
            .cp-form-control {
              background: rgba(255, 255, 255, 0.05) !important;
              border: 1px solid rgba(255, 255, 255, 0.1) !important;
              border-radius: 8px !important;
              color: white !important;
            }
            .cp-form-control:focus {
              border-color: #3b82f6 !important;
              box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
            }
            .cp-text-muted {
              color: rgba(255, 255, 255, 0.6) !important;
            }
            .cp-alert-success {
              background: rgba(34, 197, 94, 0.1) !important;
              border: 1px solid rgba(34, 197, 94, 0.2) !important;
              color: #4ade80 !important;
            }
            .cp-alert-danger {
              background: rgba(239, 68, 68, 0.1) !important;
              border: 1px solid rgba(239, 68, 68, 0.2) !important;
              color: #f87171 !important;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <RequireAuth>
      <CheckoutScreen />
    </RequireAuth>
  );
}
