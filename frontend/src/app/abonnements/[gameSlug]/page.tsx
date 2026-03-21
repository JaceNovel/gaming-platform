"use client";

import ProductsCatalogPage from "@/components/catalog/ProductsCatalogPage";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { useParams } from "next/navigation";

export default function AbonnementsByGamePage() {
  const { language } = useLanguage();
  const params = useParams();
  const gameSlug = String((params as any)?.gameSlug ?? "").trim().toLowerCase();
  const isFreeFire = gameSlug === "freefire" || gameSlug === "free-fire" || gameSlug.includes("freefire") || gameSlug.includes("free-fire");

  return (
    <>
      {isFreeFire ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
          <div className="rounded-2xl border border-amber-200/20 bg-amber-500/10 p-4 text-sm text-amber-100">
            {language === "fr" ? (
              <>
                Les abonnements Free Fire sont traités uniquement de <strong>09h à 23h (GMT)</strong>. En dehors de ce créneau, aucun abonnement ne pourra s’effectuer.
              </>
            ) : (
              <>
                Free Fire subscriptions are handled only from <strong>09:00 to 23:00 (GMT)</strong>. Outside this time window, no subscription can be processed.
              </>
            )}
          </div>
        </div>
      ) : null}

      <ProductsCatalogPage
        mode="game"
        title={language === "fr" ? "Abonnements" : "Subscriptions"}
        subtitle={language === "fr" ? "Abonnements VIP, Pass et offres premium par jeu." : "VIP subscriptions, passes, and premium offers by game."}
        shopType="subscription"
        gameContext="subscription"
      />
    </>
  );
}
