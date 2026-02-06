"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Search, SlidersHorizontal } from "lucide-react";
import ProductCard from "@/components/ui/ProductCard";
import { API_BASE } from "@/lib/config";
import { toDisplayImageSrc } from "@/lib/imageProxy";
import { getDeliveryBadgeDisplay } from "@/lib/deliveryDisplay";
import ImmersiveBackground from "@/components/layout/ImmersiveBackground";

type MenuKey = "recharge" | "subscription";

type MenuGame = {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  image?: string | null;
};

type ProductRow = {
  id: number;
  name?: string | null;
  title?: string | null;
  slug?: string | null;
  price?: number | string | null;
  discount_price?: number | string | null;
  type?: string | null;
  likes_count?: number | string | null;
  delivery_estimate_label?: string | null;
  image_url?: string | null;
  banner_url?: string | null;
  cover?: string | null;
  banner?: string | null;
  details?: { image?: string | null; banner?: string | null; cover?: string | null } | null;
  images?: Array<{ url?: string | null; path?: string | null }> | null;
  game?: { name?: string | null; image?: string | null; cover?: string | null } | null;
  category_entity?: { name?: string | null } | null;
  category?: string | null;
  display_section?: string | null;
};

type Paginated<T> = {
  data?: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  next_page_url?: string | null;
  prev_page_url?: string | null;
};

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

const parseGamesPayload = (payload: any): MenuGame[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as MenuGame[];
  if (Array.isArray(payload?.data)) return payload.data as MenuGame[];
  if (Array.isArray(payload?.data?.data)) return payload.data.data as MenuGame[];
  return [];
};

const parsePaginator = <T,>(payload: any): { items: T[]; meta: Paginated<T> | null } => {
  if (!payload) return { items: [], meta: null };

  // Laravel paginator shape: { data: [...], current_page, last_page, ... }
  if (typeof payload === "object" && Array.isArray(payload.data)) {
    const maybePaged = payload as Paginated<T>;
    const hasPaging = typeof maybePaged.current_page === "number" || typeof maybePaged.last_page === "number";
    return {
      items: payload.data as T[],
      meta: hasPaging ? (maybePaged as Paginated<T>) : null,
    };
  }

  // Some endpoints wrap paginator as { data: { data: [...], current_page, ... } }
  if (typeof payload === "object" && payload.data && typeof payload.data === "object" && Array.isArray(payload.data.data)) {
    const inner = payload.data as Paginated<T>;
    const hasPaging = typeof inner.current_page === "number" || typeof inner.last_page === "number";
    return {
      items: payload.data.data as T[],
      meta: hasPaging ? inner : null,
    };
  }

  // Plain arrays
  if (Array.isArray(payload)) {
    return { items: payload as T[], meta: null };
  }

  return { items: [], meta: null };
};

export default function ProductsCatalogPage({
  mode,
  title,
  subtitle,
  shopType,
  gameContext,
  gameSlugParam,
}: {
  mode: "game" | "simple";
  title: string;
  subtitle?: string;
  shopType: "recharge" | "subscription" | "accessory" | "gaming_account";
  gameContext?: MenuKey;
  gameSlugParam?: string;
}) {
  const params = useParams();
  const router = useRouter();

  const gameSlug = useMemo(() => {
    const raw = gameSlugParam ?? (params?.gameSlug as string | undefined);
    return String(raw ?? "").trim();
  }, [gameSlugParam, params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<MenuGame | null>(null);
  const [items, setItems] = useState<ProductRow[]>([]);
  const [meta, setMeta] = useState<Paginated<ProductRow> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const debounceRef = useRef<number | null>(null);

  const canLoadMore = Boolean(meta && (meta.current_page ?? 1) < (meta.last_page ?? 1));

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadGameIfNeeded = async () => {
      if (mode !== "game") {
        setGame(null);
        return;
      }
      if (!gameContext || !gameSlug) {
        setGame(null);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/games?active=1&context=${gameContext}&per_page=200`, {
          headers: { Accept: "application/json" },
        });
        const payload = await res.json().catch(() => null);
        if (!active) return;
        const list = parseGamesPayload(payload);
        const found = list.find((g) => String(g.slug ?? "").toLowerCase() === gameSlug.toLowerCase()) ?? null;
        setGame(found);
      } catch {
        if (!active) return;
        setGame(null);
      }
    };

    loadGameIfNeeded();
    return () => {
      active = false;
    };
  }, [mode, gameContext, gameSlug]);

  const loadPage = async (page: number, append: boolean) => {
    const qs = new URLSearchParams();
    qs.set("active", "1");
    qs.set("per_page", "24");
    qs.set("page", String(page));
    qs.set("shop_type", shopType);
    if (mode === "game" && gameSlug) {
      qs.set("game_slug", gameSlug);
    }
    if (query.trim()) {
      qs.set("q", query.trim());
    }
    if (sort === "popular") {
      qs.set("sort", "popular");
    }

    const res = await fetch(`${API_BASE}/products?${qs.toString()}`, { headers: { Accept: "application/json" } });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(payload?.message ?? "Impossible de charger les produits");
    }
    const parsed = parsePaginator<ProductRow>(payload);
    setMeta(parsed.meta);
    setItems((prev) => (append ? [...prev, ...parsed.items] : parsed.items));
  };

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadPage(1, false);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger");
      setItems([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      void reload();
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gameSlug, shopType, sort, query]);

  const loadMore = async () => {
    if (!meta) return;
    const nextPage = (meta.current_page ?? 1) + 1;
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      await loadPage(nextPage, true);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger la suite");
    } finally {
      setLoadingMore(false);
    }
  };

  const breadcrumb = useMemo(() => {
    const root = [{ label: "Accueil", href: "/" }];
    if (mode === "simple") {
      return [...root, { label: title, href: "#" }];
    }

    const baseHref = shopType === "recharge" ? "/recharges" : shopType === "subscription" ? "/abonnements" : "/catalogue";
    const label = title;
    const leaf = game?.name ? game.name : gameSlug ? gameSlug : "Jeu";
    return [...root, { label, href: baseHref }, { label: leaf, href: "#" }];
  }, [mode, title, shopType, game?.name, gameSlug]);

  const headerTitle = mode === "game" ? `${title}${game?.name ? ` • ${game.name}` : gameSlug ? ` • ${gameSlug}` : ""}` : title;

  const skeletonCards = Array.from({ length: 9 }).map((_, idx) => (
    <div key={idx} className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="h-40 rounded-2xl bg-white/10" />
      <div className="mt-4 h-4 w-2/3 rounded bg-white/10" />
      <div className="mt-2 h-3 w-5/6 rounded bg-white/10" />
      <div className="mt-6 h-10 w-full rounded-xl bg-white/10" />
    </div>
  ));

  return (
    <main className="min-h-[100dvh] bg-transparent text-white">
      <ImmersiveBackground imageSrc="/images/WhatsApp%20Image%202026-02-06%20at%2003.44.47.jpeg" overlayClassName="bg-black/55" />
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
              {breadcrumb.map((b, idx) => (
                <span key={`${b.label}-${idx}`} className="inline-flex items-center gap-2">
                  {b.href !== "#" ? (
                    <Link href={b.href} className="hover:text-white">
                      {b.label}
                    </Link>
                  ) : (
                    <span className="text-white/80">{b.label}</span>
                  )}
                  {idx < breadcrumb.length - 1 ? <span className="text-white/30">/</span> : null}
                </span>
              ))}
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{headerTitle}</h1>
            {subtitle ? <p className="text-sm text-white/60">{subtitle}</p> : null}
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="hidden sm:inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-black/40 p-4 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-10 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-cyan-300/40"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                <SlidersHorizontal className="h-4 w-4" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                  className="bg-transparent text-sm text-white/80 outline-none"
                >
                  <option value="recent">Plus récents</option>
                  <option value="popular">Populaires</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {mode === "game" && !loading && gameSlug && !game ? (
          <div className="mt-10 rounded-[28px] border border-white/10 bg-white/5 p-10 text-center text-white/70">
            Jeu introuvable.
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                skeletonCards
              ) : items.length ? (
                items.map((p) => {
                  const priceValue = Number(p.discount_price ?? p.price ?? 0);
                  const safePrice = Number.isFinite(priceValue) ? Math.max(0, Math.round(priceValue)) : 0;
                  const likesValue = Number(p.likes_count ?? 0);
                  const likes = Number.isFinite(likesValue) ? likesValue : 0;

                  const displayTitle = String(p.name ?? p.title ?? "Produit").trim() || "Produit";
                  const displaySubtitle =
                    String(p.category_entity?.name ?? p.category ?? p.game?.name ?? "").trim() || undefined;

                  const img =
                    p.image_url ??
                    p?.images?.[0]?.url ??
                    p?.images?.[0]?.path ??
                    p?.details?.image ??
                    p.cover ??
                    p.banner ??
                    p?.details?.cover ??
                    p?.details?.banner ??
                    p.banner_url ??
                    p?.game?.image ??
                    p?.game?.cover ??
                    null;

                  const imageSrc = img ? (toDisplayImageSrc(img) ?? img) : null;
                  const delivery = getDeliveryBadgeDisplay({
                    type: p.type ?? null,
                    display_section: p.display_section ?? null,
                    delivery_estimate_label: p.delivery_estimate_label ?? null,
                  });

                  const basePrice = Number(p.price ?? 0);
                  const discountPrice = Number(p.discount_price ?? NaN);
                  const isPromo = Number.isFinite(basePrice) && Number.isFinite(discountPrice) && discountPrice > 0 && discountPrice < basePrice;
                  const isTop = String(p.display_section ?? "").toLowerCase() === "popular" || likes >= 1000;
                  const isInstant = delivery?.tone === "bolt";

                  return (
                    <div key={p.id} className="min-w-0">
                      <ProductCard
                        title={displayTitle}
                        subtitle={displaySubtitle}
                        price={`${formatNumber(safePrice)} FCFA`}
                        likes={likes}
                        delivery={delivery}
                        onAction={() => router.push(`/produits/${p.id}`)}
                        onDoubleClick={() => router.push(`/produits/${p.id}`)}
                        imageSlot={
                          imageSrc ? (
                            <div className="relative h-full w-full overflow-hidden">
                              <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
                                {isInstant ? (
                                  <span className="rounded-full border border-amber-200/20 bg-amber-400/10 px-2 py-1 text-[11px] font-semibold text-amber-100 backdrop-blur">
                                    Instantané
                                  </span>
                                ) : null}
                                {isPromo ? (
                                  <span className="rounded-full border border-amber-200/20 bg-amber-400/10 px-2 py-1 text-[11px] font-semibold text-amber-100 backdrop-blur">
                                    Promo
                                  </span>
                                ) : null}
                                {isTop ? (
                                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-100 backdrop-blur">
                                    Top
                                  </span>
                                ) : null}
                              </div>

                              <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.04] motion-reduce:transform-none">
                                <Image
                                  src={imageSrc}
                                  alt={displayTitle}
                                  fill
                                  className="object-cover"
                                  sizes="(min-width: 1024px) 360px, 90vw"
                                />
                              </div>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
                            </div>
                          ) : undefined
                        }
                      />
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full rounded-[28px] border border-white/10 bg-white/5 p-10 text-center text-white/70">
                  Aucun produit pour le moment.
                </div>
              )}
            </div>

            {!loading && canLoadMore ? (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-60"
                >
                  {loadingMore ? "Chargement..." : "Charger plus"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
