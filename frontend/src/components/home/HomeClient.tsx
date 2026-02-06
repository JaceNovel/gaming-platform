"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { useCartFlight } from "@/hooks/useCartFlight";
import { toDisplayImageSrc } from "../../lib/imageProxy";
import { useAuth } from "@/components/auth/AuthProvider";
import { getHomePopularSlotImage } from "@/lib/homePopularStaticImages";
import ImmersiveBackground from "@/components/layout/ImmersiveBackground";

type ProductCard = {
  id: number;
  title: string;
  subtitle: string;
  price: string;
  priceValue: number;
  description: string;
  type: string;
  likes: number;
  badge: string;
  image: string;
};

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

type HomeHeadlineStats = {
  accountsSold: number;
  rechargesDone: number;
  premiumMembers: number;
  guidesActive: number;
};

const DEFAULT_HOME_HEADLINE_STATS: HomeHeadlineStats = {
  accountsSold: 67,
  rechargesDone: 40,
  premiumMembers: 6,
  guidesActive: 25,
};

function ProductCardUI({
  p,
  onAddToCart,
  onBuy,
  showAddToCart = true,
  imageOverrideSrc,
}: {
  p: ProductCard;
  onAddToCart: (product: ProductCard, origin?: HTMLElement | null) => void;
  onBuy: (product: ProductCard, origin?: HTMLElement | null) => void;
  showAddToCart?: boolean;
  imageOverrideSrc?: string | null;
}) {
  const thumbSrc = toDisplayImageSrc(p.image) ?? p.image;

  return (
    <div className="relative w-[260px] shrink-0 snap-start overflow-hidden rounded-2xl bg-white/6 ring-1 ring-white/15 backdrop-blur-md sm:w-full sm:min-w-0 sm:shrink">
      {imageOverrideSrc ? (
        <img
          src={imageOverrideSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          aria-hidden="true"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
      {imageOverrideSrc ? (
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/55" />
      ) : null}
      <div className="relative p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80 ring-1 ring-white/10">
            {p.badge}
          </span>
          <div className="flex items-center gap-1 text-xs text-white/80">
            <Heart className="h-4 w-4 text-pink-400" />
            {p.likes}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="relative h-14 w-14 overflow-hidden rounded-xl ring-1 ring-white/15">
            <img
              src={thumbSrc}
              alt={p.title}
              className="h-full w-full object-cover opacity-90"
              loading="lazy"
            />
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">
              {p.title}
            </div>
            <div className="truncate text-xs text-white/70">{p.subtitle}</div>
            <div className="mt-2 text-sm font-extrabold text-cyan-300">
              {p.price}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={(event) => onBuy(p, event.currentTarget)}
            className="relative inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur-md transition active:scale-[0.98]"
          >
            Acheter
            <span className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-cyan-400/15 via-fuchsia-400/10 to-amber-300/10" />
          </button>

          {showAddToCart ? (
            <button
              type="button"
              onClick={(event) => onAddToCart(p, event.currentTarget)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/15 transition active:scale-[0.98]"
              aria-label="Ajouter au panier"
            >
              <ShoppingCart className="h-5 w-5 text-white/90" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function HomeClient() {
  const router = useRouter();
  const { triggerFlight, overlay } = useCartFlight();
  const { user, loading: authLoading } = useAuth();
  const [headlineStats, setHeadlineStats] = useState<HomeHeadlineStats>(DEFAULT_HOME_HEADLINE_STATS);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [desktopStart, setDesktopStart] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    let active = true;
    type ApiProduct = {
      id: number;
      name: string;
      description?: string | null;
      discount_price?: number | string | null;
      price?: number | string | null;
      likes_count?: number | string | null;
      category?: string | null;
      type?: string | null;
      game?: { name?: string | null } | null;
      banner?: string | null;
      cover?: string | null;
      image_url?: string | null;
      images?: Array<{ url?: string | null }> | null;
      details?: {
        banner?: string | null;
        cover?: string | null;
        image?: string | null;
        description?: string | null;
        subtitle?: string | null;
      } | null;
    };

    const loadProducts = async () => {
      try {
        const popularRes = await fetch(`${API_BASE}/products?active=1&display_section=popular&limit=9`);

        const popularData = popularRes.ok ? await popularRes.json().catch(() => null) : null;

        const popularItems = Array.isArray(popularData?.data)
          ? (popularData.data as ApiProduct[])
          : Array.isArray(popularData)
            ? (popularData as ApiProduct[])
            : [];
        if (!active) return;

        const mapToCard = (item: ApiProduct): ProductCard => {
          const priceValue = Number(item?.discount_price ?? item?.price ?? 0);
          const image =
            item?.details?.banner ??
            item?.banner ??
            item?.details?.cover ??
            item?.cover ??
            item?.details?.image ??
            item?.image_url ??
            item?.images?.[0]?.url ??
            "/file.svg";
          const badgeLabel = String(item?.category ?? item?.type ?? "VIP");
          const description =
            item?.details?.description ?? item?.description ?? item?.details?.subtitle ?? item?.game?.name ?? "Produit premium";
          return {
            id: item.id,
            title: item.name,
            subtitle: item.game?.name ?? item.category ?? item.type ?? "Gaming",
            price: `${formatNumber(priceValue)} FCFA`,
            priceValue,
            description,
            type: String(item?.type ?? ""),
            likes: Number(item.likes_count ?? 0),
            badge: badgeLabel.toUpperCase().slice(0, 6),
            image,
          };
        };

        setProducts(popularItems.map(mapToCard));
      } catch {
        if (!active) return;
      }
    };

    loadProducts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadHeadlineStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/stats/home`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Partial<{
          accounts_sold: number;
          recharges_done: number;
          premium_members: number;
          guides_active: number;
        }>;
        if (!active) return;

        setHeadlineStats({
          accountsSold: Number.isFinite(json.accounts_sold as number)
            ? Number(json.accounts_sold)
            : DEFAULT_HOME_HEADLINE_STATS.accountsSold,
          rechargesDone: Number.isFinite(json.recharges_done as number)
            ? Number(json.recharges_done)
            : DEFAULT_HOME_HEADLINE_STATS.rechargesDone,
          premiumMembers: Number.isFinite(json.premium_members as number)
            ? Number(json.premium_members)
            : DEFAULT_HOME_HEADLINE_STATS.premiumMembers,
          guidesActive: Number.isFinite(json.guides_active as number)
            ? Number(json.guides_active)
            : DEFAULT_HOME_HEADLINE_STATS.guidesActive,
        });
      } catch {
        // Keep defaults
      }
    };

    loadHeadlineStats();
    return () => {
      active = false;
    };
  }, []);

  const topProducts = useMemo(() => products, [products]);

  const mobilePopular = useMemo(() => {
    if (topProducts.length <= 4) return topProducts;
    return topProducts.slice(0, 4);
  }, [topProducts]);

  const desktopPopular = useMemo(() => {
    const length = topProducts.length;
    if (length <= 3) return topProducts;
    return Array.from({ length: 3 }).map((_, idx) => topProducts[(desktopStart + idx) % length]);
  }, [topProducts, desktopStart]);

  useEffect(() => {
    if (topProducts.length <= 3) return;
    const interval = setInterval(() => {
      setTransitioning(true);
      setTimeout(() => {
        setDesktopStart((prev) => (prev + 3) % topProducts.length);
      }, 1500);
      setTimeout(() => {
        setTransitioning(false);
      }, 3000);
    }, 3000);
    return () => clearInterval(interval);
  }, [topProducts.length]);

  const addToCart = (product: ProductCard, origin?: HTMLElement | null) => {
    if (typeof window === "undefined") return;
    let nextCart: Array<{ id: number; name: string; description?: string; price: number; priceLabel?: string; quantity: number; type?: string }> = [];
    const stored = localStorage.getItem("bbshop_cart");
    if (stored) {
      try {
        nextCart = JSON.parse(stored);
      } catch {
        nextCart = [];
      }
    }

    const existing = nextCart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity = Number(existing.quantity ?? 0) + 1;
    } else {
      nextCart.push({
        id: product.id,
        name: product.title,
        description: product.description,
        price: product.priceValue,
        priceLabel: product.price,
        type: product.type,
        quantity: 1,
      });
    }

    localStorage.setItem("bbshop_cart", JSON.stringify(nextCart));
    triggerFlight(origin ?? null);
  };

  const handleBuy = (product: ProductCard, origin?: HTMLElement | null) => {
    addToCart(product, origin ?? null);
    router.push("/cart");
  };

  return (
    <main
      className="relative min-h-[100dvh] bg-transparent text-white overflow-x-hidden pb-[calc(80px+env(safe-area-inset-bottom))]"
      style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}
    >
      <ImmersiveBackground
        imageSrc="/badboyshop-home.png"
        overlayClassName="bg-black/55"
        imageStyle={{ objectPosition: "center 22%" }}
      />
      {overlay}

      <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:pt-10">
        <div className="text-center">
          <h1 className="bb-hero-title text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            <span className="neon-text">BADBOY</span>
            <span className="text-white/70">SHOP</span>
          </h1>

          {!authLoading && user ? (
            <p className="mx-auto mt-2 max-w-[520px] text-sm font-semibold text-white/85 sm:text-base">
              Bon retour <span className="text-cyan-200">{user.name}</span>
            </p>
          ) : null}

          <p className="mx-auto mt-3 max-w-[420px] text-base font-semibold leading-6 text-white/85 sm:max-w-2xl sm:text-xl">
            La plateforme gaming d’élite
          </p>

          <p className="mx-auto mt-2 max-w-[560px] text-sm font-semibold text-cyan-200/90 sm:text-base">
            Le gaming sans attente, sans risque, sans stress.
          </p>

          <div className="mx-auto mt-5 max-w-5xl">
            <div className="mx-auto h-px w-40 bg-white/12" />

            <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-fuchsia-400/10 via-cyan-400/8 to-amber-300/10" />

              <div className="relative grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-between sm:gap-0">
                {(
                  [
                    { emoji: "🎮", value: formatNumber(headlineStats.accountsSold), label: "Comptes vendus" },
                    { emoji: "⚡", value: formatNumber(headlineStats.rechargesDone), label: "Recharges effectuées" },
                    { emoji: "👑", value: formatNumber(headlineStats.premiumMembers), label: "Membres premium" },
                    { emoji: "📘", value: formatNumber(headlineStats.guidesActive), label: "Guides actives" },
                  ] as const
                ).map((s, idx, arr) => (
                  <div
                    key={s.label}
                    className={
                      "flex items-center gap-3 rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/10 sm:flex-1 sm:rounded-none sm:bg-transparent sm:px-5 sm:py-1 sm:ring-0 " +
                      (idx < arr.length - 1 ? "sm:border-r sm:border-white/10" : "")
                    }
                  >
                    <span className="text-lg leading-none text-white/90" aria-hidden="true">
                      {s.emoji}
                    </span>
                    <div className="min-w-0 text-left">
                      <div className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
                        {s.value}
                      </div>
                      <div className="truncate text-[11px] font-semibold text-white/70 sm:text-xs">
                        {s.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-6 sm:pt-8">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">
            Produits <span className="text-white/70">les plus populaires</span>
          </h2>
          <Link href="/recharges" className="text-xs text-white/70 hover:text-white">
            Voir tout →
          </Link>
        </div>

        <div className="mt-3">
          {topProducts.length === 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="min-w-[260px] flex-1 rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="h-4 w-16 rounded-full bg-white/10" />
                  <div className="mt-3 h-12 w-12 rounded-xl bg-white/10" />
                  <div className="mt-3 h-3 w-3/4 rounded-full bg-white/10" />
                  <div className="mt-2 h-3 w-1/2 rounded-full bg-white/10" />
                  <div className="mt-4 h-9 w-full rounded-xl bg-white/10" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-soft snap-x snap-mandatory sm:hidden">
                {mobilePopular.map((p, idx) => (
                  <ProductCardUI
                    key={p.id}
                    p={p}
                    onAddToCart={addToCart}
                    onBuy={handleBuy}
                    imageOverrideSrc={getHomePopularSlotImage(idx)}
                  />
                ))}
              </div>
              <div className={`hidden sm:grid sm:grid-cols-3 sm:gap-4 transition-all duration-[3000ms] ${transitioning ? "blur-sm opacity-70" : "blur-0 opacity-100"}`}>
                {desktopPopular.map((p, idx) => (
                  <ProductCardUI
                    key={`desktop-${p.id}`}
                    p={p}
                    onAddToCart={addToCart}
                    onBuy={handleBuy}
                    imageOverrideSrc={getHomePopularSlotImage(idx)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
