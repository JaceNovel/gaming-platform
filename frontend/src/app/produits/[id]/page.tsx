"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft, ShieldCheck, ShoppingCart, Store, Truck } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { useCartFlight } from "@/hooks/useCartFlight";
import { toDisplayImageSrc } from "@/lib/imageProxy";
import DeliveryBadge from "@/components/ui/DeliveryBadge";
import { getDeliveryBadgeDisplay } from "@/lib/deliveryDisplay";
import { openTidioChat } from "@/lib/tidioChat";
import { emitCartUpdated } from "@/lib/cartEvents";
import { useAuth } from "@/components/auth/AuthProvider";
import { getStoredStorefrontCountry, onStorefrontCountryChanged, setStoredStorefrontCountry, type StorefrontCountry } from "@/lib/storefrontCountry";

type ApiProduct = {
  id: number | string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  shipping_fee?: number | string | null;
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
    video?: string | null;
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
  accessory_category?: string | null;
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

const extractVideo = (product: ApiProduct | null): string | null => {
  if (!product) return null;
  return product.details?.video ?? null;
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

const getDelivery = (product: ApiProduct | null) =>
  getDeliveryBadgeDisplay({
    type: product?.type ?? null,
    display_section: product?.display_section ?? null,
    delivery_estimate_label: product?.delivery_estimate_label ?? null,
  });

const getDelayText = (label?: string | null) => {
  const raw = String(label ?? "").trim();
  if (!raw) return null;
  return raw.replace(/^⏱️\s*/, "").replace(/^Livraison estimée\s*:\s*/i, "").trim();
};

const getAvailabilityTone = (product: ApiProduct | null, stockCount: number, delayText?: string | null) => {
  const stockMode = String(product?.stockType ?? product?.stock_type ?? "").toUpperCase();

  if (stockMode === "IN_STOCK" && stockCount > 0) {
    return {
      label: "En stock immédiat",
      className: "border-emerald-300/35 bg-emerald-400/12 text-emerald-100",
      dotClassName: "bg-emerald-300",
    };
  }

  if (delayText) {
    return {
      label: `Disponible sous ${delayText}`,
      className: "border-cyan-300/25 bg-cyan-400/10 text-cyan-100",
      dotClassName: "bg-cyan-300",
    };
  }

  if (stockCount > 0) {
    return {
      label: "Disponible en boutique",
      className: "border-emerald-300/35 bg-emerald-400/12 text-emerald-100",
      dotClassName: "bg-emerald-300",
    };
  }

  return {
    label: "Disponibilité à confirmer",
    className: "border-white/15 bg-white/8 text-white/80",
    dotClassName: "bg-white/55",
  };
};

function DesktopProductGallery({
  images,
  name,
  activeIndex,
  onActiveIndex,
  onOpenLightbox,
}: {
  images: string[];
  name: string;
  activeIndex: number;
  onActiveIndex: (idx: number) => void;
  onOpenLightbox?: (src: string) => void;
}) {
  if (!images.length) {
    return (
      <div className="rounded-[34px] border border-white/10 bg-black/25 p-6 shadow-[0_40px_120px_rgba(0,0,0,0.4)]">
        <div className="flex aspect-[1.14/1] items-center justify-center rounded-[28px] border border-dashed border-white/15 bg-white/5 text-base font-semibold text-white/55">
          Aucune image
        </div>
      </div>
    );
  }

  const currentImage = toDisplayImageSrc(images[activeIndex] ?? images[0]) ?? images[activeIndex] ?? images[0];

  return (
    <div className="grid gap-5 xl:grid-cols-[88px_minmax(0,1fr)]">
      <div className="flex max-h-[720px] flex-col gap-4 overflow-y-auto pr-1 scrollbar-soft">
        {images.map((image, idx) => {
          const thumb = toDisplayImageSrc(image) ?? image;
          const active = idx === activeIndex;

          return (
            <button
              key={`${image}-${idx}`}
              type="button"
              onClick={() => onActiveIndex(idx)}
              className={
                "group relative overflow-hidden rounded-[22px] border bg-white/5 transition " +
                (active
                  ? "border-cyan-300/60 shadow-[0_0_0_1px_rgba(125,211,252,0.35),0_24px_60px_rgba(8,145,178,0.22)]"
                  : "border-white/10 hover:border-white/25")
              }
            >
              <img src={thumb} alt="" className="h-20 w-full object-cover transition duration-300 group-hover:scale-[1.04]" loading="lazy" />
            </button>
          );
        })}
      </div>

      <div className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,14,35,0.92),rgba(10,11,22,0.92))] p-6 shadow-[0_45px_120px_rgba(0,0,0,0.45)]">
        <button
          type="button"
          className="group relative block w-full overflow-hidden rounded-[28px] border border-white/10 bg-black/30"
          onClick={() => onOpenLightbox?.(currentImage)}
          aria-label="Agrandir l'image"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.2),transparent_30%)]" />
          <img src={currentImage} alt={name} className="relative aspect-[1.14/1] w-full object-cover transition duration-500 group-hover:scale-[1.025]" loading="eager" />
        </button>
      </div>
    </div>
  );
}

function ImageCarousel({
  images,
  name,
  activeIndex,
  onActiveIndex,
  aspectClass,
  onOpenLightbox,
}: {
  images: string[];
  name: string;
  activeIndex: number;
  onActiveIndex: (idx: number) => void;
  aspectClass: string;
  onOpenLightbox?: (src: string) => void;
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
            <button
              key={`${url}-${idx}`}
              type="button"
              className={`relative ${aspectClass} w-full flex-none snap-center overflow-hidden ${onOpenLightbox ? "cursor-zoom-in" : ""}`}
              onClick={() => onOpenLightbox?.(display)}
              aria-label="Agrandir l'image"
            >
              <img src={display} alt={name} className="h-full w-full object-cover" loading={idx === 0 ? "eager" : "lazy"} />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent" />
            </button>
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

function AutoLoopVideo({ src, title, aspectClass }: { src: string; title: string; aspectClass: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          void video.play().catch(() => {
            // autoplay can be blocked on some devices, keep silent
          });
          return;
        }
        video.pause();
      },
      { threshold: 0.35 }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
    };
  }, [src]);

  return (
    <div className="rounded-3xl border border-white/15 bg-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
      <video
        ref={videoRef}
        src={src}
        title={title}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback"
        disablePictureInPicture
        className={`${aspectClass} w-full rounded-3xl object-cover`}
      />
    </div>
  );
}

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { triggerFlight, overlay } = useCartFlight();
  const { user } = useAuth();
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | number | null>(null);
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [storefrontCountries, setStorefrontCountries] = useState<StorefrontCountry[]>([]);
  const [storefrontCountryCode, setStorefrontCountryCode] = useState("TG");
  const id = params?.id;

  useEffect(() => {
    setStorefrontCountryCode(getStoredStorefrontCountry());
    return onStorefrontCountryChanged(setStorefrontCountryCode);
  }, []);

  useEffect(() => {
    let active = true;

    const loadStorefrontCountries = async () => {
      try {
        const res = await fetch(`${API_BASE}/storefront/countries`, { headers: { Accept: "application/json" } });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !active) return;

        const next = Array.isArray(payload?.data) ? payload.data : [];
        setStorefrontCountries(next);
        if (next.length > 0 && !next.some((country: StorefrontCountry) => country.code === storefrontCountryCode)) {
          const fallback = String(next[0]?.code ?? "TG").toUpperCase();
          setStorefrontCountryCode(fallback);
          setStoredStorefrontCountry(fallback);
        }
      } catch {
        if (!active) return;
        setStorefrontCountries([]);
      }
    };

    loadStorefrontCountries();
    return () => {
      active = false;
    };
  }, [storefrontCountryCode]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!lightboxSrc) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSrc(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxSrc]);

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
  const videoRaw = useMemo(() => extractVideo(product), [product]);
  const displayVideo = useMemo(() => (videoRaw ? toDisplayImageSrc(videoRaw) ?? videoRaw : null), [videoRaw]);
  const displayBanner = useMemo(() => toDisplayImageSrc(bannerImage) ?? bannerImage, [bannerImage]);
  const tags = useMemo(() => normalizeTags(product), [product]);
  const priceValue = useMemo(
    () => Number(product?.discount_price ?? product?.price ?? 0) || 0,
    [product]
  );
  const basePriceValue = useMemo(() => Number(product?.price ?? priceValue) || priceValue, [product?.price, priceValue]);
  const shippingFeeValue = useMemo(() => Number(product?.shipping_fee ?? 0) || 0, [product?.shipping_fee]);

  const description =
    product?.description ?? product?.details?.description ??
    "Offre spéciale disponible dans la boutique PRIME Gaming.";
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
  const delivery = useMemo(() => getDelivery(product), [product]);
  const delayText = useMemo(
    () => getDelayText(delivery?.desktopLabel ?? product?.estimated_delivery_label ?? product?.delivery_estimate_label ?? null),
    [delivery?.desktopLabel, product?.delivery_estimate_label, product?.estimated_delivery_label]
  );
  const availability = useMemo(() => getAvailabilityTone(product, stockCount, delayText), [delayText, product, stockCount]);
  const isRechargeDirect = useMemo(
    () => String(product?.display_section ?? "").toLowerCase() === "recharge_direct",
    [product?.display_section]
  );
  const totalValue = priceValue + shippingFeeValue;
  const isAccessoryProduct = useMemo(() => Boolean(String(product?.accessory_category ?? "").trim()), [product?.accessory_category]);
  const activeStorefrontCountry = useMemo(
    () => storefrontCountries.find((country) => country.code === storefrontCountryCode) ?? null,
    [storefrontCountries, storefrontCountryCode]
  );
  const galleryLabel = useMemo(() => {
    if (brandLabel && brandLabel !== "N/A") return brandLabel;
    return categoryLabel;
  }, [brandLabel, categoryLabel]);

  const persistToCart = () => {
    if (!product || typeof window === "undefined") return;
    const cartRaw = window.localStorage.getItem("bbshop_cart");
    let cart: Array<{
      id: number | string;
      name: string;
      price: number;
      priceLabel: string;
      description?: string;
      quantity: number;
      type?: string;
      displaySection?: string | null;
      deliveryEstimateLabel?: string | null;
      deliveryLabel?: string;
      shippingFee?: number;
    }>;
    try {
      cart = cartRaw ? JSON.parse(cartRaw) : [];
    } catch {
      cart = [];
    }
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity = Number(existing.quantity ?? 0) + 1;
      if (existing.shippingFee === undefined) {
        existing.shippingFee = Number(product.shipping_fee ?? 0) || 0;
      }
    } else {
      cart.push({
        id: product.id,
        name: product.name ?? product.title ?? "Produit",
        price: priceValue,
        priceLabel: formatPrice(priceValue),
        description,
        type: String(product.type ?? ""),
        displaySection: product.display_section ?? null,
        deliveryEstimateLabel: product.delivery_estimate_label ?? null,
        deliveryLabel: delivery?.desktopLabel ?? undefined,
        shippingFee: Number(product.shipping_fee ?? 0) || 0,
        quantity: 1,
      });
    }
    window.localStorage.setItem("bbshop_cart", JSON.stringify(cart));
    emitCartUpdated({ action: "add" });
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

  const handleBuyNow = (_event: MouseEvent<HTMLButtonElement>) => {
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
    ...(delivery ? [{ label: "Livraison", value: <DeliveryBadge delivery={delivery} /> }] : []),
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
              <Link href="/" className="text-sm font-semibold text-rose-200 underline">
                Retourner à l'accueil
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && product && (
          <>
            <div className="mt-8 space-y-5 md:hidden">
              <div className="rounded-[32px] border border-white/10 bg-white/5 p-1 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                {displayVideo ? (
                  <AutoLoopVideo
                    src={displayVideo}
                    title={product.name ?? product.title ?? "Produit"}
                    aspectClass="aspect-square"
                  />
                ) : (
                  <ImageCarousel
                    images={mergedCarouselImages}
                    name={product.name ?? product.title ?? "Produit"}
                    activeIndex={activeImageIndex}
                    onActiveIndex={setActiveImageIndex}
                    aspectClass="aspect-square"
                    onOpenLightbox={setLightboxSrc}
                  />
                )}
              </div>
              <div className="space-y-4 rounded-[32px] border border-white/10 bg-black/40 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.4em] text-white/40">{categoryLabel}</p>
                  <h1 className="text-2xl font-bold text-white">{product.name ?? product.title ?? "Produit"}</h1>
                  <p className="text-2xl font-black text-[#ff4b63]">{formatPrice(priceValue)}</p>
                </div>

                {isAccessoryProduct && storefrontCountries.length > 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
                    <div className="mb-2 text-[11px] uppercase tracking-[0.32em] text-white/40">Pays de livraison</div>
                    <select
                      value={storefrontCountryCode}
                      onChange={(event) => {
                        const next = event.target.value.toUpperCase();
                        setStorefrontCountryCode(next);
                        setStoredStorefrontCountry(next);
                      }}
                      className="w-full rounded-2xl border border-white/12 bg-black/25 px-4 py-3 text-sm font-semibold text-white outline-none"
                    >
                      {storefrontCountries.map((country) => (
                        <option key={country.code} value={country.code} className="bg-slate-950 text-white">
                          {country.name}
                        </option>
                      ))}
                    </select>
                    {activeStorefrontCountry?.customer_notice ? (
                      <p className="mt-2 text-xs text-white/55">{activeStorefrontCountry.customer_notice}</p>
                    ) : null}
                  </div>
                ) : null}

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
              <div className="relative md:col-span-2 lg:col-span-2">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,rgba(34,211,238,0.14),transparent_22%),radial-gradient(circle_at_75%_10%,rgba(225,29,72,0.16),transparent_22%),radial-gradient(circle_at_62%_82%,rgba(99,102,241,0.14),transparent_22%)]" />
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.9fr)_360px]">
                  <div className="space-y-5">
                    {displayVideo && mergedCarouselImages.length === 0 ? (
                      <AutoLoopVideo
                        src={displayVideo}
                        title={product.name ?? product.title ?? "Produit"}
                        aspectClass="aspect-[1.14/1]"
                      />
                    ) : (
                      <DesktopProductGallery
                        images={mergedCarouselImages}
                        name={product.name ?? product.title ?? "Produit"}
                        activeIndex={activeImageIndex}
                        onActiveIndex={setActiveImageIndex}
                        onOpenLightbox={setLightboxSrc}
                      />
                    )}
                  </div>

                  <div className="space-y-6 rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,13,35,0.9),rgba(11,11,22,0.88))] p-8 shadow-[0_45px_120px_rgba(0,0,0,0.46)]">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.32em] text-white/45">
                        <span>{galleryLabel}</span>
                        <span className="text-white/20">•</span>
                        <span>{categoryLabel}</span>
                      </div>

                      <h1 className="text-[2rem] font-black leading-[1.08] text-white">
                        {product.name ?? product.title ?? "Produit"}
                      </h1>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-amber-100">
                          <div className="flex gap-1 text-[13px] leading-none">
                            <span>★</span>
                            <span>★</span>
                            <span>★</span>
                            <span>★</span>
                            <span className="text-white/35">★</span>
                          </div>
                          <span className="font-semibold">Sélection gaming PRIME</span>
                        </div>

                        {delivery ? <DeliveryBadge delivery={delivery} /> : null}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-rose-400/20 bg-[linear-gradient(180deg,rgba(255,29,93,0.16),rgba(255,255,255,0.04))] p-6 shadow-[0_30px_80px_rgba(120,15,45,0.2)]">
                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-100/75">Offre boutique</div>
                          <div className="mt-3 flex items-end gap-3">
                            <p className="text-5xl font-black leading-none text-white">{formatPrice(priceValue)}</p>
                            {basePriceValue > priceValue ? (
                              <p className="pb-1 text-base text-white/45 line-through">{formatPrice(basePriceValue)}</p>
                            ) : null}
                          </div>
                        </div>

                        {basePriceValue > priceValue ? (
                          <div className="rounded-full border border-rose-300/25 bg-rose-400/14 px-3 py-1.5 text-sm font-semibold text-rose-100">
                            Économie {formatPrice(basePriceValue - priceValue)}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <p className="text-[15px] leading-7 text-white/72">{description}</p>

                    {tags.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-sm font-semibold text-white">Univers du produit</div>
                        <div className="flex flex-wrap gap-2.5">
                          {tags.slice(0, 8).map((tag) => (
                            <span key={tag} className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-semibold text-white/75">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-3 rounded-[28px] border border-white/10 bg-black/22 p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/38">Détails</div>
                      <div className="grid gap-3 text-sm text-white/76">
                        {infoRows.map((row) => (
                          <div key={row.label} className="flex items-center justify-between gap-4 border-b border-white/7 pb-3 last:border-b-0 last:pb-0">
                            <span className="text-white/48">{row.label}</span>
                            <span className="text-right font-semibold text-white">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <aside className="h-fit rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,19,36,0.94),rgba(10,10,18,0.96))] p-7 shadow-[0_50px_140px_rgba(0,0,0,0.5)] xl:sticky xl:top-28">
                    <div className="space-y-5">
                      <div className="border-b border-white/8 pb-4">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-white/55">Vendu par</span>
                          <span className="inline-flex items-center gap-2 font-semibold text-white">
                            <Store className="h-4 w-4 text-cyan-300" />
                            PRIME Gaming
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${availability.className}`}>
                          <span className={`h-2.5 w-2.5 rounded-full ${availability.dotClassName}`} />
                          <span>{availability.label}</span>
                        </div>

                        {delayText ? (
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-white/84">
                            <Truck className="h-4 w-4 text-cyan-300" />
                            <span>Délai: {delayText}</span>
                          </div>
                        ) : null}
                      </div>

                      {isAccessoryProduct && storefrontCountries.length > 0 ? (
                        <div className="space-y-3 rounded-[26px] border border-white/10 bg-black/20 p-5 text-sm">
                          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/38">Pays de livraison</div>
                          <select
                            value={storefrontCountryCode}
                            onChange={(event) => {
                              const next = event.target.value.toUpperCase();
                              setStorefrontCountryCode(next);
                              setStoredStorefrontCountry(next);
                            }}
                            className="w-full rounded-[20px] border border-white/12 bg-white/6 px-4 py-3 font-semibold text-white outline-none"
                          >
                            {storefrontCountries.map((country) => (
                              <option key={country.code} value={country.code} className="bg-slate-950 text-white">
                                {country.name}
                              </option>
                            ))}
                          </select>
                          <div className="text-xs text-white/55">
                            {activeStorefrontCountry?.customer_notice ?? "Le pays est choisi ici pour la tarification et la livraison locale accessoires."}
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-3 rounded-[26px] border border-white/10 bg-black/20 p-5 text-sm">
                        <div className="flex items-center justify-between gap-3 text-white/74">
                          <span>Prix</span>
                          <span className="font-semibold text-white">{formatPrice(priceValue)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-white/74">
                          <span>Livraison</span>
                          <span className="font-semibold text-white">{shippingFeeValue > 0 ? formatPrice(shippingFeeValue) : "0 FCFA"}</span>
                        </div>
                        <div className="border-t border-white/10 pt-3">
                          <div className="flex items-center justify-between gap-3 text-base font-bold text-white">
                            <span>Total</span>
                            <span className="text-cyan-300">{formatPrice(totalValue)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <button
                          type="button"
                          onClick={handleBuyNow}
                          className="rounded-[24px] bg-[linear-gradient(135deg,#0b4f62,#0f2434)] px-6 py-4 text-base font-bold text-cyan-50 shadow-[0_24px_60px_rgba(5,95,128,0.28)] transition hover:brightness-110"
                        >
                          {isRechargeDirect ? "Ouvrir le chat" : "Acheter"}
                        </button>

                        {!isRechargeDirect ? (
                          <button
                            type="button"
                            onClick={handleAddToCart}
                            className="rounded-[24px] border border-white/12 bg-white/6 px-6 py-4 text-base font-bold text-white transition hover:bg-white/10"
                          >
                            Panier
                          </button>
                        ) : null}
                      </div>

                      <div className="space-y-3 rounded-[26px] border border-white/10 bg-white/5 p-5 text-sm text-white/72">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="h-4 w-4 text-cyan-300" />
                          <span>Paiement suivi et support boutique réactif</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Check className="h-4 w-4 text-emerald-300" />
                          <span>Contrôle qualité et disponibilité avant expédition</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Truck className="h-4 w-4 text-amber-300" />
                          <span>Livraison adaptée au type de produit et au flux gaming</span>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {lightboxSrc ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxSrc(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Aperçu"
            className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </main>
  );
}
