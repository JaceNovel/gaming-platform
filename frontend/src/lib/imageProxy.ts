import { API_BASE } from "@/lib/config";

const coerceImageValue = (raw: unknown): string => {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number") return String(raw).trim();
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const nested = record.url ?? record.path ?? record.src ?? record.image ?? null;
    if (typeof nested === "string") return nested.trim();
  }
  return "";
};

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const safeParseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const sameHostAsApi = (imageUrl: string) => {
  const api = safeParseUrl(API_BASE);
  const img = safeParseUrl(imageUrl);
  if (!api || !img) return false;
  return api.host === img.host;
};

const apiOrigin = (() => {
  const api = safeParseUrl(API_BASE);
  return api ? api.origin : null;
})();

export const toDisplayImageSrc = (raw: unknown): string | null => {
  const value = coerceImageValue(raw);
  if (!value) return null;

  if (value.startsWith("data:")) return value;
  if (value.startsWith("blob:")) return value;

  // Relative URLs
  // - Frontend assets like /images/... should remain relative.
  // - Backend public storage paths like /storage/... are served from the API.
  if (value.startsWith("/")) {
    if (value.startsWith("/api/storage/") && apiOrigin) {
      // Public storage served from API origin (avoid double /api prefix).
      return `${apiOrigin}${value}`;
    }
    if (value.startsWith("/storage/") && API_BASE) {
      // Route through API so it works even when /storage static serving is not configured.
      return `${API_BASE}${value}`;
    }
    return value;
  }

  // Protocol-relative
  if (value.startsWith("//")) {
    const normalized = `https:${value}`;
    return sameHostAsApi(normalized)
      ? normalized
      : `${API_BASE}/image-proxy?url=${encodeURIComponent(normalized)}`;
  }

  if (!isHttpUrl(value)) return value;

  // If the image is hosted by our backend but points to /storage, rewrite to /api/storage.
  const parsed = safeParseUrl(value);
  if (parsed && sameHostAsApi(value) && parsed.pathname.startsWith("/storage/")) {
    return `${parsed.origin}/api${parsed.pathname}${parsed.search}`;
  }

  // If the image is hosted by our backend but points to /api/api/storage, normalize it.
  if (parsed && sameHostAsApi(value) && parsed.pathname.startsWith("/api/api/storage/")) {
    return `${parsed.origin}${parsed.pathname.replace("/api/api/storage/", "/api/storage/")}${parsed.search}`;
  }

  // If the image is already hosted by our backend, keep it as-is.
  if (sameHostAsApi(value)) return value;

  // Otherwise, proxy it (some sites block hotlinking / require referer).
  return `${API_BASE}/image-proxy?url=${encodeURIComponent(value)}`;
};
