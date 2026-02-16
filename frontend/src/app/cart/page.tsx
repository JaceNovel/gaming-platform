"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, ShoppingBag, Trash2 } from "lucide-react";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import DeliveryBadge from "@/components/ui/DeliveryBadge";
import { API_BASE } from "@/lib/config";
import type { DeliveryBadgeDisplay } from "@/lib/deliveryDisplay";
import { getDeliveryBadgeDisplay } from "@/lib/deliveryDisplay";
import { emitCartUpdated } from "@/lib/cartEvents";
import { emitWalletUpdated } from "@/lib/walletEvents";
import { buildMapsUrlFromCoords, isValidShippingInfo, readShippingInfo, writeShippingInfo } from "@/lib/shippingInfo";

type CartItem = {
  id: number;
  name: string;
  description?: string;
  price: number;
  priceLabel?: string;
  quantity: number;
  type?: string;
  gameId?: string;
  displaySection?: string | null;
  deliveryEstimateLabel?: string | null;
  deliveryLabel?: string;
  shippingFee?: number;
};

const legacyDeliveryLabelToBadge = (raw?: string | null): DeliveryBadgeDisplay | null => {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "int" || v.includes("instant")) {
    return { tone: "bolt", desktopLabel: "⚡ Livraison instantanée", mobileLabel: "⚡ Instantané" };
  }
  if (v === "2h") {
    return { tone: "clock", desktopLabel: "⏱️ Livraison estimée : ~2h", mobileLabel: "⏱️ ~2h" };
  }
  if (v === "1h") {
    // Legacy: skins were displayed as 1H previously.
    return { tone: "clock", desktopLabel: "⏱️ Livraison estimée : ~2h", mobileLabel: "⏱️ ~2h" };
  }
  if (v === "24h") {
    return { tone: "clock", desktopLabel: "⏱️ Livraison estimée : ~24h", mobileLabel: "⏱️ ~24h" };
  }
  return null;
};

function CartScreen() {
  const { authFetch, user } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletBonusBalance, setWalletBonusBalance] = useState<number>(0);
  const [walletBonusExpiresAt, setWalletBonusExpiresAt] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"fedapay" | "wallet">("fedapay");

  const [shippingMapsUrl, setShippingMapsUrl] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingStatus, setShippingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("bbshop_cart");
    if (stored) {
      try {
        setCartItems(JSON.parse(stored));
      } catch {
        setCartItems([]);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const missing = cartItems.filter((it) => it && typeof it.shippingFee !== "number").map((it) => it.id);
    const unique = Array.from(new Set(missing)).slice(0, 30);
    if (!unique.length) return;

    (async () => {
      try {
        const results = await Promise.all(
          unique.map(async (id) => {
            try {
              const res = await fetch(`${API_BASE}/products/${encodeURIComponent(String(id))}`, {
                headers: { Accept: "application/json" },
              });
              const payload = await res.json().catch(() => null);
              if (!res.ok) return { id, shippingFee: 0 };
              const fee = Number(payload?.shipping_fee ?? 0);
              return { id, shippingFee: Number.isFinite(fee) && fee > 0 ? fee : 0 };
            } catch {
              return { id, shippingFee: 0 };
            }
          }),
        );

        if (!active) return;
        setCartItems((prev) => {
          const map = new Map(results.map((r) => [r.id, r.shippingFee]));
          const next = prev.map((it) => {
            if (!it) return it;
            if (typeof it.shippingFee === "number") return it;
            const fee = map.get(it.id);
            return fee === undefined ? it : { ...it, shippingFee: fee };
          });
          if (typeof window !== "undefined") {
            localStorage.setItem("bbshop_cart", JSON.stringify(next));
            emitCartUpdated({ action: "update" });
          }
          return next;
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      active = false;
    };
  }, [API_BASE, cartItems]);

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

  const removeItem = (id: number) => {
    setCartItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (typeof window !== "undefined") {
        localStorage.setItem("bbshop_cart", JSON.stringify(next));
        emitCartUpdated({ action: "remove" });
      }
      return next;
    });
  };

  const updateQuantity = (id: number, nextQuantity: number) => {
    const q = Math.max(1, Number(nextQuantity || 1));
    setCartItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, quantity: q } : item));
      if (typeof window !== "undefined") {
        localStorage.setItem("bbshop_cart", JSON.stringify(next));
        emitCartUpdated({ action: "update" });
      }
      return next;
    });
  };

  const updateGameId = (id: number, nextGameId: string) => {
    setCartItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, gameId: nextGameId } : item));
      if (typeof window !== "undefined") {
        localStorage.setItem("bbshop_cart", JSON.stringify(next));
        emitCartUpdated({ action: "update" });
      }
      return next;
    });
  };

  const cartIsRechargeOnly = useMemo(() => {
    if (!cartItems.length) return false;
    return cartItems.every((item) => {
      const t = String(item.type ?? "").toLowerCase();
      return t === "recharge" || t === "topup" || t === "pass";
    });
  }, [cartItems]);

  const walletBonusIsActive = useMemo(() => {
    if (!cartIsRechargeOnly) return false;
    if (!(walletBonusBalance > 0)) return false;
    if (!walletBonusExpiresAt) return false;
    const expires = new Date(walletBonusExpiresAt);
    return Number.isFinite(expires.getTime()) && expires.getTime() > Date.now();
  }, [cartIsRechargeOnly, walletBonusBalance, walletBonusExpiresAt]);

  const walletAvailable = useMemo(() => {
    return walletBalance + (walletBonusIsActive ? walletBonusBalance : 0);
  }, [walletBalance, walletBonusBalance, walletBonusIsActive]);

  const clearCart = () => {
    setStatus(null);
    if (!cartItems.length) return;

    const ok = window.confirm("Vider le panier ?");
    if (!ok) return;

    setCartItems([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("bbshop_cart");
      emitCartUpdated({ action: "clear" });
    }
  };

  const productsSubtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (Number(item.price ?? 0) || 0) * (Number(item.quantity ?? 0) || 0), 0),
    [cartItems],
  );

  const shippingTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (Number(item.shippingFee ?? 0) || 0) * (Number(item.quantity ?? 0) || 0), 0),
    [cartItems],
  );
  const fees = Math.round((productsSubtotal + shippingTotal) * 0.02);
  const total = productsSubtotal + shippingTotal + fees;

  const hasPhysicalItems = useMemo(() => {
    return cartItems.some((it: any) => {
      const fee = Number(it?.shippingFee ?? it?.shipping_fee ?? 0);
      if (Number.isFinite(fee) && fee > 0) return true;
      return Boolean(it?.accessoryCategory);
    });
  }, [cartItems]);

  useEffect(() => {
    if (paymentMethod === "wallet" && (walletLoading || walletAvailable + 0.0001 < total)) {
      setPaymentMethod("fedapay");
    }
  }, [paymentMethod, walletAvailable, walletLoading, total]);

  const handlePay = async () => {
    setStatus(null);
    setLoading(true);
    try {
      if (!cartItems.length) {
        setStatus("Ton panier est vide.");
        return;
      }

      if (hasPhysicalItems) {
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

      const requiresGameIdForItem = (item: any) => {
        const t = String(item?.type ?? "").trim().toLowerCase();
        if (t === "subscription") return true;
        const n = String(item?.name ?? "").trim().toLowerCase();
        return n === "booyah pass";
      };

      const missingGameId = cartItems.find((item) => requiresGameIdForItem(item) && !String(item.gameId ?? "").trim());
      if (missingGameId) {
        setStatus(`Veuillez renseigner l'ID pour: ${missingGameId.name}`);
        return;
      }

      const orderRes = await authFetch(`${API_BASE}/orders`, {
        method: "POST",
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            ...(requiresGameIdForItem(item) ? { game_id: String(item.gameId ?? "").trim() } : {}),
          })),
          ...(hasPhysicalItems
            ? {
                shipping_address_line1: shippingMapsUrl.trim(),
                shipping_city: shippingCity.trim(),
                shipping_phone: shippingPhone.trim(),
              }
            : {}),
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        setStatus(err.message ?? "Impossible de créer la commande.");
        return;
      }

      const orderData = await orderRes.json();
      const order = orderData?.order;
      const orderId = order?.id;

      if (!orderId) {
        setStatus("Commande invalide.");
        return;
      }

      const amountToCharge = Number(Number(order?.total_price ?? total).toFixed(2));
      if (!Number.isFinite(amountToCharge) || amountToCharge <= 0) {
        setStatus("Montant de commande invalide.");
        return;
      }
      const currency = String(order?.currency ?? "XOF").toUpperCase();

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
        emitWalletUpdated({ source: "cart_wallet_pay" });
        setCartItems([]);
        if (typeof window !== "undefined") {
          localStorage.removeItem("bbshop_cart");
        }
        window.location.href = `/account?payment_status=success&order=${encodeURIComponent(String(orderId))}`;
        return;
      }

      const payRes = await authFetch(`${API_BASE}/payments/fedapay/init`, {
        method: "POST",
        body: JSON.stringify({
          order_id: orderId,
            payment_method: "fedapay",
          amount: amountToCharge,
          currency,
          customer_email: user?.email,
          metadata: {
            source: "cart",
            item_count: cartItems.length,
            cart_items: cartItems.map((item) => ({ id: item.id, quantity: item.quantity })),
          },
        }),
      });

      if (!payRes.ok) {
        const err = await payRes.json().catch(() => ({}));
        setStatus(err.message ?? "Impossible de démarrer le paiement.");
        return;
      }

      const data = await payRes.json();
      const paymentUrl = data?.data?.payment_url;

      if (!paymentUrl) {
        setStatus("Lien de paiement indisponible.");
        return;
      }

      window.location.href = paymentUrl;
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

  return (
    <div className="min-h-[100dvh] pb-24">
      <div className="w-full py-10">
        <div className="w-full px-5 sm:px-8 lg:px-16 xl:px-24 2xl:px-32 space-y-8">
          <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-200/80">Panier</p>
              <h1 className="text-3xl lg:text-4xl font-black">Récapitulatif de commande</h1>
              <p className="text-sm text-white/60">Vérifie tes articles avant paiement.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <GlowButton
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => (window.location.href = "/")}
              >
                <ShoppingBag className="h-4 w-4" />
                Continuer les achats
              </GlowButton>
              <GlowButton
                variant="secondary"
                className="w-full sm:w-auto border-rose-200/25 text-rose-100 hover:border-rose-200/40"
                onClick={clearCart}
                disabled={loading || !cartItems.length}
                aria-label="Vider le panier"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sm:hidden">Vider</span>
                <span className="hidden sm:inline">Vider le panier</span>
              </GlowButton>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
              <SectionTitle eyebrow="Articles" label="Dans ton panier" />
              <div className="space-y-4">
                {cartItems.length ? cartItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-white">{item.name}</p>

                        {(() => {
                          const badge =
                            getDeliveryBadgeDisplay({
                              type: item.type ?? null,
                              displaySection: item.displaySection ?? null,
                              deliveryEstimateLabel: item.deliveryEstimateLabel ?? null,
                            }) ?? legacyDeliveryLabelToBadge(item.deliveryLabel);
                          return badge ? (
                            <div className="mt-2 flex justify-start">
                              <DeliveryBadge delivery={badge} />
                            </div>
                          ) : null;
                        })()}

                        {(String(item.type ?? "").toLowerCase() === "subscription" || String(item.name ?? "").trim().toLowerCase() === "booyah pass") && (
                          <div className="mt-3 space-y-2">
                            <label className="text-xs text-white/60">ID (obligatoire)</label>
                            <input
                              type="text"
                              value={item.gameId ?? ""}
                              onChange={(e) => updateGameId(item.id, e.target.value)}
                              placeholder="Ex: votre Game ID / User ID"
                              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                            />
                          </div>
                        )}
                        <p className="text-sm text-white/60">{item.description}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-xs text-white/50">Quantité</span>
                          <div className="inline-flex items-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                            <button
                              type="button"
                              className="px-2 sm:px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              aria-label="Diminuer la quantité"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                              className="w-12 sm:w-16 bg-transparent px-2 py-2 text-center text-sm text-white outline-none"
                            />
                            <button
                              type="button"
                              className="px-2 sm:px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              aria-label="Augmenter la quantité"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-3 sm:justify-end sm:shrink-0">
                        <div className="min-w-0 text-left sm:text-right">
                          <p className="text-sm sm:text-base font-bold text-cyan-200 break-words">
                            {((item.price + (item.shippingFee ?? 0)) * item.quantity).toLocaleString()} FCFA
                          </p>
                          {Number(item.shippingFee ?? 0) > 0 ? (
                            <p className="mt-0.5 text-xs text-white/55 break-words">
                              Prix: {(item.price * item.quantity).toLocaleString()} • Livraison: {((item.shippingFee ?? 0) * item.quantity).toLocaleString()} FCFA
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 text-white/70 transition hover:bg-white/10 hover:text-white"
                          aria-label="Supprimer l'article"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                    Ton panier est vide.
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <SectionTitle eyebrow="Paiement" label="Total" />
              <div className="space-y-3 text-sm text-white/70">
                <div className="flex items-center justify-between">
                  <span>Sous-total</span>
                  <span>{productsSubtotal.toLocaleString()} FCFA</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Livraison</span>
                  <span>{shippingTotal.toLocaleString()} FCFA</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Frais de paiement</span>
                  <span>{fees.toLocaleString()} FCFA</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex items-center justify-between text-base font-bold text-white">
                  <span>Total</span>
                  <span>{total.toLocaleString()} FCFA</span>
                </div>
              </div>

              {hasPhysicalItems ? (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Adresse de livraison</p>
                  <p className="text-xs text-white/60">Lien Google Maps + ville + téléphone (obligatoire).</p>

                  <div className="space-y-2">
                    <label className="text-xs text-white/60">Lien Google Maps *</label>
                    <input
                      type="text"
                      value={shippingMapsUrl}
                      onChange={(e) => {
                        setShippingMapsUrl(e.target.value);
                        setShippingStatus(null);
                      }}
                      placeholder="https://maps.google.com/..."
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
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
                    <label className="text-xs text-white/60">Ville *</label>
                    <input
                      type="text"
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                      placeholder="Ex: Douala"
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-white/60">Téléphone (WhatsApp) *</label>
                    <input
                      type="text"
                      value={shippingPhone}
                      onChange={(e) => setShippingPhone(e.target.value)}
                      placeholder="Ex: 690000000"
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                    />
                  </div>

                  {shippingStatus ? <p className="text-xs text-white/60">{shippingStatus}</p> : null}
                  {!isValidShippingInfo({ mapsUrl: shippingMapsUrl.trim(), city: shippingCity.trim(), phone: shippingPhone.trim() }) ? (
                    <p className="text-xs text-amber-200">Merci de renseigner tous les champs.</p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Mode de paiement</p>
                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="radio"
                    name="payment_method"
                    value="fedapay"
                    checked={paymentMethod === "fedapay"}
                    onChange={() => setPaymentMethod("fedapay")}
                  />
                  <span className="inline-flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Mobile Money
                  </span>
                </label>

                <label className="flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="radio"
                    name="payment_method"
                    value="wallet"
                    checked={paymentMethod === "wallet"}
                    onChange={() => setPaymentMethod("wallet")}
                    disabled={walletLoading || walletAvailable + 0.0001 < total}
                  />
                  <span className="inline-flex items-center gap-2">
                    Wallet {walletLoading ? "(chargement...)" : `(dispo: ${Math.floor(walletAvailable)} FCFA)`}
                  </span>
                  {!walletLoading && walletAvailable + 0.0001 < total ? (
                    <span className="text-xs text-white/50">(solde insuffisant)</span>
                  ) : null}
                </label>
              </div>

              <GlowButton
                className="w-full justify-center"
                onClick={handlePay}
                disabled={
                  loading ||
                  !cartItems.length ||
                  (paymentMethod === "wallet" && (walletLoading || walletAvailable + 0.0001 < total))
                }
              >
                <CreditCard className="h-4 w-4" />
                {loading ? "Paiement..." : "Payer maintenant"}
              </GlowButton>

              {status ? <p className="text-xs text-amber-200">{status}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  return (
    <RequireAuth>
      <CartScreen />
    </RequireAuth>
  );
}
