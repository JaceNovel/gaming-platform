"use client";

import ProductsCatalogPage from "@/components/catalog/ProductsCatalogPage";
import { useParams } from "next/navigation";

export default function AbonnementsByGamePage() {
  const params = useParams();
  const gameSlug = String((params as any)?.gameSlug ?? "").trim().toLowerCase();
  const isFreeFire = gameSlug === "freefire" || gameSlug === "free-fire" || gameSlug.includes("freefire") || gameSlug.includes("free-fire");

  return (
    <>
      {isFreeFire ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
          <div className="rounded-2xl border border-amber-200/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            Les abonnements Free Fire sont traités uniquement de <strong>09h à 23h (GMT)</strong>. En dehors de ce créneau, aucun abonnement ne pourra s’effectuer.
          </div>
        </div>
      ) : null}

      <ProductsCatalogPage
        mode="game"
        title="Abonnements"
        subtitle="Abonnements VIP, Pass et offres premium par jeu."
        shopType="subscription"
        gameContext="subscription"
      />
    </>
  );
}
