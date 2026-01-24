"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, ShoppingBag } from "lucide-react";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";

type CartItem = {
  id: number;
  name: string;
  description?: string;
  price: number;
  priceLabel?: string;
  quantity: number;
  type?: string;
  game_id?: string;
};

function CartScreen() {
  const { authFetch } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

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
  const requiresGameId = (type?: string) => {
    const normalized = String(type ?? "").toLowerCase();
    return ["recharge", "subscription", "topup", "pass"].includes(normalized);
  };

  const handleGameIdChange = (id: number, value: string) => {
    setCartItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, game_id: value } : item));
      if (typeof window !== "undefined") {
        localStorage.setItem("bbshop_cart", JSON.stringify(next));
      }
      return next;
    });
  };
  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems],
  );
  const fees = Math.round(subtotal * 0.02);
  const total = subtotal + fees;

  const handlePay = async () => {
    setStatus(null);
    setLoading(true);
    try {
      if (!cartItems.length) {
        setStatus("Ton panier est vide.");
        return;
      }

      const orderRes = await authFetch(`${API_BASE}/orders`, {
        method: "POST",
        body: JSON.stringify({
          items: cartItems.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            game_id: item.game_id,
          })),
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        setStatus(err.message ?? "Impossible de créer la commande.");
        return;
      }

      const orderData = await orderRes.json();
      const orderId = orderData?.order?.id;

      if (!orderId) {
        setStatus("Commande invalide.");
        return;
      }

      const payRes = await authFetch(`${API_BASE}/payments/cinetpay/init`, {
        method: "POST",
        body: JSON.stringify({ order_id: orderId, payment_method: "cinetpay" }),
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
      setStatus("Connexion au serveur impossible.");
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
            <div className="flex items-center gap-3">
              <GlowButton variant="secondary" onClick={() => (window.location.href = "/shop")}>
                <ShoppingBag className="h-4 w-4" />
                Continuer les achats
              </GlowButton>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
              <SectionTitle eyebrow="Articles" label="Dans ton panier" />
              <div className="space-y-4">
                {cartItems.length ? cartItems.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-white">{item.name}</p>
                        <p className="text-sm text-white/60">{item.description}</p>
                        <p className="text-xs text-white/40 mt-1">Qté: {item.quantity}</p>
                      </div>
                      <p className="text-base font-bold text-cyan-200">
                        {(item.price * item.quantity).toLocaleString()} FCFA
                      </p>
                    </div>
                    {requiresGameId(item.type) && (
                      <div className="text-sm text-white/70">
                        <label className="text-xs text-white/60">ID jeu requis</label>
                        <input
                          className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                          value={item.game_id ?? ""}
                          onChange={(e) => handleGameIdChange(item.id, e.target.value)}
                          placeholder="Ex: 123456789"
                        />
                      </div>
                    )}
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
                  <span>{subtotal.toLocaleString()} FCFA</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Frais CinetPay</span>
                  <span>{fees.toLocaleString()} FCFA</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex items-center justify-between text-base font-bold text-white">
                  <span>Total</span>
                  <span>{total.toLocaleString()} FCFA</span>
                </div>
              </div>

              <GlowButton className="w-full justify-center" onClick={handlePay} disabled={loading || !cartItems.length}>
                <CreditCard className="h-4 w-4" />
                {loading ? "Paiement..." : "Payer maintenant"}
              </GlowButton>
              {status && <p className="text-xs text-amber-200">{status}</p>}
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
