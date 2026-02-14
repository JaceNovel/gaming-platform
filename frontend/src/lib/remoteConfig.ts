const STORAGE_KEY = "prime_remote_config";

export const REMOTE_CONFIG_DEFAULTS = {
  marketing_enabled: true,
  promo_enabled: false,
  promo_banner_text: "",
  promo_cta_url: "",
  promo_deadline_iso: "",
  new_user_bonus_limit: 20,
  new_user_bonus_window_hours: 24,
  countdown_enabled: false,
};

export type RemoteConfigValues = {
  marketingEnabled: boolean;
  promoEnabled: boolean;
  promoBannerText: string;
  promoCtaUrl: string;
  promoDeadlineIso: string;
  newUserBonusLimit: number;
  newUserBonusWindowHours: number;
  countdownEnabled: boolean;
};

const parseBool = (value: string | number | boolean | undefined, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(v)) return true;
    if (["0", "false", "no", "off"].includes(v)) return false;
  }
  return fallback;
};

const parseNumber = (value: string | number | undefined, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
};

export const parseRemoteConfig = (raw: Record<string, unknown>): RemoteConfigValues => {
  return {
    marketingEnabled: parseBool(raw.marketing_enabled as any, REMOTE_CONFIG_DEFAULTS.marketing_enabled),
    promoEnabled: parseBool(raw.promo_enabled as any, REMOTE_CONFIG_DEFAULTS.promo_enabled),
    promoBannerText: String(raw.promo_banner_text ?? "").trim(),
    promoCtaUrl: String(raw.promo_cta_url ?? "").trim(),
    promoDeadlineIso: String(raw.promo_deadline_iso ?? "").trim(),
    newUserBonusLimit: Math.max(0, Math.floor(parseNumber(raw.new_user_bonus_limit as any, REMOTE_CONFIG_DEFAULTS.new_user_bonus_limit))),
    newUserBonusWindowHours: Math.max(1, Math.floor(parseNumber(raw.new_user_bonus_window_hours as any, REMOTE_CONFIG_DEFAULTS.new_user_bonus_window_hours))),
    countdownEnabled: parseBool(raw.countdown_enabled as any, REMOTE_CONFIG_DEFAULTS.countdown_enabled),
  };
};

export const getCachedRemoteConfig = (): RemoteConfigValues => {
  if (typeof window === "undefined") {
    return parseRemoteConfig(REMOTE_CONFIG_DEFAULTS);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return parseRemoteConfig(REMOTE_CONFIG_DEFAULTS);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parseRemoteConfig({ ...REMOTE_CONFIG_DEFAULTS, ...parsed });
  } catch {
    return parseRemoteConfig(REMOTE_CONFIG_DEFAULTS);
  }
};

export const cacheRemoteConfig = (values: RemoteConfigValues) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // ignore
  }
};

export const getRemoteConfigKeys = () => Object.keys(REMOTE_CONFIG_DEFAULTS);

export const getRemoteConfigDefaults = () => ({ ...REMOTE_CONFIG_DEFAULTS });
