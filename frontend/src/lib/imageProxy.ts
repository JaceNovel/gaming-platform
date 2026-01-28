import { API_BASE } from "@/lib/config";

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

export const toDisplayImageSrc = (raw: string | null | undefined): string | null => {
  const value = (raw ?? "").trim();
  if (!value) return null;

  if (value.startsWith("data:")) return value;
  if (value.startsWith("blob:")) return value;

  // Relative URLs
  // - Frontend assets like /images/... should remain relative.
  // - Backend public storage paths like /storage/... must be served from the API host.
  if (value.startsWith("/")) {
    if ((value.startsWith("/storage/") || value.startsWith("/uploads/")) && apiOrigin) {
      return `${apiOrigin}${value}`;
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

  // If the image is already hosted by our backend, keep it as-is.
  if (sameHostAsApi(value)) return value;

  // Otherwise, proxy it (some sites block hotlinking / require referer).
  return `${API_BASE}/image-proxy?url=${encodeURIComponent(value)}`;
};
