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
  const resolvedShippingFee = parseGroupedNumber(shippingFee);
  const resolvedRemainingValue = parseGroupedNumber(remainingValue);
  const unlocked = Boolean(freeShippingEligible) || resolvedShippingFee <= 0;

  if (unlocked) {
    return {
      short: "Livraison Gratuite et rapide debloquee",
      detail: "Votre lot est valide. Vous profitez maintenant de la Livraison Gratuite et rapide.",
      feeLabel: "Livraison offerte",
    };
  }

  if (resolvedRemainingValue > 0) {
    return {
      short: `Plus que ${formatGroupedFcfa(resolvedRemainingValue)}`,
      detail: `Plus que ${formatGroupedFcfa(resolvedRemainingValue)} pour debloquer la Livraison Gratuite et rapide. Votre accessoire rejoint deja le lot groupe en cours.`,
      feeLabel: `Livraison provisoire: ${formatGroupedFcfa(resolvedShippingFee)}`,
    };
  }

  return {
    short: `Livraison provisoire ${formatGroupedFcfa(resolvedShippingFee)}`,
    detail: `Votre accessoire rejoint le lot groupe en cours. En attendant la validation du lot, la livraison provisoire reste de ${formatGroupedFcfa(resolvedShippingFee)}.`,
    feeLabel: `Livraison provisoire: ${formatGroupedFcfa(resolvedShippingFee)}`,
  };
};