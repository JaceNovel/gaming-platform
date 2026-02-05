"use client";

import ProductsCatalogPage from "@/components/catalog/ProductsCatalogPage";

export default function AbonnementsByGamePage() {
  return (
    <ProductsCatalogPage
      mode="game"
      title="Abonnements"
      subtitle="Abonnements VIP, Pass et offres premium par jeu."
      shopType="subscription"
      gameContext="subscription"
    />
  );
}
