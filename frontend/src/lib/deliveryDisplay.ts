export type DeliveryTone = "bolt" | "clock";

export type DeliveryDisplay = {
  label: string;
  tone: DeliveryTone;
};

type DeliveryInput = {
  type?: string | null;
  displaySection?: string | null;
  display_section?: string | null;
  estimatedDeliveryLabel?: string | null;
  estimated_delivery_label?: string | null;
  deliveryEstimateLabel?: string | null;
  delivery_estimate_label?: string | null;
};

const norm = (value: unknown) => String(value ?? "").trim();

const normalizeEtaLabel = (raw: string): string => {
  const value = norm(raw);
  if (!value) return value;

  const lower = value.toLowerCase();

  if (lower.includes("instant")) return "Instantané";

  // Examples:
  // - "2 jours" -> "2j"
  // - "14 jours" -> "14j"
  // - "2 semaines" -> "2 sem."
  // - "24h" -> "24h"
  const daysMatch = lower.match(/^(\d+)\s*(jour|jours)\b/);
  if (daysMatch) return `${daysMatch[1]}j`;

  const weeksMatch = lower.match(/^(\d+)\s*(semaine|semaines|sem\.?|sems\.?)(\b|\s)/);
  if (weeksMatch) return `${weeksMatch[1]} sem.`;

  const hoursMatch = lower.match(/^(\d+)\s*h\b/);
  if (hoursMatch) return `${hoursMatch[1]}h`;

  return value;
};

export const getDeliveryDisplay = (product: DeliveryInput | null | undefined): DeliveryDisplay | null => {
  if (!product) return null;

  const type = norm(product.type).toLowerCase();
  const displaySection = norm(product.displaySection ?? product.display_section).toLowerCase();
  const estimatedDeliveryLabel = norm(product.estimatedDeliveryLabel ?? product.estimated_delivery_label);
  const deliveryEstimateLabel = norm(product.deliveryEstimateLabel ?? product.delivery_estimate_label);

  // Prefer server-computed delivery label when available.
  if (estimatedDeliveryLabel) {
    const label = normalizeEtaLabel(estimatedDeliveryLabel);
    const tone: DeliveryTone = label.toLowerCase().includes("instant") ? "bolt" : "clock";
    return { label, tone };
  }

  // Recharge: always instant.
  if (type.includes("recharge") || type.includes("topup")) {
    return { label: "Instantané", tone: "bolt" };
  }

  // Abonnement: always 2h.
  if (type.includes("subscription") || type.includes("abonnement") || type.includes("premium")) {
    return { label: "2h", tone: "clock" };
  }

  // Skin: always 2h (by shop section or explicit type).
  if (type.includes("skin") || displaySection === "emote_skin") {
    return { label: "2h", tone: "clock" };
  }

  // Compte gaming: always 24h.
  if (type.includes("account") || type.includes("compte")) {
    return { label: "24h", tone: "clock" };
  }

  // Accessoires: label is admin-defined.
  if (type === "item" || type.includes("accessory") || type.includes("accessoire")) {
    if (!deliveryEstimateLabel) return null;
    return { label: normalizeEtaLabel(deliveryEstimateLabel), tone: "clock" };
  }

  return null;
};
