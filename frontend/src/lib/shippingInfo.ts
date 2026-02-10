export type ShippingInfo = {
  mapsUrl: string;
  city: string;
  phone: string;
};

const STORAGE_KEY = "bbshop_shipping_info";

export const buildMapsUrlFromCoords = (lat: number, lng: number) => {
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return "";
  return `https://www.google.com/maps?q=${encodeURIComponent(`${la},${lo}`)}`;
};

export const readShippingInfo = (): ShippingInfo | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: any = JSON.parse(raw);
    const mapsUrl = String(parsed?.mapsUrl ?? "").trim();
    const city = String(parsed?.city ?? "").trim();
    const phone = String(parsed?.phone ?? "").trim();
    if (!mapsUrl && !city && !phone) return null;
    return { mapsUrl, city, phone };
  } catch {
    return null;
  }
};

export const writeShippingInfo = (info: ShippingInfo) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      mapsUrl: String(info.mapsUrl ?? "").trim(),
      city: String(info.city ?? "").trim(),
      phone: String(info.phone ?? "").trim(),
    }),
  );
};

export const clearShippingInfo = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
};

export const isValidShippingInfo = (info: ShippingInfo | null | undefined) => {
  const mapsUrl = String(info?.mapsUrl ?? "").trim();
  const city = String(info?.city ?? "").trim();
  const phone = String(info?.phone ?? "").trim();
  return Boolean(mapsUrl && city && phone);
};
