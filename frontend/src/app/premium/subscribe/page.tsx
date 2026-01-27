"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";
import { API_BASE } from "@/lib/config";

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

type ProductLite = {
  id: number;
  name?: string | null;
  title?: string | null;
  slug?: string | null;
  type?: string | null;
  is_active?: boolean;
  details?: any;
};

function normalizePremiumLevel(value: unknown): "bronze" | "or" | "platine" | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "bronze") return "bronze";
  if (v === "or" || v === "gold") return "or";
  if (v === "platine" || v === "platinum") return "platine";
  return null;
}

async function resolvePremiumProductId(level: string): Promise<number | null> {
  const fromEnv = getPremiumProductId(level);
  if (fromEnv) return fromEnv;

  const normalizedLevel = normalizePremiumLevel(level);
  if (!normalizedLevel) return null;

  try {
    const url = `${API_BASE}/products?type=subscription&active=true&limit=100`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as any;
    const products: ProductLite[] = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.data?.data)
        ? payload.data.data
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

    const subscriptionProducts = products.filter((p) => String(p?.type ?? "").toLowerCase() === "subscription");

    // 1) Prefer explicit mapping in product.details.premium_level
    const byDetails = subscriptionProducts.find((p) => {
      const d: any = p?.details ?? {};
      const declared = normalizePremiumLevel(d?.premium_level ?? d?.premiumLevel ?? d?.level);
      return declared === normalizedLevel;
    });
    if (byDetails?.id) return Number(byDetails.id);

    // 2) Fallback: infer from name/title/slug containing both premium/vip and the level.
    const levelNeedle = normalizedLevel;
    const byName = subscriptionProducts.find((p) => {
      const hay = `${p?.name ?? ""} ${p?.title ?? ""} ${p?.slug ?? ""}`.toLowerCase();
      const looksPremium = hay.includes("premium") || hay.includes("vip");
      const hasLevel = hay.includes(levelNeedle);
      return looksPremium && hasLevel;
    });
    if (byName?.id) return Number(byName.id);

    // 3) Last fallback: just match on the level token.
    const byToken = subscriptionProducts.find((p) => {
      const hay = `${p?.name ?? ""} ${p?.title ?? ""} ${p?.slug ?? ""}`.toLowerCase();
      return hay.includes(levelNeedle);
    });
    if (byToken?.id) return Number(byToken.id);

    return null;
  } catch {
    return null;
  }
}

function PremiumSubscribeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const level = useMemo(() => String(searchParams.get("level") ?? "bronze"), [searchParams]);

  useEffect(() => {
    let active = true;
    setStatus(null);
    setResolving(true);

    (async () => {
      const resolved = await resolvePremiumProductId(level);
      if (!active) return;
      setResolving(false);

      if (!resolved) {
        setStatus(
          "Aucun produit Premium n'est configuré pour ce plan. Configure NEXT_PUBLIC_PREMIUM_*_PRODUCT_ID, ou crée un produit de type 'subscription' avec details.premium_level = bronze|or|platine."
        );
        return;
      }

      // Route vers le checkout standard (CinetPay déjà intégré).
      router.replace(`/checkout?product=${resolved}`);
    })();

    return () => {
      active = false;
    };
  }, [level, router]);

  return (
    <div className="mobile-shell min-h-screen space-y-6 py-6 pb-24">
      <SectionTitle eyebrow="Premium" label="Souscription" />
      <div className="glass-card space-y-4 rounded-2xl border border-white/10 p-6">
        <p className="text-sm text-white/70">Plan: <span className="font-semibold text-white">{level}</span></p>
        {status ? (
          <p className="text-sm text-amber-200">{status}</p>
        ) : (
          <p className="text-sm text-white/70">{resolving ? "Recherche du produit Premium…" : "Redirection vers le paiement…"}</p>
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
