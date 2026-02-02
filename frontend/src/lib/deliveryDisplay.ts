export type DeliveryTone = "bolt" | "clock";

export type DeliveryDisplay = {
  label: string;
  tone: DeliveryTone;
};

export type DeliveryBadgeDisplay = {
  tone: DeliveryTone;
  desktopLabel: string;
  mobileLabel: string;
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

const isSkin = (type: string, displaySection: string) => {
  if (displaySection === "emote_skin") return true;
  return type.includes("skin");
};

const isRecharge = (type: string, displaySection: string) => {
  if (displaySection === "recharge_direct") return true;
  return type.includes("recharge") || type.includes("topup");
};

const isSubscription = (type: string) => {
  return type.includes("subscription") || type.includes("abonnement") || type.includes("premium");
};

const isAccount = (type: string) => {
  return type.includes("account") || type.includes("compte");
};

const isAccessory = (type: string, displaySection: string) => {
  // In this codebase: accessories are stored as type=item, but skins are also item (display_section=emote_skin).
  if (type !== "item" && !type.includes("accessory") && !type.includes("accessoire")) return false;
  return displaySection !== "emote_skin";
};

export const getDeliveryBadgeDisplay = (product: DeliveryInput | null | undefined): DeliveryBadgeDisplay | null => {
  if (!product) return null;

  const type = norm(product.type).toLowerCase();
  const displaySection = norm(product.displaySection ?? product.display_section).toLowerCase();
  const adminLabel = norm(product.deliveryEstimateLabel ?? product.delivery_estimate_label);

  // Règles normalisées.
  if (isRecharge(type, displaySection)) {
    return {
      tone: "bolt",
      desktopLabel: "⚡ Livraison instantanée",
      mobileLabel: "⚡ Instantané",
    };
  }

  if (isSubscription(type)) {
    return {
      tone: "clock",
      desktopLabel: "⏱️ Livraison estimée : ~2h",
      mobileLabel: "⏱️ ~2h",
    };
  }

  if (isSkin(type, displaySection)) {
    return {
      tone: "clock",
      desktopLabel: "⏱️ Livraison estimée : ~2h",
      mobileLabel: "⏱️ ~2h",
    };
  }

  if (isAccount(type)) {
    return {
      tone: "clock",
      desktopLabel: "⏱️ Livraison estimée : ~24h",
      mobileLabel: "⏱️ ~24h",
    };
  }

  if (isAccessory(type, displaySection)) {
    if (!adminLabel) return null;
    return {
      tone: "clock",
      desktopLabel: `⏱️ Livraison estimée : ${adminLabel}`,
      mobileLabel: `⏱️ ${adminLabel}`,
    };
  }

  return null;
};

export const getDeliveryDisplay = (product: DeliveryInput | null | undefined): DeliveryDisplay | null => {
  const badge = getDeliveryBadgeDisplay(product);
  if (!badge) return null;
  return { label: badge.desktopLabel, tone: badge.tone };
};
