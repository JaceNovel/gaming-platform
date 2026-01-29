export type DeliveryTone = "bolt" | "clock";

export type DeliveryDisplay = {
  label: string;
  tone: DeliveryTone;
};

type DeliveryInput = {
  type?: string | null;
  displaySection?: string | null;
  display_section?: string | null;
  deliveryEstimateLabel?: string | null;
  delivery_estimate_label?: string | null;
};

const norm = (value: unknown) => String(value ?? "").trim();

export const getDeliveryDisplay = (product: DeliveryInput | null | undefined): DeliveryDisplay | null => {
  if (!product) return null;

  const type = norm(product.type).toLowerCase();
  const displaySection = norm(product.displaySection ?? product.display_section).toLowerCase();
  const deliveryEstimateLabel = norm(product.deliveryEstimateLabel ?? product.delivery_estimate_label);

  // Recharge: always instant.
  if (type.includes("recharge") || type.includes("topup")) {
    return { label: "⚡Instantané", tone: "bolt" };
  }

  // Abonnement: always 2h.
  if (type.includes("subscription") || type.includes("abonnement") || type.includes("premium")) {
    return { label: "⏱️2h", tone: "clock" };
  }

  // Skin: always 2h (by shop section or explicit type).
  if (type.includes("skin") || displaySection === "emote_skin") {
    return { label: "⏱️2h", tone: "clock" };
  }

  // Compte gaming: always 24h.
  if (type.includes("account") || type.includes("compte")) {
    return { label: "⏱️24h", tone: "clock" };
  }

  // Accessoires: label is admin-defined.
  if (type === "item" || type.includes("accessory") || type.includes("accessoire")) {
    if (!deliveryEstimateLabel) return null;
    return { label: `⏱️ Livraison estimée : ${deliveryEstimateLabel}`, tone: "clock" };
  }

  return null;
};
