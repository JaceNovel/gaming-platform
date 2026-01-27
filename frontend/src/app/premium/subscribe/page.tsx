"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";

function getPremiumProductId(level: string): number | null {
  const v = level.toLowerCase();
  const raw =
    v === "bronze"
      ? process.env.NEXT_PUBLIC_PREMIUM_BRONZE_PRODUCT_ID
      : v === "platine"
        ? process.env.NEXT_PUBLIC_PREMIUM_PLATINE_PRODUCT_ID
        : v === "or"
          ? process.env.NEXT_PUBLIC_PREMIUM_OR_PRODUCT_ID
          : null;

  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function PremiumSubscribeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string | null>(null);

  const level = useMemo(() => String(searchParams.get("level") ?? "bronze"), [searchParams]);
  const productId = useMemo(() => getPremiumProductId(level), [level]);

  useEffect(() => {
    if (!productId) {
      setStatus(
        "Aucun produit Premium n'est configuré. Définis NEXT_PUBLIC_PREMIUM_*_PRODUCT_ID dans le frontend, ou lie tes plans Premium à un produit."
      );
      return;
    }

    // Route vers le checkout standard (CinetPay déjà intégré).
    router.replace(`/checkout?product=${productId}`);
  }, [productId, router]);

  return (
    <div className="mobile-shell min-h-screen space-y-6 py-6 pb-24">
      <SectionTitle eyebrow="Premium" label="Souscription" />
      <div className="glass-card space-y-4 rounded-2xl border border-white/10 p-6">
        <p className="text-sm text-white/70">Plan: <span className="font-semibold text-white">{level}</span></p>
        {status ? (
          <p className="text-sm text-amber-200">{status}</p>
        ) : (
          <p className="text-sm text-white/70">Redirection vers le paiement…</p>
        )}
        <div className="flex gap-3">
          <GlowButton variant="secondary" className="flex-1 justify-center" onClick={() => router.push("/premium")}
          >
            Retour
          </GlowButton>
        </div>
      </div>
    </div>
  );
}

export default function PremiumSubscribePage() {
  return (
    <RequireAuth>
      <PremiumSubscribeScreen />
    </RequireAuth>
  );
}
