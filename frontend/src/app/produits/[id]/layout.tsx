import type { Metadata } from "next";
import type { ReactNode } from "react";

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
  return raw !== "" ? raw.replace(/\/$/, "") : "https://www.badboyshop.online";
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

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  const apiBase = getApiBase();
  const id = String(params.id ?? "");

  let product: ApiProduct | null = null;
  if (apiBase) {
    const payload = await safeFetchJson<{ data?: ApiProduct } | ApiProduct>(`${apiBase}/products/${encodeURIComponent(id)}`);
    product = (payload as any)?.data ? ((payload as any).data as ApiProduct) : ((payload as any) as ApiProduct);
  }

  const name = String(product?.name ?? product?.title ?? `Produit ${id}`);
  const categoryName = String(product?.category_entity?.name ?? product?.category ?? "");
  const rawDesc = String(product?.details?.description ?? product?.description ?? "");
  const description = rawDesc.trim() ? rawDesc.trim().slice(0, 180) : `Découvre ${name} sur BADBOYSHOP.`;
  const image = pickImage(product);

  const title = categoryName ? `${name} | ${categoryName} | BADBOYSHOP` : `${name} | BADBOYSHOP`;
  const canonical = `${siteUrl}/produits/${encodeURIComponent(id)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
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

export default function ProductLayout({ children }: { children: ReactNode }) {
  return children;
}
