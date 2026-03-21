import type { Metadata } from "next";
import ProductDetailsClient from "./ProductDetailsClient";

type ApiProduct = {
  id?: number | string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  details?: {
    description?: string | null;
    image?: string | null;
    banner?: string | null;
    cover?: string | null;
  } | null;
  image_url?: string | null;
  banner?: string | null;
  cover?: string | null;
  media?: Array<{ url?: string | null } | string>;
  images?: Array<{ url?: string | null; path?: string | null } | string> | null;
  category?: string | null;
  category_entity?: { name?: string | null; slug?: string | null } | null;
};

const getSiteUrl = () => {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  return raw !== "" ? raw.replace(/\/$/, "") : "https://primegaming.space";
};

const getApiBase = () => {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  return raw !== "" ? raw.replace(/\/$/, "") : "";
};

const pickImage = (p: ApiProduct | null): string | null => {
  if (!p) return null;
  if (p.details?.banner) return p.details.banner;
  if (p.details?.cover) return p.details.cover;
  if (p.details?.image) return p.details.image;
  if (p.banner) return p.banner;
  if (p.cover) return p.cover;
  if (p.image_url) return p.image_url;
  if (Array.isArray(p.media) && p.media.length) {
    const first = p.media[0];
    if (typeof first === "string") return first;
    return first?.url ?? null;
  }
  if (Array.isArray(p.images) && p.images.length) {
    const first = p.images[0];
    if (typeof first === "string") return first;
    return first?.url ?? first?.path ?? null;
  }
  return null;
};

const safeFetchJson = async <T,>(url: string): Promise<T | null> => {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
};

const resolveShareLanguage = (value: string | string[] | undefined): "fr" | "en" => {
  const normalized = Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
  return normalized.trim().toLowerCase() === "en" ? "en" : "fr";
};

const shareDescription = (name: string, language: "fr" | "en"): string => {
  return language === "en"
    ? `Buy ${name} on PRIME Gaming and get 5% off right now.`
    : `Achetez ${name} sur PRIME Gaming et bénéficiez dès maintenant de -5% de réduction.`;
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  const apiBase = getApiBase();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const id = String(resolvedParams.id ?? "");
  const language = resolveShareLanguage(resolvedSearchParams.lang);

  let product: ApiProduct | null = null;
  if (apiBase) {
    const payload = await safeFetchJson<{ data?: ApiProduct } | ApiProduct>(`${apiBase}/products/${encodeURIComponent(id)}`);
    product = (payload as any)?.data ? ((payload as any).data as ApiProduct) : ((payload as any) as ApiProduct);
  }

  const name = String(product?.name ?? product?.title ?? (language === "en" ? `Product ${id}` : `Produit ${id}`));
  const categoryName = String(product?.category_entity?.name ?? product?.category ?? "");
  const description = shareDescription(name, language);
  const image = pickImage(product);
  const title = categoryName ? `${name} | ${categoryName} | PRIME Gaming` : `${name} | PRIME Gaming`;
  const canonical = `${siteUrl}/produits/${encodeURIComponent(id)}`;
  const shareUrl = `${canonical}?lang=${language}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: shareUrl,
      type: "website",
      siteName: "PRIME Gaming",
      locale: language === "en" ? "en_US" : "fr_FR",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function ProductDetailsPage() {
  return <ProductDetailsClient />;
}
