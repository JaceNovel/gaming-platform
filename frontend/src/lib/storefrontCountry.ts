export type StorefrontCountry = {
  id: number;
  code: string;
  name: string;
  currency_code?: string | null;
  transit_provider_name?: string | null;
  transit_city?: string | null;
  customer_notice?: string | null;
};

const STORAGE_KEY = "bbshop_storefront_country";
const EVENT_NAME = "bbshop:storefront-country-changed";

export function getStoredStorefrontCountry(defaultCode = "TG"): string {
  if (typeof window === "undefined") return defaultCode;
  return String(window.localStorage.getItem(STORAGE_KEY) || defaultCode).toUpperCase();
}

export function setStoredStorefrontCountry(code: string) {
  if (typeof window === "undefined") return;
  const normalized = String(code || "TG").toUpperCase();
  window.localStorage.setItem(STORAGE_KEY, normalized);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: normalized }));
}

export function onStorefrontCountryChanged(callback: (code: string) => void) {
  if (typeof window === "undefined") return () => {};

  const listener = (event: Event) => {
    const custom = event as CustomEvent<string>;
    callback(String(custom.detail || getStoredStorefrontCountry()).toUpperCase());
  };

  const storageListener = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      callback(getStoredStorefrontCountry());
    }
  };

  window.addEventListener(EVENT_NAME, listener as EventListener);
  window.addEventListener("storage", storageListener);

  return () => {
    window.removeEventListener(EVENT_NAME, listener as EventListener);
    window.removeEventListener("storage", storageListener);
  };
}