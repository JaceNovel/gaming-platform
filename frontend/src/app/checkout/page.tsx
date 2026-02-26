"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";
import { API_BASE } from "@/lib/config";
import { emitWalletUpdated } from "@/lib/walletEvents";
import { buildMapsUrlFromCoords, isValidShippingInfo, readShippingInfo, writeShippingInfo } from "@/lib/shippingInfo";

function CheckoutScreen() {
  const { authFetch, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = Number(searchParams.get("product"));
  const [quantity, setQuantity] = useState(1);
  const [productType, setProductType] = useState<string | null>(null);
  const [productName, setProductName] = useState<string>("");
  const [productPrice, setProductPrice] = useState<number>(0);
  const [shippingRequired, setShippingRequired] = useState(false);
  const [gameId, setGameId] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletBonusBalance, setWalletBonusBalance] = useState<number>(0);
  const [walletBonusExpiresAt, setWalletBonusExpiresAt] = useState<string | null>(null);
  const [rewardWalletBalance, setRewardWalletBalance] = useState<number>(0);
  const [rewardMinPurchaseAmount, setRewardMinPurchaseAmount] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"fedapay" | "wallet" | "wallet_reward">("fedapay");

  const [shippingMapsUrl, setShippingMapsUrl] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingStatus, setShippingStatus] = useState<string | null>(null);

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
      setProductName(String(data?.name ?? data?.title ?? "").trim());
      setShippingRequired(Boolean(data?.shipping_required ?? false));

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

  const requiresGameId = useMemo(() => {
    const t = String(productType ?? "").toLowerCase();
    if (t === "subscription") return true;
    const normalizedName = String(productName ?? "").trim().toLowerCase();
    return normalizedName === "booyah pass";
  }, [productName, productType]);

  useEffect(() => {
    const existing = readShippingInfo();
    if (!existing) return;
    setShippingMapsUrl(existing.mapsUrl ?? "");
    setShippingCity(existing.city ?? "");
    setShippingPhone(existing.phone ?? "");
  }, []);

  const persistShipping = () => {
    writeShippingInfo({ mapsUrl: shippingMapsUrl.trim(), city: shippingCity.trim(), phone: shippingPhone.trim() });
  };

  const fillCurrentPosition = async () => {
    setShippingStatus(null);
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setShippingStatus("La géolocalisation n'est pas supportée sur cet appareil.");
      return;
    }
    setShippingStatus("Récupération de la position...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const url = buildMapsUrlFromCoords(pos.coords.latitude, pos.coords.longitude);
        if (!url) {
          setShippingStatus("Position invalide.");
          return;
        }
        setShippingMapsUrl(url);
        setShippingStatus("Position ajoutée.");
      },
      () => setShippingStatus("Impossible de récupérer la position. Autorise la localisation puis réessaie."),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

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

          const rewardValue = typeof data?.reward_balance === "number" ? data.reward_balance : Number(data?.reward_balance ?? 0);
          setRewardWalletBalance(Number.isFinite(rewardValue) ? rewardValue : 0);

          const minRewardValue =
            typeof data?.reward_min_purchase_amount === "number"
              ? data.reward_min_purchase_amount
              : Number(data?.reward_min_purchase_amount ?? 0);
          setRewardMinPurchaseAmount(Number.isFinite(minRewardValue) ? minRewardValue : 0);
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

    if (shippingRequired) {
      const info = { mapsUrl: shippingMapsUrl.trim(), city: shippingCity.trim(), phone: shippingPhone.trim() };
      const resolved = isValidShippingInfo(info) ? info : readShippingInfo();
      if (!isValidShippingInfo(resolved)) {
        setStatus("Veuillez renseigner l'adresse (lien Google Maps), la ville et le téléphone.");
        return;
      }
      if (!isValidShippingInfo(info)) {
        setShippingMapsUrl(resolved!.mapsUrl);
        setShippingCity(resolved!.city);
        setShippingPhone(resolved!.phone);
      }
      persistShipping();
    }

    emitWalletUpdated({ source: "checkout_wallet_pay" });
    if (requiresGameId && !gameId.trim()) {
      setStatus("Veuillez renseigner votre ID (obligatoire pour ce produit).");
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
              ...(requiresGameId ? { game_id: gameId.trim() } : {}),
            },
          ],
          ...(shippingRequired
            ? {
                shipping_address_line1: shippingMapsUrl.trim(),
                shipping_city: shippingCity.trim(),
                shipping_phone: shippingPhone.trim(),
              }
            : {}),
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
        router.replace(`/account?payment_status=success&order=${encodeURIComponent(String(orderId))}`);
        return;
      }

      if (paymentMethod === "wallet_reward") {
        const payRewardRes = await authFetch(`${API_BASE}/payments/wallet-reward/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId }),
        });

        const payRewardPayload = await payRewardRes.json().catch(() => null);
        if (!payRewardRes.ok) {
          setStatus(payRewardPayload?.message ?? "Paiement wallet récompense impossible.");
          return;
        }

        setStatus("Paiement wallet récompense réussi.");
        router.replace(`/account?payment_status=success&order=${encodeURIComponent(String(orderId))}`);
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

  const rewardWalletPayable = useMemo(() => {
    if (walletLoading) return false;
    if (!(rewardWalletBalance > 0)) return false;
    if (!Number.isFinite(estimatedTotal) || estimatedTotal <= 0) return false;
    if (rewardWalletBalance + 0.0001 < estimatedTotal) return false;
    if (rewardMinPurchaseAmount > 0 && estimatedTotal + 0.0001 < rewardMinPurchaseAmount) return false;
    return true;
  }, [estimatedTotal, rewardMinPurchaseAmount, rewardWalletBalance, walletLoading]);

  useEffect(() => {
    if (paymentMethod === "wallet" && !walletPayable) {
      setPaymentMethod("fedapay");
      return;
    }

    if (paymentMethod === "wallet_reward" && !rewardWalletPayable) {
      setPaymentMethod("fedapay");
    }
  }, [paymentMethod, rewardWalletPayable, walletPayable]);

  return (
    <div className="min-h-screen pb-24">
      <div className="mobile-shell py-6 space-y-6">
        <SectionTitle eyebrow="Checkout" label="Finaliser l'achat" />

        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-3">
          <p className="text-sm text-white/70">Produit sélectionné: #{isValidProduct ? productId : "-"}</p>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-semibold text-white">Récapitulatif</p>
            <div className="mt-3 grid gap-1 text-sm">
              <div className="flex items-center justify-between text-white/70">
                <span>Montant</span>
                <span className="font-semibold text-white">{Math.floor(estimatedTotal)} FCFA</span>
              </div>
            </div>
          </div>

          {shippingRequired ? (
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-semibold text-white">Adresse de livraison</p>
              <p className="text-xs text-white/60">Lien Google Maps + ville + téléphone (obligatoire).</p>

              <div className="space-y-2">
                <label className="text-sm text-white/70">Lien Google Maps *</label>
                <input
                  type="text"
                  value={shippingMapsUrl}
                  onChange={(e) => {
                    setShippingMapsUrl(e.target.value);
                    setShippingStatus(null);
                  }}
                  placeholder="https://maps.google.com/..."
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                />
                <button
                  type="button"
                  onClick={fillCurrentPosition}
                  className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/15"
                >
                  Ma position actuelle
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">Ville *</label>
                <input
                  type="text"
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  placeholder="Ex: Douala"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/70">Téléphone (WhatsApp) *</label>
                <input
                  type="text"
                  value={shippingPhone}
                  onChange={(e) => setShippingPhone(e.target.value)}
                  placeholder="Ex: 690000000"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                />
              </div>

              {shippingStatus ? <p className="text-xs text-white/60">{shippingStatus}</p> : null}
              {!isValidShippingInfo({ mapsUrl: shippingMapsUrl.trim(), city: shippingCity.trim(), phone: shippingPhone.trim() }) ? (
                <p className="text-xs text-amber-200">Merci de renseigner tous les champs.</p>
              ) : null}
            </div>
          ) : null}

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

            {rewardWalletBalance > 0 ? (
              <label className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="radio"
                  name="payment_method"
                  value="wallet_reward"
                  checked={paymentMethod === "wallet_reward"}
                  onChange={() => setPaymentMethod("wallet_reward")}
                  disabled={!rewardWalletPayable}
                />
                Wallet récompense {walletLoading ? "(chargement...)" : `(dispo: ${Math.floor(rewardWalletBalance)} FCFA)`}
                {!rewardWalletPayable && !walletLoading ? (
                  <span className="text-xs text-white/50">
                    {rewardMinPurchaseAmount > 0
                      ? `(achat >= ${Math.floor(rewardMinPurchaseAmount)} FCFA)`
                      : "(solde insuffisant)"}
                  </span>
                ) : null}
              </label>
            ) : null}
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

          {!String(productType ?? "").toLowerCase().includes("subscription") && String(productName ?? "").trim().toLowerCase() === "booyah pass" ? (
            <div className="space-y-2">
              <label className="text-sm text-white/70">ID Free Fire (obligatoire)</label>
              <input
                type="text"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                placeholder="Ex: votre ID Free Fire"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
              />
              <p className="text-xs text-white/50">Cet ID est requis pour traiter le BOOYAH PASS.</p>
            </div>
          ) : null}

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
