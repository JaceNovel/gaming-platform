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
  deliveryEtaDays?: number | null;
  delivery_eta_days?: number | null;
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

const formatEtaDays = (days: number) => {
  if (!Number.isFinite(days) || days <= 0) return "";
  if (days <= 1) return "~24h";
  return `~${Math.round(days)}j`;
};

export const getDeliveryBadgeDisplay = (product: DeliveryInput | null | undefined): DeliveryBadgeDisplay | null => {
  if (!product) return null;

  const type = norm(product.type).toLowerCase();
  const displaySection = norm(product.displaySection ?? product.display_section).toLowerCase();
  const adminLabel =
    norm(product.deliveryEstimateLabel ?? product.delivery_estimate_label) ||
    norm(product.estimatedDeliveryLabel ?? product.estimated_delivery_label);
  const etaRaw = product.deliveryEtaDays ?? product.delivery_eta_days;
  const etaDays = etaRaw === null || etaRaw === undefined ? null : Number(etaRaw);
  const etaLabel = etaDays !== null && Number.isFinite(etaDays) ? formatEtaDays(etaDays) : "";

  // Règles normalisées.
  if (isRecharge(type, displaySection)) {
    return {
      tone: "bolt",
      desktopLabel: "⚡ Livraison : instantanée",
      mobileLabel: "⚡ Livraison : instantanée",
    };
  }

  if (isSubscription(type)) {
    return {
      tone: "clock",
      desktopLabel: "⏱️ Livraison : ~2h",
      mobileLabel: "⏱️ Livraison : ~2h",
    };
  }

  if (isSkin(type, displaySection)) {
    return {
      tone: "clock",
      desktopLabel: "⏱️ Livraison : ~2h",
      mobileLabel: "⏱️ Livraison : ~2h",
    };
  }

  if (isAccount(type)) {
    const label = etaLabel || "~24h";
    return {
      tone: "clock",
      desktopLabel: `🕒 Livraison : ${label}`,
      mobileLabel: `🕒 Livraison : ${label}`,
    };
  }

  if (isAccessory(type, displaySection)) {
    const resolved = adminLabel || etaLabel;
    if (!resolved) return null;
    return {
      tone: "clock",
      desktopLabel: `🕒 Livraison : ${resolved}`,
      mobileLabel: `🕒 Livraison : ${resolved}`,
    };
  }

  return null;
};

export const getDeliveryDisplay = (product: DeliveryInput | null | undefined): DeliveryDisplay | null => {
  const badge = getDeliveryBadgeDisplay(product);
  if (!badge) return null;
  return { label: badge.desktopLabel, tone: badge.tone };
};
