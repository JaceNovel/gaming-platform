"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { useCartFlight } from "@/hooks/useCartFlight";
import { toDisplayImageSrc } from "@/lib/imageProxy";
import { getDeliveryDisplay } from "@/lib/deliveryDisplay";
import { openTidioChat } from "@/lib/tidioChat";

type ApiProduct = {
  id: number | string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  estimated_delivery_label?: string | null;
  delivery_estimate_label?: string | null;
  delivery_eta_days?: number | null;
  display_section?: string | null;
  details?: {
    description?: string | null;
    tags?: string[] | string | null;
    image?: string | null;
    banner?: string | null;
    cover?: string | null;
    brand?: string | null;
    stock?: number | null;
  } | null;
  price?: number | string | null;
  discount_price?: number | string | null;
  image_url?: string | null;
  cover?: string | null;
  banner?: string | null;
  media?: Array<{ url?: string | null } | string>;
  images?: Array<{ url?: string | null; path?: string | null } | string> | null;
  category?: string | null;
  category_entity?: { name?: string | null } | null;
  brand?: string | null;
  stock?: number | null;
  stock_quantity?: number | null;
  stockType?: string | null;
  stock_type?: string | null;
  tags?: Array<{ name?: string | null } | string> | string[] | string | null;
};

const formatPrice = (value: number) => `${new Intl.NumberFormat("fr-FR").format(Math.max(0, value))} FCFA`;

const extractImage = (product: ApiProduct | null): string | null => {
  if (!product) return null;
  if (product.image_url) return product.image_url;
  if (Array.isArray(product.images) && product.images.length) {
    const first = product.images[0];
    if (typeof first === "string") return first;
    return first?.url ?? first?.path ?? null;
  }
  if (product.details?.image) return product.details.image;
  // If no explicit image is set, fall back to cover/banner.
  if (product.cover) return product.cover;
  if (product.banner) return product.banner;
  if (product.details?.cover) return product.details.cover;
  if (product.details?.banner) return product.details.banner;
  if (Array.isArray(product.media) && product.media.length) {
    const entry = product.media[0];
    if (typeof entry === "string") return entry;
    return entry?.url ?? null;
  }
  return null;
};

const extractBanner = (product: ApiProduct | null): string | null => {
  if (!product) return null;
  return (
    product.details?.banner ??
    product.banner ??
    product.details?.cover ??
    product.cover ??
    null
  );
};

const normalizeTags = (product: ApiProduct | null): string[] => {
  if (!product) return [];
  const raw = product.tags ?? product.details?.tags;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((tag) => (typeof tag === "string" ? tag : tag?.name))
      .map((tag) => String(tag ?? "").trim())
      .filter(Boolean);
  }
  return String(raw)
    .split(/[,;]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const extractImages = (product: ApiProduct | null): string[] => {
  if (!product) return [];
  const images = Array.isArray(product.images) ? product.images : [];
  return images
    .map((entry) => {
      if (typeof entry === "string") return entry;
      return entry?.url ?? entry?.path ?? null;
    })
    .filter((value): value is string => Boolean(value));
};

const getNormalizedDeliveryLabel = (product: ApiProduct | null): string | null => {
  const delivery = getDeliveryDisplay({
    type: product?.type ?? null,
    display_section: product?.display_section ?? null,
    delivery_estimate_label: product?.delivery_estimate_label ?? null,
  });

  return delivery?.label ?? null;
};

function ImageCarousel({
  images,
  name,
  activeIndex,
  onActiveIndex,
  aspectClass,
}: {
  images: string[];
  name: string;
  activeIndex: number;
  onActiveIndex: (idx: number) => void;
  aspectClass: string;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const target = rail.children.item(activeIndex) as HTMLElement | null;
    target?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeIndex]);

  const handleScroll = () => {
    const rail = railRef.current;
    if (!rail) return;
    const width = rail.clientWidth || 1;
    const idx = Math.round(rail.scrollLeft / width);
    const next = Math.min(Math.max(idx, 0), Math.max(images.length - 1, 0));
    if (next !== activeIndex) onActiveIndex(next);
  };

  if (!images.length) {
    return (
      <div className={`flex ${aspectClass} w-full items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5 text-base font-semibold text-white/60 shadow-inner`}>
        Aucune image
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={railRef}
        onScroll={handleScroll}
        className="flex w-full snap-x snap-mandatory overflow-x-auto rounded-3xl border border-white/15 bg-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] scrollbar-soft"
      >
        {images.map((url, idx) => {
          const display = toDisplayImageSrc(url) ?? url;
          return (
            <div key={`${url}-${idx}`} className={`relative ${aspectClass} w-full flex-none snap-center overflow-hidden`}>
              <img src={display} alt={name} className="h-full w-full object-cover" loading={idx === 0 ? "eager" : "lazy"} />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent" />
            </div>
          );
        })}
      </div>

      {images.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {images.map((_, idx) => {
              const active = idx === activeIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onActiveIndex(idx)}
                  className={`h-1.5 rounded-full transition ${active ? "w-7 bg-rose-400" : "w-2.5 bg-white/25"}`}
                  aria-label={`Aller à l'image ${idx + 1}`}
                />
              );
            })}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((url, idx) => {
              const displayThumb = toDisplayImageSrc(url) ?? url;
              const active = idx === activeIndex;
              return (
                <button
                  key={`${url}-thumb-${idx}`}
                  type="button"
                  onClick={() => onActiveIndex(idx)}
                  className={
                    "relative h-12 w-16 flex-none overflow-hidden rounded-xl border bg-white/5 transition " +
                    (active ? "border-rose-400" : "border-white/10 hover:border-white/25")
                  }
                >
                  <img src={displayThumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { triggerFlight, overlay } = useCartFlight();
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const id = params?.id;

  useEffect(() => {
    let active = true;
    const loadProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/products/${id}`);
        if (!active) return;
        if (res.status === 404) {
          setError("Produit introuvable");
          setProduct(null);
          return;
        }
        if (!res.ok) {
          setError("Impossible de charger le produit.");
          setProduct(null);
          return;
        }
        const payload = await res.json();
        if (!active) return;
        setProduct(payload);
        setActiveImageIndex(0);
      } catch (err) {
        if (!active) return;
        setError("Erreur réseau, réessaie plus tard.");
      } finally {
        if (active) setLoading(false);
      }
    };

    if (id) {
      loadProduct();
    }

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  const mainImage = useMemo(() => extractImage(product), [product]);
  const carouselImages = useMemo(() => extractImages(product), [product]);
  const mergedCarouselImages = useMemo(() => {
    const base = carouselImages.length ? carouselImages : mainImage ? [mainImage] : [];
    const normalized = base
      .map((url) => String(url ?? "").trim())
      .filter(Boolean);
    const unique: string[] = [];
    for (const url of normalized) {
      if (!unique.includes(url)) unique.push(url);
    }
    return unique;
  }, [carouselImages, mainImage]);
  const bannerImage = useMemo(() => extractBanner(product), [product]);
  const displayBanner = useMemo(() => toDisplayImageSrc(bannerImage) ?? bannerImage, [bannerImage]);
  const tags = useMemo(() => normalizeTags(product), [product]);
  const priceValue = useMemo(
    () => Number(product?.discount_price ?? product?.price ?? 0) || 0,
    [product]
  );
  const description =
    product?.description ?? product?.details?.description ??
    "Offre spéciale disponible dans la boutique BADBOYSHOP.";
  const categoryLabel = product?.category_entity?.name ?? product?.category ?? "—";
  const brandLabel = product?.brand ?? product?.details?.brand ?? "N/A";
  const stockCount = useMemo(() => {
    if (!product) return 0;
    const value =
      product.stock ??
      product.stock_quantity ??
      product.details?.stock ??
      (product.stockType === "IN_STOCK" || product.stock_type === "IN_STOCK" ? 5 : 0);
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  }, [product]);
  const tagsLabel = tags.length ? tags.join(", ") : "Aucun tag";
  const deliveryLabel = useMemo(() => getNormalizedDeliveryLabel(product), [product]);
  const isRechargeDirect = useMemo(
    () => String(product?.display_section ?? "").toLowerCase() === "recharge_direct",
    [product?.display_section]
  );

  const persistToCart = () => {
    if (!product || typeof window === "undefined") return;
    const cartRaw = window.localStorage.getItem("bbshop_cart");
    let cart: Array<{ id: number | string; name: string; price: number; priceLabel: string; description?: string; quantity: number; type?: string; deliveryLabel?: string }>; // eslint-disable-line max-len
    try {
      cart = cartRaw ? JSON.parse(cartRaw) : [];
    } catch {
      cart = [];
    }
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity = Number(existing.quantity ?? 0) + 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name ?? product.title ?? "Produit",
        price: priceValue,
        priceLabel: formatPrice(priceValue),
        description,
        type: String(product.type ?? ""),
        deliveryLabel: deliveryLabel ?? undefined,
        quantity: 1,
      });
    }
    window.localStorage.setItem("bbshop_cart", JSON.stringify(cart));
    setStatusMessage("Produit ajouté au panier");
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = window.setTimeout(() => setStatusMessage(null), 2200);
  };

  const handleAddToCart = (event: MouseEvent<HTMLButtonElement>) => {
    if (isRechargeDirect) {
      const qs = new URLSearchParams({
        intent: "recharge_direct",
        product_id: String(product?.id ?? id ?? ""),
        product_name: String(product?.name ?? product?.title ?? ""),
      });
      void openTidioChat({
        message: `Bonjour, je veux une Recharge Direct : ${String(product?.name ?? product?.title ?? "Produit")} (ID: ${String(product?.id ?? id ?? "")}).`,
      });
      return;
    }
    persistToCart();
    triggerFlight(event.currentTarget);
  };

  const handleBuyNow = (event: MouseEvent<HTMLButtonElement>) => {
    if (isRechargeDirect) {
      const qs = new URLSearchParams({
        intent: "recharge_direct",
        product_id: String(product?.id ?? id ?? ""),
        product_name: String(product?.name ?? product?.title ?? ""),
      });
      void openTidioChat({
        message: `Bonjour, je veux une Recharge Direct : ${String(product?.name ?? product?.title ?? "Produit")} (ID: ${String(product?.id ?? id ?? "")}).`,
      });
      return;
    }
    persistToCart();
    triggerFlight(event.currentTarget);
    const rawId = product?.id ?? id;
    const checkoutProductId = Number(rawId);

    if (!Number.isFinite(checkoutProductId) || checkoutProductId <= 0) {
      setStatusMessage("Produit invalide");
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      statusTimeoutRef.current = window.setTimeout(() => setStatusMessage(null), 2200);
      return;
    }

    router.push(`/checkout?product=${checkoutProductId}`);
  };

  const infoRows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Catégorie", value: categoryLabel },
    ...(deliveryLabel ? [{ label: "Livraison", value: deliveryLabel }] : []),
    { label: "Marque", value: brandLabel ?? "N/A" },
    { label: "Stock", value: `${stockCount} unité${stockCount > 1 ? "s" : ""}` },
    { label: "Tags", value: tagsLabel },
  ];

  return (
    <main className="min-h-screen bg-[#05030d] text-white">
      {overlay}
      <div className="relative">
        <div className="relative h-44 w-full overflow-hidden bg-white/5 sm:h-64">
          {displayBanner ? (
            <img
              src={displayBanner}
              alt={product?.name ?? "Bannière"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.35),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.3),transparent_55%),radial-gradient(circle_at_50%_80%,rgba(244,206,106,0.15),transparent_55%)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/55 to-[#05030d]" />
        </div>
      </div>
      {statusMessage && (
        <div className="fixed right-4 top-[88px] z-50 flex items-center gap-2 rounded-2xl border border-white/15 bg-black/80 px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_60px_rgba(0,0,0,0.65)]">
          <ShoppingCart className="h-4 w-4 text-rose-400" />
          <span>{statusMessage}</span>
        </div>
      )}
      <div className="mx-auto w-full max-w-6xl px-4 py-10 lg:px-8 lg:py-16">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm font-medium text-white/70 transition hover:text-white"
          >
            ← Retour boutique
          </button>
          <Link href="/shop" className="text-sm text-rose-300 transition hover:text-rose-200">
            Voir toutes les offres
          </Link>
        </div>

        {loading && (
          <div className="mt-20 rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/60 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            Chargement du produit...
          </div>
        )}

        {!loading && error && (
          <div className="mt-20 rounded-3xl border border-rose-500/40 bg-rose-500/10 p-10 text-center text-rose-100">
            {error}
            <div className="mt-6">
              <Link href="/shop" className="text-sm font-semibold text-rose-200 underline">
                Retourner à la boutique
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && product && (
          <>
            <div className="mt-8 space-y-5 md:hidden">
              <div className="rounded-[32px] border border-white/10 bg-white/5 p-1 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                <ImageCarousel
                  images={mergedCarouselImages}
                  name={product.name ?? product.title ?? "Produit"}
                  activeIndex={activeImageIndex}
                  onActiveIndex={setActiveImageIndex}
                  aspectClass="aspect-square"
                />
              </div>
              <div className="space-y-4 rounded-[32px] border border-white/10 bg-black/40 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.4em] text-white/40">{categoryLabel}</p>
                  <h1 className="text-2xl font-bold text-white">{product.name ?? product.title ?? "Produit"}</h1>
                  <p className="text-2xl font-black text-[#ff4b63]">{formatPrice(priceValue)}</p>
                </div>
                <p className="text-sm text-white/70">{description}</p>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.slice(0, 8).map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Infos</p>
                  <div className="mt-3 space-y-2">
                    {infoRows.slice(0, 3).map((row) => (
                      <div key={row.label} className="flex items-center justify-between text-xs">
                        <span className="text-white/60">{row.label}</span>
                        <span className="font-semibold text-white">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {!isRechargeDirect ? (
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className="w-full rounded-2xl bg-[#d71933] px-5 py-3 text-sm font-semibold text-white shadow-[0_15px_45px_rgba(215,25,51,0.45)] transition active:scale-[0.99]"
                    >
                      Ajouter au panier
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_15px_45px_rgba(16,185,129,0.45)] transition active:scale-[0.99]"
                  >
                    {isRechargeDirect ? "Ouvrir le chat" : "Acheter maintenant"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-10 hidden gap-10 md:grid lg:grid-cols-[1.15fr_0.85fr]">
              <ImageCarousel
                images={mergedCarouselImages}
                name={product.name ?? product.title ?? "Produit"}
                activeIndex={activeImageIndex}
                onActiveIndex={setActiveImageIndex}
                aspectClass="aspect-[4/3]"
              />

              <div className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
                  <h1 className="text-3xl font-bold text-white">{product.name ?? product.title ?? "Produit"}</h1>
                  <p className="mt-3 text-3xl font-bold text-[#ff4b63]">{formatPrice(priceValue)}</p>
                  <p className="mt-4 text-base text-white/70">{description}</p>

                  <div className="mt-6">
                    <h2 className="text-lg font-semibold text-white">Informations</h2>
                    <div className="mt-4 divide-y divide-white/10 text-sm">
                      {infoRows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between py-3">
                          <span className="text-white/60">{row.label}</span>
                          <span className="text-right font-semibold text-white">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {!isRechargeDirect ? (
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        className="rounded-full bg-[#d71933] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-900/30 transition hover:bg-[#b51229]"
                      >
                        Ajouter au panier
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleBuyNow}
                      className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-700"
                    >
                      {isRechargeDirect ? "Ouvrir le chat" : "Acheter maintenant"}
                    </button>
                  </div>

                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                    {deliveryLabel ? <p className="font-semibold text-white">{deliveryLabel}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
