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
  const [gameId, setGameId] = useState("");
  const [productType, setProductType] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValidProduct = useMemo(() => Number.isFinite(productId) && productId > 0, [productId]);
  const requiresGameId = useMemo(() => {
    const normalized = String(productType ?? "").toLowerCase();
    return ["recharge", "subscription", "topup", "pass"].includes(normalized);
  }, [productType]);

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

  const handleCreateOrder = async () => {
    setStatus(null);
    if (!isValidProduct) {
      setStatus("Produit invalide.");
      return;
    }
    setLoading(true);
    try {
      if (requiresGameId && !gameId.trim()) {
        setStatus("Merci de renseigner l'ID du jeu.");
        return;
      }

      const res = await authFetch(`${API_BASE}/orders`, {
        method: "POST",
        body: JSON.stringify({
          items: [{ product_id: productId, quantity, game_id: gameId || undefined }],
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

      const payRes = await authFetch(`${API_BASE}/payments/cinetpay/init`, {
        method: "POST",
        body: JSON.stringify({
          order_id: orderId,
          payment_method: "cinetpay",
          amount: amountToCharge,
          currency,
          customer_email: user?.email,
          metadata: {
            source: "checkout",
            product_id: productId,
            quantity,
            game_id: gameId || undefined,
          },
        }),
      });

      if (!payRes.ok) {
        const err = await payRes.json().catch(() => ({}));
        setStatus(err.message ?? "Impossible de démarrer le paiement.");
        return;
      }

      const payData = await payRes.json();
      const paymentUrl = payData?.data?.payment_url;

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
          {requiresGameId && (
            <div>
              <label className="text-sm text-white/70">ID du jeu</label>
              <input
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2"
                placeholder="Ex: 123456789"
              />
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
