import type { Metadata } from "next";
import Link from "next/link";

type ApiCategory = { id?: number; name?: string | null; slug?: string | null };

type ApiProduct = {
  id?: number | string | null;
  name?: string | null;
  details?: { description?: string | null; image?: string | null } | null;
  description?: string | null;
  image_url?: string | null;
  media?: Array<{ url?: string | null } | string>;
  images?: Array<{ url?: string | null; path?: string | null } | string> | null;
  category_entity?: { slug?: string | null; name?: string | null } | null;
  category?: string | null;
  price?: number | string | null;
  discount_price?: number | string | null;
};

const getSiteUrl = () => {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  return raw !== "" ? raw.replace(/\/$/, "") : "https://www.badboyshop.online";
};

const getApiBase = () => {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  return raw !== "" ? raw.replace(/\/$/, "") : "";
};

const slugify = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const pickImage = (p: ApiProduct): string | null => {
  if (p.details?.image) return p.details.image;
  if (p.image_url) return p.image_url;
  if (Array.isArray(p.media) && p.media.length) {
    const m = p.media[0];
    if (typeof m === "string") return m;
    return m?.url ?? null;
  }
  if (Array.isArray(p.images) && p.images.length) {
    const first = p.images[0];
    if (typeof first === "string") return first;
    return first?.url ?? first?.path ?? null;
  }
  return null;
};

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

const safeFetchJson = async <T,>(url: string): Promise<T | null> => {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const siteUrl = getSiteUrl();
  const apiBase = getApiBase();
  const slug = String(params.slug ?? "");

  let categoryName = slug;
  if (apiBase) {
    const payload = await safeFetchJson<{ data?: ApiCategory[] } | ApiCategory[]>(`${apiBase}/categories`);
    const list = Array.isArray((payload as any)?.data) ? ((payload as any).data as ApiCategory[]) : Array.isArray(payload) ? (payload as ApiCategory[]) : [];
    const found = list.find((c) => String(c?.slug ?? "") === slug);
    categoryName = found?.name ?? categoryName;
  }

  const title = `${categoryName} | BADBOYSHOP`;
  const description = `Découvre nos ${categoryName} : recharges, comptes, abonnements et offres gaming.`;

  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/categorie/${encodeURIComponent(slug)}` },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/categorie/${encodeURIComponent(slug)}`,
      type: "website",
    },
  };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const apiBase = getApiBase();
  const slug = String(params.slug ?? "");

  const [categoriesPayload, productsPayload] = await Promise.all([
    apiBase ? safeFetchJson<{ data?: ApiCategory[] } | ApiCategory[]>(`${apiBase}/categories`) : Promise.resolve(null),
    apiBase ? safeFetchJson<{ data?: ApiProduct[] } | ApiProduct[]>(`${apiBase}/products?active=1`) : Promise.resolve(null),
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

  const category = categories.find((c) => String(c?.slug ?? "") === slug);
  const categoryName = category?.name ?? slug;

  const filtered = products.filter((p) => {
    const productSlug = String(p?.category_entity?.slug ?? "").trim();
    if (productSlug) return productSlug === slug;
    const label = String(p?.category ?? p?.category_entity?.name ?? "");
    return slugify(label) === slug;
  });

  return (
    <main className="min-h-[100dvh] bg-[#04020c] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Catégorie</p>
            <h1 className="mt-2 text-3xl font-black text-white">{categoryName}</h1>
            <p className="mt-1 text-sm text-white/60">{filtered.length} produit(s)</p>
          </div>
          <Link
            href="/shop"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:text-white"
          >
            Retour boutique
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const id = p?.id;
            if (id === null || id === undefined) return null;
            const name = String(p?.name ?? "Produit");
            const desc = String(p?.details?.description ?? p?.description ?? "");
            const img = pickImage(p);
            const priceValue = Number(p?.discount_price ?? p?.price ?? 0);
            const priceLabel = `${formatNumber(Math.max(0, Math.round(priceValue)))} FCFA`;
            return (
              <Link
                key={String(id)}
                href={`/produits/${encodeURIComponent(String(id))}`}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-300/40"
              >
                <div className="relative h-40 w-full overflow-hidden rounded-2xl bg-black/30">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={name} className="h-full w-full object-cover opacity-95 transition group-hover:scale-[1.02]" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-cyan-400/10 via-fuchsia-400/10 to-transparent" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-white line-clamp-2">{name}</p>
                  {desc ? <p className="mt-1 text-xs text-white/60 line-clamp-2">{desc}</p> : null}
                  <p className="mt-3 text-lg font-black text-cyan-200">{priceLabel}</p>
                </div>
              </Link>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/70">
              Aucun produit disponible pour cette catégorie.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
