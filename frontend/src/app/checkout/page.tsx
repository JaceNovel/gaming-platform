"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import RequireAuth from "@/components/auth/RequireAuth";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api` : "");

function CheckoutScreen() {
  const { authFetch } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = Number(searchParams.get("product"));
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isValidProduct = useMemo(() => Number.isFinite(productId) && productId > 0, [productId]);

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
      setStatus(data.message ?? "Commande créée.");
      setTimeout(() => router.push("/account"), 800);
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
