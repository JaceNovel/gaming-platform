"use client";

import ProductsCatalogPage from "@/components/catalog/ProductsCatalogPage";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function RechargesByGamePage() {
  const { language } = useLanguage();

  return (
    <ProductsCatalogPage
      mode="game"
      title={language === "fr" ? "Recharges" : "Top-ups"}
      subtitle={
        language === "fr"
          ? "Choisis ton jeu et achète ta recharge en quelques secondes."
          : "Choose your game and buy your top-up in seconds."
      }
      shopType="recharge"
      gameContext="recharge"
    />
  );
}
