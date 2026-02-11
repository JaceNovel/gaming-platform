export type VipLevel = "bronze" | "or" | "platine" | "";

export type VipUserLike = {
  is_premium?: boolean | null;
  premium_level?: string | number | null;
} | null | undefined;

export function getVipLevel(user: VipUserLike): VipLevel {
  if (!user?.is_premium) return "";
  const raw = String(user?.premium_level ?? "").trim().toLowerCase();
  if (raw === "bronze" || raw === "or" || raw === "platine") return raw;
  if (raw === "platinum") return "platine";
  return raw ? "" : "";
}

export function isVipActive(user: VipUserLike): boolean {
  return Boolean(user?.is_premium) && getVipLevel(user) !== "";
}

export function vipDiscountPercentForProductType(user: VipUserLike, productType?: string | null): number {
  if (!isVipActive(user)) return 0;
  const level = getVipLevel(user);
  const type = String(productType ?? "").trim().toLowerCase();

  if (level === "bronze") {
    if (type === "item") return 10;
    if (type === "recharge" || type === "subscription") return 5;
    return 0;
  }

  if (level === "platine") return 10;
  if (level === "or") return 7;
  return 3;
}

export function vipPriceFromUnitPrice(unitPrice: number, percent: number): number {
  const safeUnit = Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : 0;
  const safePercent = Number.isFinite(percent) ? Math.max(0, percent) : 0;
  if (safeUnit <= 0 || safePercent <= 0) return safeUnit;
  return Math.max(0, safeUnit * (1 - safePercent / 100));
}

export function vipDiscountAmount(lineAmount: number, percent: number): number {
  const safeLine = Number.isFinite(lineAmount) ? Math.max(0, lineAmount) : 0;
  const safePercent = Number.isFinite(percent) ? Math.max(0, percent) : 0;
  if (safeLine <= 0 || safePercent <= 0) return 0;
  return Math.max(0, safeLine * (safePercent / 100));
}
