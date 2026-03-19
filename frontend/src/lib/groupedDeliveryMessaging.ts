export type GroupedDeliveryMessageInput = {
  shippingFee?: number | string | null;
  remainingValue?: number | string | null;
  freeShippingEligible?: boolean | null;
};

export const parseGroupedNumber = (value: number | string | null | undefined): number => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const formatGroupedFcfa = (value: number): string => {
  return `${Math.round(Math.max(0, value)).toLocaleString("fr-FR")} FCFA`;
};

export const buildGroupedDeliveryMessages = ({
  shippingFee,
  remainingValue,
  freeShippingEligible,
}: GroupedDeliveryMessageInput) => {
  const resolvedRemainingValue = parseGroupedNumber(remainingValue);
  const unlocked = Boolean(freeShippingEligible);

  if (unlocked) {
    return {
      short: "Livraison Gratuite et rapide debloquee",
      detail: "Votre lot est valide. La quote-part logistique est deja absorbee dans le lot, sans frais de livraison separes.",
      feeLabel: "Logistique mutualisee incluse",
    };
  }

  if (resolvedRemainingValue > 0) {
    return {
      short: `Plus que ${formatGroupedFcfa(resolvedRemainingValue)}`,
      detail: `Plus que ${formatGroupedFcfa(resolvedRemainingValue)} pour valider le lot. La logistique est mutualisee entre les commandes du lot et deja integree au prix affiche.`,
      feeLabel: "Quote-part lot deja integree",
    };
  }

  return {
    short: "Lot en preparation",
    detail: "Votre accessoire rejoint le lot groupe en cours. Le cout logistique est reparti sur l'ensemble du lot et integre directement au prix produit.",
    feeLabel: "Quote-part lot deja integree",
  };
};