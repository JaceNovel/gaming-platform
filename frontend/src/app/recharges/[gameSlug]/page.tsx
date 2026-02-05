"use client";

import ProductsCatalogPage from "@/components/catalog/ProductsCatalogPage";

export default function RechargesByGamePage() {
  return (
    <ProductsCatalogPage
      mode="game"
      title="Recharges"
      subtitle="Choisis ton jeu et achète ta recharge en quelques secondes."
      shopType="recharge"
      gameContext="recharge"
    />
  );
}
