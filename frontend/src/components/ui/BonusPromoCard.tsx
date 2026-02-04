"use client";

import Link from "next/link";
import { Gift, Timer } from "lucide-react";
import useBonusPromo, { formatRemaining } from "@/hooks/useBonusPromo";

export default function BonusPromoCard({ variant = "default" }: { variant?: "default" | "compact" }) {
  const promo = useBonusPromo();
  const time = formatRemaining(promo.remainingMs);

  const compact = variant === "compact";

  return (
    <div
      className={
        "relative overflow-hidden rounded-3xl border border-white/12 bg-white/5 backdrop-blur-xl " +
        (compact ? "px-4 py-3" : "p-5")
      }
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(110,231,255,0.18),transparent_55%)]" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-400/10 ring-1 ring-cyan-200/25">
              <Gift className="h-4 w-4 text-cyan-200" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-white">
                {promo.isActive ? "Bonus x2 (20 premiers)" : "Offre spéciale"}
              </p>
              <p className="truncate text-xs text-white/65">
                {promo.isActive ? "24h • 20 premiers" : "Revient bientôt"}
              </p>
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-100">
            <Timer className="h-4 w-4" />
            {promo.isActive ? time : "00:00:00"}
          </div>
        </div>
      </div>

      <div className={"relative mt-3 flex items-center gap-2 " + (compact ? "justify-end" : "justify-between")}
      >
        {!compact ? (
          <p className="text-xs text-white/70">
            Profite de la période promo pour recharger rapidement.
          </p>
        ) : null}

        <Link
          href="/shop"
          className="inline-flex items-center justify-center rounded-2xl bg-cyan-400/15 px-4 py-2 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-200/20 hover:bg-cyan-400/20"
        >
          Voir les recharges
        </Link>
      </div>
    </div>
  );
}
