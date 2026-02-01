import type { MetadataRoute } from "next";

const getSiteUrl = () => {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  return raw !== "" ? raw.replace(/\/$/, "") : "https://www.badboyshop.online";
};

type ApiCategory = { slug?: string | null; updated_at?: string | null };
type ApiProduct = { id?: number | string | null; updated_at?: string | null };

const getApiBase = () => {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  return raw !== "" ? raw.replace(/\/$/, "") : "";
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const apiBase = getApiBase();
  const now = new Date();

  const base: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/shop`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/premium`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/help`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  if (!apiBase) return base;

  const safeFetchJson = async <T,>(url: string): Promise<T | null> => {
    try {
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  };

  const [categoriesPayload, productsPayload] = await Promise.all([
    safeFetchJson<{ data?: ApiCategory[] } | ApiCategory[]>(`${apiBase}/categories`),
    safeFetchJson<{ data?: ApiProduct[] } | ApiProduct[]>(`${apiBase}/products?active=1`),
  ]);

  const categories = Array.isArray((categoriesPayload as any)?.data)
    ? ((categoriesPayload as any).data as ApiCategory[])
    : Array.isArray(categoriesPayload)
      ? (categoriesPayload as ApiCategory[])
      : [];

  const products = Array.isArray((productsPayload as any)?.data)
    ? ((productsPayload as any).data as ApiProduct[])
    : Array.isArray(productsPayload)
      ? (productsPayload as ApiProduct[])
      : [];

  const categoryRoutes: MetadataRoute.Sitemap = categories
    .map((c) => String(c?.slug ?? "").trim())
    .filter(Boolean)
    .map((slug) => ({
      url: `${siteUrl}/categorie/${encodeURIComponent(slug)}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

  const productRoutes: MetadataRoute.Sitemap = products
    .map((p) => p?.id)
    .filter((id): id is number | string => id !== null && id !== undefined)
    .map((id) => ({
      url: `${siteUrl}/produits/${encodeURIComponent(String(id))}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  // De-duplicate URLs.
  const seen = new Set<string>();
  const combined = [...base, ...categoryRoutes, ...productRoutes].filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });

  return combined;
}
