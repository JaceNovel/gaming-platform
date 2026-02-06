"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";
import { API_BASE } from "@/lib/config";

function CheckoutScreen() {
  const { authFetch, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = Number(searchParams.get("product"));
  const [quantity, setQuantity] = useState(1);
  const [productType, setProductType] = useState<string | null>(null);
  const [productPrice, setProductPrice] = useState<number>(0);
  const [gameId, setGameId] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletBonusBalance, setWalletBonusBalance] = useState<number>(0);
  const [walletBonusExpiresAt, setWalletBonusExpiresAt] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"fedapay" | "wallet">("fedapay");

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

      const discountPrice = typeof data?.discount_price === "number" ? data.discount_price : Number(data?.discount_price ?? NaN);
      const basePrice = typeof data?.price === "number" ? data.price : Number(data?.price ?? NaN);
      const priceFcfa = typeof data?.price_fcfa === "number" ? data.price_fcfa : Number(data?.price_fcfa ?? NaN);
      const resolved = Number.isFinite(discountPrice) && discountPrice > 0 ? discountPrice : Number.isFinite(basePrice) && basePrice > 0 ? basePrice : Number.isFinite(priceFcfa) && priceFcfa > 0 ? priceFcfa : 0;
      setProductPrice(resolved);
    })();
    return () => {
      active = false;
    };
  }, [isValidProduct, productId]);

  useEffect(() => {
    // no-op: FedaPay uses hosted payment page redirection
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setWalletLoading(true);
      try {
        const res = await authFetch(`${API_BASE}/wallet`);
        const data = await res.json().catch(() => null);
        if (!active) return;
        if (res.ok) {
          const balanceValue = typeof data?.balance === "number" ? data.balance : Number(data?.balance ?? 0);
          setWalletBalance(Number.isFinite(balanceValue) ? balanceValue : 0);

          const bonusValue = typeof data?.bonus_balance === "number" ? data.bonus_balance : Number(data?.bonus_balance ?? 0);
          setWalletBonusBalance(Number.isFinite(bonusValue) ? bonusValue : 0);
          setWalletBonusExpiresAt(typeof data?.bonus_expires_at === "string" ? data.bonus_expires_at : null);
        }
      } catch {
        // ignore
      } finally {
        if (active) setWalletLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authFetch]);

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

  const handleCreateOrder = async () => {
    setStatus(null);
    if (!isValidProduct) {
      setStatus("Produit invalide.");
      return;
    }

    if (String(productType ?? "").toLowerCase() === "subscription" && !gameId.trim()) {
      setStatus("Veuillez renseigner votre ID (obligatoire pour l'abonnement).");
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/orders`, {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              product_id: productId,
              quantity,
              ...(String(productType ?? "").toLowerCase() === "subscription" ? { game_id: gameId.trim() } : {}),
            },
          ],
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

      if (paymentMethod === "wallet") {
        const payWalletRes = await authFetch(`${API_BASE}/payments/wallet/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId }),
        });

        const payWalletPayload = await payWalletRes.json().catch(() => null);
        if (!payWalletRes.ok) {
          setStatus(payWalletPayload?.message ?? "Paiement wallet impossible.");
          return;
        }

        setStatus("Paiement wallet réussi.");
        router.replace("/account?wallet_paid=success");
        return;
      }

      const currency = String(order?.currency ?? "XOF").toUpperCase();
      const customer = buildCustomerPayload();

      const callbackUrl = `${window.location.origin}/order-confirmation?order=${orderId}`;

      const payRes = await authFetch(`${API_BASE}/payments/fedapay/init`, {
        method: "POST",
        body: JSON.stringify({
          order_id: orderId,
          payment_method: "fedapay",
          amount: amountToCharge,
          currency,
          customer_email: customer.customer_email,
          customer_name: customer.customer_name,
          customer_phone: customer.customer_phone_number,
          description: `Commande #${orderId} - ${customer.customer_email || ""}`,
          callback_url: callbackUrl,
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
      const paymentUrl = typeof payData?.data?.payment_url === "string" ? payData.data.payment_url : "";

      if (paymentUrl) {
        setStatus("Redirection vers Mobile Money...");
        window.location.href = paymentUrl;
        return;
      }
      setStatus("Paiement indisponible : URL de paiement manquante.");
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

  const estimatedTotal = useMemo(() => {
    const q = Math.max(1, Number(quantity || 1));
    const p = Number(productPrice || 0);
    if (!Number.isFinite(p) || p <= 0) return 0;
    return Math.max(0, q * p);
  }, [productPrice, quantity]);

  const isRechargeProduct = useMemo(() => {
    const t = String(productType ?? "").toLowerCase();
    return t === "recharge" || t === "topup" || t === "pass";
  }, [productType]);

  const walletBonusIsActive = useMemo(() => {
    if (!isRechargeProduct) return false;
    if (!(walletBonusBalance > 0)) return false;
    if (!walletBonusExpiresAt) return false;
    const expires = new Date(walletBonusExpiresAt);
    return Number.isFinite(expires.getTime()) && expires.getTime() > Date.now();
  }, [isRechargeProduct, walletBonusBalance, walletBonusExpiresAt]);

  const walletAvailable = useMemo(() => {
    return walletBalance + (walletBonusIsActive ? walletBonusBalance : 0);
  }, [walletBalance, walletBonusBalance, walletBonusIsActive]);

  const walletPayable = useMemo(() => {
    if (walletLoading) return false;
    if (!Number.isFinite(estimatedTotal) || estimatedTotal <= 0) return false;
    return walletAvailable + 0.0001 >= estimatedTotal;
  }, [estimatedTotal, walletAvailable, walletLoading]);

  useEffect(() => {
    if (paymentMethod === "wallet" && !walletPayable) {
      setPaymentMethod("fedapay");
    }
  }, [paymentMethod, walletPayable]);

  return (
    <div className="min-h-screen pb-24">
      <div className="mobile-shell py-6 space-y-6">
        <SectionTitle eyebrow="Checkout" label="Finaliser l'achat" />

        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-3">
          <p className="text-sm text-white/70">Produit sélectionné: #{isValidProduct ? productId : "-"}</p>

          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-semibold text-white">Mode de paiement</p>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="radio"
                name="payment_method"
                value="fedapay"
                checked={paymentMethod === "fedapay"}
                onChange={() => setPaymentMethod("fedapay")}
              />
              Mobile Money
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="radio"
                name="payment_method"
                value="wallet"
                checked={paymentMethod === "wallet"}
                onChange={() => setPaymentMethod("wallet")}
                disabled={!walletPayable}
              />
              Wallet {walletLoading ? "(chargement...)" : `(dispo: ${Math.floor(walletAvailable)} FCFA)`}
              {!walletPayable && !walletLoading ? (
                <span className="text-xs text-white/50">(solde insuffisant)</span>
              ) : null}
            </label>
          </div>

          <label className="text-sm text-white/70">Quantité</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 1)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
          />

          {String(productType ?? "").toLowerCase() === "subscription" && (
            <div className="space-y-2">
              <label className="text-sm text-white/70">ID (obligatoire)</label>
              <input
                type="text"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                placeholder="Ex: votre Game ID / User ID"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
              />
              <p className="text-xs text-white/50">Cet ID est requis pour activer l'abonnement.</p>
            </div>
          )}

          <GlowButton onClick={handleCreateOrder} disabled={loading} className="w-full justify-center">
            {loading ? "Création..." : "Confirmer la commande"}
          </GlowButton>
          {status && <p className="text-sm text-amber-200">{status}</p>}
        </div>

        <GlowButton variant="secondary" className="w-full justify-center" onClick={() => router.back()}>
          Retour boutique
        </GlowButton>
      </div>
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
