"use client";

import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Orbitron, Space_Grotesk } from "next/font/google";
import {
  Bell,
  Camera,
  Crown,
  Heart,
  Search,
  Settings2,
  ShoppingCart,
  Sparkles,
  Tag,
} from "lucide-react";
import GlowButton from "@/components/ui/GlowButton";
import { API_BASE } from "@/lib/config";
import { useCartFlight } from "@/hooks/useCartFlight";
import { toDisplayImageSrc } from "@/lib/imageProxy";

type ShopProduct = {
  id: number;
  name: string;
  description: string;
  priceLabel: string;
  priceValue: number;
  oldPrice?: number;
  discountPercent?: number;
  likes: number;
  category: string;
  categorySlug?: string | null;
  type: string;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  displaySection?: string | null;
  deliveryEtaDays?: number | null;
  estimatedDeliveryLabel?: string | null;
  deliveryEstimateLabel?: string | null;
};

type CategoryOption = {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  productsCount: number;
};


const HERO_BACKDROP =
  "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=2000&q=80";
const HERO_TROPHY =
  "https://img.freepik.com/premium-photo/virtual-shopping-cart-filled-with-gaming-merchandise_1247965-24719.jpg";
const COSMIC_OVERLAY =
  "bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.4),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.35),transparent_40%)]";
const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1605902711622-cfb43c4437b5?auto=format&fit=crop&w=600&q=80";

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type SortOption = "popular" | "recent" | "priceAsc" | "priceDesc";

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Populaire", value: "popular" },
  { label: "Récent", value: "recent" },
  { label: "Prix croissant", value: "priceAsc" },
  { label: "Prix décroissant", value: "priceDesc" },
];

type PriceFilterKey = "all" | "low" | "mid" | "high";

const PRICE_FILTERS: { label: string; value: PriceFilterKey; min?: number; max?: number }[] = [
  { label: "1k - 5k FCFA", value: "low", min: 0, max: 5000 },
  { label: "5k - 15k FCFA", value: "mid", min: 5000, max: 15000 },
  { label: "15k+ FCFA", value: "high", min: 15000 },
];

const slugifyCategory = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

const DEFAULT_SHOP_FILTERS = {
  query: "",
  category: "all",
  price: "all" as PriceFilterKey,
  promo: false,
  sort: "popular" as SortOption,
};

const isSortOption = (value: string | null): value is SortOption =>
  value === "popular" || value === "recent" || value === "priceAsc" || value === "priceDesc";

const isPriceFilterKey = (value: string | null): value is PriceFilterKey =>
  value === "all" || value === "low" || value === "mid" || value === "high";

const parseShopFiltersFromSearch = (search: string) => {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const query = (params.get("q") ?? "").slice(0, 120);
  const category = (params.get("cat") ?? "all").slice(0, 80) || "all";
  const priceRaw = params.get("price");
  const sortRaw = params.get("sort");
  const promoRaw = params.get("promo");

  return {
    query,
    category,
    price: isPriceFilterKey(priceRaw) ? priceRaw : DEFAULT_SHOP_FILTERS.price,
    sort: isSortOption(sortRaw) ? sortRaw : DEFAULT_SHOP_FILTERS.sort,
    promo: promoRaw === "1" || promoRaw === "true",
  };
};

const buildShopSearchFromFilters = (filters: {
  query: string;
  category: string;
  price: PriceFilterKey;
  promo: boolean;
  sort: SortOption;
}) => {
  const params = new URLSearchParams();

  const query = filters.query.trim();
  if (query) params.set("q", query);
  if (filters.category && filters.category !== "all") params.set("cat", filters.category);
  if (filters.price !== "all") params.set("price", filters.price);
  if (filters.promo) params.set("promo", "1");
  if (filters.sort !== "popular") params.set("sort", filters.sort);

  return params.toString();
};

import DeliveryBadge from "@/components/ui/DeliveryBadge";
import { getDeliveryBadgeDisplay } from "@/lib/deliveryDisplay";
import { openTidioChat } from "@/lib/tidioChat";

function MobileFiltersSheet({
  open,
  categories,
  pending,
  onPendingChange,
  onReset,
  onApply,
  onClose,
}: {
  open: boolean;
  categories: CategoryOption[];
  pending: { category: string; price: PriceFilterKey; promo: boolean; sort: SortOption };
  onPendingChange: (next: { category: string; price: PriceFilterKey; promo: boolean; sort: SortOption }) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const chips = [{ slug: "all", name: "Tous" }, ...categories.map((opt) => ({ slug: opt.slug, name: opt.name }))];
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Fermer les filtres"
      />

      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto w-full max-w-xl">
          <div className="rounded-t-[32px] border border-white/10 bg-[#070013]/95 px-5 pb-6 pt-4 shadow-[0_-30px_90px_rgba(0,0,0,0.7)]">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/15" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">Filtrer</p>
                <h3 className="text-lg font-bold text-white">Affiner la boutique</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50 hover:text-white"
              >
                Fermer
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Catégories</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {chips.map((chip) => {
                    const active = pending.category === chip.slug;
                    return (
                      <button
                        key={chip.slug}
                        type="button"
                        onClick={() => onPendingChange({ ...pending, category: chip.slug })}
                        className={`rounded-2xl border px-4 py-2 text-sm transition ${
                          active
                            ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-100"
                            : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                        }`}
                      >
                        {chip.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Budget</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onPendingChange({ ...pending, price: "all" })}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                      pending.price === "all"
                        ? "border-cyan-300/60 bg-cyan-500/20 text-white"
                        : "border-white/10 bg-white/5 text-white/60"
                    }`}
                  >
                    Tous budgets
                  </button>
                  {PRICE_FILTERS.map((band) => {
                    const active = pending.price === band.value;
                    return (
                      <button
                        key={band.value}
                        type="button"
                        onClick={() => onPendingChange({ ...pending, price: band.value })}
                        className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                          active
                            ? "border-fuchsia-300/60 bg-fuchsia-500/20 text-white"
                            : "border-white/10 bg-white/5 text-white/60"
                        }`}
                      >
                        {band.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Trier
                  <select
                    value={pending.sort}
                    onChange={(e) => onPendingChange({ ...pending, sort: e.target.value as SortOption })}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white focus:outline-none"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Promo
                  <button
                    type="button"
                    onClick={() => onPendingChange({ ...pending, promo: !pending.promo })}
                    className={`mt-2 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      pending.promo
                        ? "border-emerald-300/60 bg-emerald-400/20 text-white"
                        : "border-white/10 bg-white/5 text-white/70"
                    }`}
                  >
                    <span>En promo</span>
                    <span
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
                        pending.promo ? "bg-emerald-400/80" : "bg-white/20"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          pending.promo ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onReset}
                className="rounded-2xl border border-white/15 bg-transparent py-3 text-sm font-semibold text-white"
              >
                Réinitialiser
              </button>
              <GlowButton onClick={onApply}>Appliquer</GlowButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StripCard({
  product,
  label,
  icon: Icon = Tag,
}: {
  product: ShopProduct;
  label: string;
  icon?: typeof Tag;
}) {
  const cardImage = product.bannerUrl ?? product.imageUrl ?? FALLBACK_PRODUCT_IMAGE;
  const delivery = getDeliveryBadgeDisplay({
    type: product.type,
    displaySection: product.displaySection ?? null,
    deliveryEstimateLabel: product.deliveryEstimateLabel ?? null,
  });
  return (
    <div className="relative flex min-w-[180px] flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between text-xs font-medium text-white/70">
        <span className="flex items-center gap-1">
          <Icon className="h-3.5 w-3.5 text-amber-300" />
          {label}
        </span>
        {product.discountPercent && (
          <span className="rounded-full bg-amber-400/20 px-2 py-1 text-[10px] text-amber-200">
            -{product.discountPercent}%
          </span>
        )}
      </div>
      <div className="h-24 w-full overflow-hidden rounded-xl bg-white/10">
        <img
          src={toDisplayImageSrc(cardImage) ?? cardImage}
          alt={product.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="text-sm font-semibold text-white line-clamp-2">{product.name}</div>
      <div className="text-xs text-white/60 line-clamp-2">{product.description}</div>
      <div className="mt-auto text-sm font-bold text-cyan-200">{product.priceLabel}</div>
      {product.oldPrice && (
        <div className="text-[11px] text-white/40 line-through">{formatNumber(product.oldPrice)} FCFA</div>
      )}
      {delivery ? (
        <div className="mt-2 flex justify-end">
          <DeliveryBadge delivery={delivery} />
        </div>
      ) : null}
    </div>
  );
}

function ShopHero() {
  return (
    <div className={`${orbitron.className} flex flex-col items-center text-center`}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-cyan-200 shadow-[0_12px_40px_rgba(99,102,241,0.4)]">
        <Crown className="h-7 w-7" />
      </div>
      <p className="mt-6 text-xs uppercase tracking-[0.45em] text-cyan-200/80">BADBOYSHOP</p>
      <h1 className="mt-4 text-5xl font-black uppercase tracking-[0.08em] text-white">Boutique BADBOYSHOP</h1>
      <p className="mt-3 max-w-2xl text-base text-white/80">
        Recharge, abonnements et articles gaming au meilleur prix.
      </p>
      <div className="mt-8 h-px w-32 bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400" />
      <p className="mt-4 text-sm uppercase tracking-[0.4em] text-white/60">Sélection premium</p>
    </div>
  );
}

type ShopFiltersProps = {
  query: string;
  onQueryChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: CategoryOption[];
  sortOrder: SortOption;
  onSortChange: (value: SortOption) => void;
  promoOnly: boolean;
  onPromoToggle: () => void;
  priceFilter: PriceFilterKey;
  onPriceChange: (value: PriceFilterKey) => void;
};

function ShopFilters({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  categories,
  sortOrder,
  onSortChange,
  promoOnly,
  onPromoToggle,
  priceFilter,
  onPriceChange,
}: ShopFiltersProps) {
  return (
    <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <label className="text-left text-xs uppercase tracking-[0.3em] text-white/50">
          Recherche
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/15 bg-black/40 px-4 py-3">
            <Search className="h-4 w-4 text-white/60" />
            <input
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Nom du jeu, article, pack..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-xs uppercase tracking-[0.3em] text-white/50">
            Catégorie
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white focus:outline-none"
            >
              <option value="all">Toutes les catégories</option>
              {categories.map((opt) => (
                <option key={opt.slug} value={opt.slug}>
                  {opt.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.3em] text-white/50">
            Trier
            <select
              value={sortOrder}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="mt-2 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white focus:outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          onClick={onPromoToggle}
          className={`flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold transition ${
            promoOnly ? "border-emerald-300/60 bg-emerald-400/20 text-white" : "border-white/10 bg-white/5 text-white/70"
          }`}
        >
          <span>En promo</span>
          <span
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition ${
              promoOnly ? "bg-emerald-400/80" : "bg-white/20"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${promoOnly ? "translate-x-5" : "translate-x-1"}`}
            />
          </span>
        </button>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onPriceChange("all")}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
              priceFilter === "all"
                ? "border-cyan-300/60 bg-cyan-500/20 text-white"
                : "border-white/10 bg-white/5 text-white/60"
            }`}
          >
            Tous budgets
          </button>
          {PRICE_FILTERS.map((band) => {
            const active = priceFilter === band.value;
            return (
              <button
                key={band.value}
                onClick={() => onPriceChange(band.value)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                  active ? "border-fuchsia-300/60 bg-fuchsia-500/20 text-white" : "border-white/10 bg-white/5 text-white/60"
                }`}
              >
                {band.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type ProductGridProps = {
  title: string;
  subtitle?: string;
  products: ShopProduct[];
  onAddToCart: (product: ShopProduct, origin?: HTMLElement | null) => void;
  onView: (product: ShopProduct) => void;
  onLike: (product: ShopProduct) => void;
};

function ProductGrid({ title, subtitle, products, onAddToCart, onView, onLike }: ProductGridProps) {
  return (
    <div className="space-y-4 rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.1),_rgba(10,3,28,0.95))] p-6 shadow-[0_25px_80px_rgba(4,6,35,0.6)]">
      <div className="flex flex-col gap-1">
        <h3 className="text-2xl font-bold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-white/70">{subtitle}</p>}
      </div>
      <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-soft">
        {products.map((product) => (
          <div key={product.id} className="min-w-[320px] max-w-[320px] shrink-0">
            <ProductCard product={product} onAddToCart={onAddToCart} onView={onView} onLike={onLike} />
          </div>
        ))}
        {!products.length && (
          <div className="min-w-full rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white/60">
            Aucun produit pour le moment.
          </div>
        )}
      </div>
    </div>
  );
}

function ResultsGrid({
  products,
  onAddToCart,
  onView,
  onLike,
  onReset,
}: {
  products: ShopProduct[];
  onAddToCart: (product: ShopProduct, origin?: HTMLElement | null) => void;
  onView: (product: ShopProduct) => void;
  onLike: (product: ShopProduct) => void;
  onReset: () => void;
}) {
  const countLabel = `${products.length} article${products.length > 1 ? "s" : ""}`;
  return (
    <div className="space-y-5 rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-white">Résultats</h3>
          <p className="mt-1 text-sm text-white/60">{countLabel}</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 hover:text-white"
        >
          Réinitialiser
        </button>
      </div>

      {!products.length ? (
        <div className="rounded-3xl border border-white/10 bg-black/30 p-10 text-center text-white/70">
          Aucun produit ne correspond à vos filtres.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
              onView={onView}
              onLike={onLike}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ProductCardProps = {
  product: ShopProduct;
  onAddToCart: (product: ShopProduct, origin?: HTMLElement | null) => void;
  onView: (product: ShopProduct) => void;
  onLike: (product: ShopProduct) => void;
};

function ProductCard({ product, onAddToCart, onView, onLike }: ProductCardProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [likePulse, setLikePulse] = useState(false);
  const isRechargeDirect = (product.displaySection ?? "").toLowerCase() === "recharge_direct";
  const badgeLabel = product.discountPercent
    ? `-${product.discountPercent}%`
    : product.likes > 30
      ? "Populaire"
      : product.category;

  const delivery = getDeliveryBadgeDisplay({
    type: product.type,
    displaySection: product.displaySection ?? null,
    deliveryEstimateLabel: product.deliveryEstimateLabel ?? null,
  });

  const handleAdd = (event: MouseEvent<HTMLButtonElement>) => {
    if (isRechargeDirect) {
      void openTidioChat({
        message: `Bonjour, je veux une Recharge Direct : ${product.name} (ID: ${product.id}).`,
      });
      return;
    }
    setAdding(true);
    window.setTimeout(() => setAdding(false), 520);
    onAddToCart(product, event.currentTarget);
  };

  const handleLike = () => {
    setLikePulse(true);
    window.setTimeout(() => setLikePulse(false), 520);
    onLike(product);
  };

  return (
    <div className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-5 shadow-[0_25px_80px_rgba(4,6,35,0.6)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/40 hover:shadow-[0_35px_90px_rgba(14,165,233,0.35)]">
      <div className="relative h-40 w-full overflow-hidden rounded-2xl">
        <img
          src={toDisplayImageSrc(product.imageUrl ?? FALLBACK_PRODUCT_IMAGE) ?? (product.imageUrl ?? FALLBACK_PRODUCT_IMAGE)}
          alt={product.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
        <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
          {badgeLabel}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium text-white/60">{product.category}</p>
        <h4 className="text-lg font-semibold leading-tight text-white line-clamp-2">{product.name}</h4>
        <p className="text-sm text-white/70 line-clamp-2">{product.description}</p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-xl font-black text-cyan-200">{product.priceLabel}</p>
          {product.oldPrice && (
            <p className="text-xs text-white/40 line-through">{formatNumber(product.oldPrice)} FCFA</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleLike}
          className="relative flex items-center gap-1 text-xs text-white/60 hover:text-rose-200"
        >
          <span
            className={`absolute -inset-2 rounded-full bg-rose-400/20 transition ${likePulse ? "opacity-100" : "opacity-0"}`}
          />
          <Heart className={`h-4 w-4 text-rose-300 transition ${likePulse ? "scale-110" : "scale-100"}`} />
          {product.likes}
        </button>
      </div>

      {delivery ? (
        <div className="mt-2 flex justify-end">
          <DeliveryBadge delivery={delivery} />
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        <button
          onClick={handleAdd}
          className={`relative w-full overflow-hidden rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-5 py-3 text-sm font-semibold text-black shadow-[0_20px_60px_rgba(14,165,233,0.4)] transition hover:brightness-110 active:scale-[0.98] ${
            adding ? "brightness-110" : ""
          }`}
        >
          <span
            className={`pointer-events-none absolute inset-0 bg-white/10 transition ${adding ? "opacity-100" : "opacity-0"}`}
          />
          <span
            className={`pointer-events-none absolute -inset-6 rounded-full bg-white/15 blur-2xl transition ${
              adding ? "opacity-100" : "opacity-0"
            }`}
          />
          {isRechargeDirect ? "Ouvrir le chat" : "Ajouter au panier"}
        </button>
        <button
          onClick={() => onView(product)}
          className="w-full rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-medium text-white/80 hover:text-white"
        >
          Voir plus
        </button>
      </div>
    </div>
  );
}

export default function ShopPage() {
  const router = useRouter();
  const { triggerFlight, overlay } = useCartFlight();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilterKey>("all");
  const [sortOrder, setSortOrder] = useState<SortOption>("popular");
  const [promoOnly, setPromoOnly] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<{ category: string; price: PriceFilterKey; promo: boolean; sort: SortOption }>({
    category: "all",
    price: "all",
    promo: false,
    sort: "popular",
  });
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const filtersSectionRef = useRef<HTMLDivElement | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncUrlTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inferTypeFromCategory = (categoryName?: string | null, displaySection?: string | null) => {
    const name = String(categoryName ?? "").toLowerCase();
    const section = String(displaySection ?? "").toLowerCase();

    if (section === "emote_skin") return "skin";
    if (name.includes("recharge") || name.includes("topup") || name.includes("diamant")) return "recharge";
    if (name.includes("compte") || name.includes("account")) return "account";
    if (name.includes("abonnement") || name.includes("subscription") || name.includes("vip")) return "subscription";
    if (name.includes("emote") || name.includes("skin")) return "skin";
    if (name.includes("accessoire") || name.includes("accessory")) return "item";
    return "";
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyFromLocation = () => {
      const parsed = parseShopFiltersFromSearch(window.location.search);
      setQuery(parsed.query);
      setCategoryFilter(parsed.category);
      setPriceFilter(parsed.price);
      setPromoOnly(parsed.promo);
      setSortOrder(parsed.sort);
    };

    applyFromLocation();
    window.addEventListener("popstate", applyFromLocation);
    return () => window.removeEventListener("popstate", applyFromLocation);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (syncUrlTimeoutRef.current) {
      clearTimeout(syncUrlTimeoutRef.current);
    }

    syncUrlTimeoutRef.current = setTimeout(() => {
      const nextQuery = buildShopSearchFromFilters({
        query,
        category: categoryFilter,
        price: priceFilter,
        promo: promoOnly,
        sort: sortOrder,
      });
      const nextHref = nextQuery ? `/shop?${nextQuery}` : "/shop";
      const currentHref = `${window.location.pathname}${window.location.search}`;
      if (currentHref !== nextHref) {
        router.replace(nextHref, { scroll: false });
      }
    }, 250);

    return () => {
      if (syncUrlTimeoutRef.current) {
        clearTimeout(syncUrlTimeoutRef.current);
      }
    };
  }, [router, query, categoryFilter, priceFilter, promoOnly, sortOrder]);
  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      try {
        const res = await fetch(`${API_BASE}/products?active=1`);
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        if (!active) return;
          const mapped = items.map((item: any) => {
          const priceValue = Number(item?.discount_price ?? item?.price ?? 0);
          const baseOld = Number(item?.old_price ?? item?.price ?? priceValue);
          const oldPrice = baseOld > priceValue ? baseOld : Math.round(priceValue * 1.18);
          const discountPercent = oldPrice > priceValue ? Math.round(((oldPrice - priceValue) / oldPrice) * 100) : 0;
          const rawType = String(item?.type ?? "").toLowerCase();
          const fallbackCategory = rawType.includes("recharge") || rawType.includes("topup")
            ? "Recharges"
            : rawType.includes("account")
              ? "Comptes"
              : rawType.includes("subscription") || rawType.includes("premium")
                ? "Offres"
                : "Accessoires";
          const categoryName = item?.category ?? item?.category_entity?.name ?? fallbackCategory;
          const categorySlug = item?.category_entity?.slug ?? (categoryName ? slugifyCategory(categoryName) : null);
          const inferredType = rawType || inferTypeFromCategory(categoryName, item?.display_section ?? null);
          const imageUrl =
            item?.details?.image ??
            item?.image_url ??
            item?.media?.[0]?.url ??
            item?.images?.[0]?.url ??
            item?.images?.[0]?.path ??
            item?.game?.cover ??
            null;

          const bannerUrl =
            item?.details?.banner ??
            item?.banner ??
            item?.details?.cover ??
            item?.cover ??
            null;

          const etaRaw = item?.delivery_eta_days;
          const eta = etaRaw === null || etaRaw === undefined ? null : Number(etaRaw);
          return {
            id: item.id,
            name: item.name,
            description: item?.details?.description ?? item?.details?.subtitle ?? item?.game?.name ?? "Produit premium",
            priceLabel: `${formatNumber(priceValue)} FCFA`,
            priceValue,
            oldPrice,
            discountPercent,
            likes: Number(item?.likes_count ?? 0),
            category: categoryName,
            categorySlug,
            type: inferredType,
            imageUrl: imageUrl ?? FALLBACK_PRODUCT_IMAGE,
            bannerUrl: bannerUrl,
            displaySection: item?.display_section ?? null,
            deliveryEtaDays: Number.isFinite(eta) ? eta : null,
            estimatedDeliveryLabel: item?.estimated_delivery_label ?? null,
            deliveryEstimateLabel: item?.delivery_estimate_label ?? null,
          } as ShopProduct;
        });
        setProducts(mapped);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProducts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadCategories = async () => {
      try {
        const res = await fetch(`${API_BASE}/categories`);
        if (!res.ok) return;
        const payload = await res.json();
        const list = Array.isArray(payload?.data) ? payload.data : [];
        if (!active) return;
        setCategoryOptions(
          list.map((item: any) => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            icon: item.icon ?? null,
            productsCount: Number(item?.products_count ?? 0),
          }))
        );
      } catch {
        if (!active) return;
      }
    };

    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      if (syncUrlTimeoutRef.current) {
        clearTimeout(syncUrlTimeoutRef.current);
      }
    };
  }, []);

  const catalog = products;

  const handleAddToCart = (product: ShopProduct, origin?: HTMLElement | null) => {
    if (typeof window === "undefined") return;
    let nextCart: Array<{
      id: number;
      name: string;
      description?: string;
      price: number;
      priceLabel?: string;
      quantity: number;
      type?: string;
      displaySection?: string | null;
      deliveryEstimateLabel?: string | null;
      deliveryLabel?: string;
    }> = [];
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
      const delivery = getDeliveryBadgeDisplay({
        type: product.type,
        displaySection: product.displaySection ?? null,
        deliveryEstimateLabel: product.deliveryEstimateLabel ?? null,
      });
      nextCart.push({
        id: product.id,
        name: product.name,
        description: product.description ?? "",
        price: product.priceValue,
        priceLabel: product.priceLabel,
        type: product.type,
        displaySection: product.displaySection ?? null,
        deliveryEstimateLabel: product.deliveryEstimateLabel ?? null,
        deliveryLabel: delivery?.desktopLabel ?? undefined,
        quantity: 1,
      });
    }

    localStorage.setItem("bbshop_cart", JSON.stringify(nextCart));
    triggerFlight(origin ?? null);
    setStatusMessage(`${product.name} ajouté au panier`);
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = setTimeout(() => setStatusMessage(null), 2200);
  };

  const handleViewProduct = (product: ShopProduct) => {
    router.push(`/produits/${product.id}`);
  };

  const handleToggleLike = async (product: ShopProduct) => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("bbshop_token");
    if (!token) {
      setStatusMessage("Connectez-vous pour liker un article");
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      statusTimeoutRef.current = setTimeout(() => setStatusMessage(null), 2200);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/likes/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ product_id: product.id }),
      });

      if (!res.ok) {
        setStatusMessage("Impossible de liker cet article");
        return;
      }

      const payload = await res.json();
      const nextCount = Number(payload?.likes_count ?? product.likes);
      setProducts((prev) =>
        prev.map((item) => (item.id === product.id ? { ...item, likes: nextCount } : item))
      );
      setStatusMessage(payload?.liked ? "Ajouté aux likes" : "Like retiré");
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      statusTimeoutRef.current = setTimeout(() => setStatusMessage(null), 2200);
    } catch {
      setStatusMessage("Impossible de liker cet article");
    }
  };

  const derivedCategories = useMemo(() => {
    const registry = new Map<string, CategoryOption>();
    catalog.forEach((product) => {
      const label = product.category || "Autres";
      const slug = product.categorySlug ?? (label ? slugifyCategory(label) : "");
      if (!slug || registry.has(slug)) return;
      registry.set(slug, {
        id: product.id,
        name: label,
        slug,
        icon: null,
        productsCount: 0,
      });
    });
    return Array.from(registry.values());
  }, [catalog]);

  const categoryChipOptions = useMemo(
    () => (categoryOptions.length ? categoryOptions : derivedCategories),
    [categoryOptions, derivedCategories]
  );

  const openFilterSheet = () => {
    setPendingFilters({
      category: categoryFilter,
      price: priceFilter,
      promo: promoOnly,
      sort: sortOrder,
    });
    setFilterSheetOpen(true);
  };

  const applyFilterSheet = () => {
    setCategoryFilter(pendingFilters.category);
    setPriceFilter(pendingFilters.price);
    setPromoOnly(pendingFilters.promo);
    setSortOrder(pendingFilters.sort);
    setFilterSheetOpen(false);
  };

  const resetFilterSheet = () => {
    setPendingFilters({ category: "all", price: "all", promo: false, sort: "popular" });
  };

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const selectedPrice = PRICE_FILTERS.find((opt) => opt.value === priceFilter);
    let result = catalog.filter((product) => {
      const matchesQuery = normalizedQuery
        ? product.name.toLowerCase().includes(normalizedQuery) ||
          (product.category ?? "").toLowerCase().includes(normalizedQuery) ||
          (product.description ?? "").toLowerCase().includes(normalizedQuery)
        : true;
      const filterSlug = categoryFilter;
      const productSlug = product.categorySlug ?? slugifyCategory(product.category ?? "");
      const matchesCategory =
        filterSlug === "all" ||
        productSlug === filterSlug ||
        product.category?.toLowerCase() === filterSlug;
      const matchesPrice = (() => {
        if (!selectedPrice || priceFilter === "all") return true;
        const min = selectedPrice.min ?? 0;
        const max = selectedPrice.max ?? Number.POSITIVE_INFINITY;
        return product.priceValue >= min && product.priceValue <= max;
      })();
      const matchesPromo = promoOnly ? Number(product.discountPercent ?? 0) > 0 : true;
      return matchesQuery && matchesCategory && matchesPrice && matchesPromo;
    });

    if (sortOrder === "popular") {
      result = [...result].sort((a, b) => b.likes - a.likes);
    } else if (sortOrder === "recent") {
      result = [...result].sort((a, b) => b.id - a.id);
    } else if (sortOrder === "priceAsc") {
      result = [...result].sort((a, b) => a.priceValue - b.priceValue);
    } else if (sortOrder === "priceDesc") {
      result = [...result].sort((a, b) => b.priceValue - a.priceValue);
    }

    return result;
  }, [catalog, query, categoryFilter, priceFilter, promoOnly, sortOrder]);

  const hasActiveFilters =
    query.trim() !== "" ||
    categoryFilter !== DEFAULT_SHOP_FILTERS.category ||
    priceFilter !== DEFAULT_SHOP_FILTERS.price ||
    promoOnly !== DEFAULT_SHOP_FILTERS.promo ||
    sortOrder !== DEFAULT_SHOP_FILTERS.sort;

  const resetAllFilters = () => {
    setQuery("");
    setCategoryFilter("all");
    setPriceFilter("all");
    setPromoOnly(false);
    setSortOrder("popular");
    setPendingFilters({ category: "all", price: "all", promo: false, sort: "popular" });
  };

  const popularProducts = useMemo(() => filtered.filter((p) => p.displaySection === "popular").slice(0, 4), [filtered]);
  const rechargeDirectProducts = useMemo(
    () => filtered.filter((p) => p.displaySection === "recharge_direct").slice(0, 6),
    [filtered]
  );
  const emoteSkinProducts = useMemo(
    () => filtered.filter((p) => p.displaySection === "emote_skin").slice(0, 6),
    [filtered]
  );
  const promoProducts = useMemo(() => filtered.filter((p) => p.displaySection === "cosmic_promo").slice(0, 6), [filtered]);
  const latestProducts = useMemo(() => filtered.filter((p) => p.displaySection === "latest").slice(0, 6), [filtered]);
  const gamingAccountProducts = useMemo(
    () => filtered.filter((p) => p.displaySection === "gaming_accounts").slice(0, 6),
    [filtered]
  );

  const handleImageSearch = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  return (
    <main className="min-h-[100dvh] bg-[#04020c] text-white bg-[radial-gradient(circle_at_top,_#1b0d3f,_#04020c_70%)]">
      {overlay}
      {statusMessage && (
        <div className="fixed right-4 top-[86px] z-50 mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/80 px-4 py-2 text-sm font-semibold text-white shadow-[0_15px_40px_rgba(0,0,0,0.55)] backdrop-blur sm:top-[94px]">
          <ShoppingCart className="h-4 w-4 text-cyan-300" />
          <span className="max-w-[220px] truncate">{statusMessage}</span>
        </div>
      )}
      <section className={`${orbitron.className} hidden lg:block`}>
        <div className="mx-auto w-full max-w-6xl px-6 py-12">
          <div className="space-y-12">
            <div className="relative overflow-hidden rounded-[46px] border border-white/10 bg-[#090014] p-[1px] shadow-[0_35px_140px_rgba(4,6,35,0.65)]">
              <div className="relative overflow-hidden rounded-[44px] bg-gradient-to-br from-[#05000b] via-[#070014] to-[#04020c]">
                <div className="absolute inset-0">
                  <Image
                    src={HERO_BACKDROP}
                    alt="Fond cosmique"
                    fill
                    className="object-cover opacity-40"
                    sizes="(min-width: 1024px) 1200px, 100vw"
                    priority
                  />
                  <div className={`absolute inset-0 ${COSMIC_OVERLAY}`} />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-[#07001b]/70 to-transparent" />
                </div>
                <div className="relative grid items-center gap-12 px-12 py-16 lg:grid-cols-[minmax(0,1fr)_400px]">
                  <ShopHero />
                  <div className="relative h-[360px]">
                    <div className="absolute inset-0 rounded-[38px] bg-gradient-to-br from-cyan-400/20 via-fuchsia-400/15 to-transparent blur-3xl" />
                    <div className="relative h-full overflow-hidden rounded-[34px] border border-white/10 bg-black/30">
                      <Image src={HERO_TROPHY} alt="Trophée" fill className="object-cover" sizes="400px" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div ref={filtersSectionRef}>
              <ShopFilters
                query={query}
                onQueryChange={setQuery}
                category={categoryFilter}
                onCategoryChange={(slug) => setCategoryFilter(slug)}
                categories={categoryChipOptions}
                sortOrder={sortOrder}
                onSortChange={setSortOrder}
                promoOnly={promoOnly}
                onPromoToggle={() => setPromoOnly((prev) => !prev)}
                priceFilter={priceFilter}
                onPriceChange={setPriceFilter}
              />
            </div>

            <div className="space-y-12">
              {hasActiveFilters ? (
                <ResultsGrid
                  products={filtered}
                  onAddToCart={handleAddToCart}
                  onView={handleViewProduct}
                  onLike={handleToggleLike}
                  onReset={resetAllFilters}
                />
              ) : (
                <>
                  {rechargeDirectProducts.length > 0 && (
                    <ProductGrid
                      title="Recharge Direct"
                      subtitle="Cliquez pour ouvrir le chat et finaliser avec un agent."
                      products={rechargeDirectProducts}
                      onAddToCart={handleAddToCart}
                      onView={handleViewProduct}
                      onLike={handleToggleLike}
                    />
                  )}
                  <ProductGrid
                    title="Produits populaires"
                    subtitle="Les comptes et recharges les plus likés par la communauté."
                    products={popularProducts}
                    onAddToCart={handleAddToCart}
                    onView={handleViewProduct}
                    onLike={handleToggleLike}
                  />
                  {gamingAccountProducts.length > 0 && (
                    <ProductGrid
                      title="Compte Gaming"
                      subtitle="Sélection de comptes gaming mis en avant."
                      products={gamingAccountProducts}
                      onAddToCart={handleAddToCart}
                      onView={handleViewProduct}
                      onLike={handleToggleLike}
                    />
                  )}
                  <ProductGrid
                    title="Promotions cosmiques"
                    subtitle="Réductions limitées sur les meilleures offres du moment."
                    products={promoProducts}
                    onAddToCart={handleAddToCart}
                    onView={handleViewProduct}
                    onLike={handleToggleLike}
                  />
                  {emoteSkinProducts.length > 0 && (
                    <ProductGrid
                      title="Emote && Skin"
                      subtitle="Emotes et skins à collectionner."
                      products={emoteSkinProducts}
                      onAddToCart={handleAddToCart}
                      onView={handleViewProduct}
                      onLike={handleToggleLike}
                    />
                  )}
                  <ProductGrid
                    title="Derniers ajouts"
                    subtitle="Comptes fraîchement listés et recharges spéciales."
                    products={latestProducts}
                    onAddToCart={handleAddToCart}
                    onView={handleViewProduct}
                    onLike={handleToggleLike}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="lg:hidden">
        <header className="sticky top-[72px] z-40 bg-black/70 backdrop-blur-lg sm:top-[84px]">
        <div className="mobile-shell hidden items-center justify-between py-3 sm:flex">
          <Link href="/" className="text-lg font-black tracking-tight">
            BADBOY<span className="text-white/70">SHOP</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/cart" className="rounded-xl border border-white/10 bg-white/5 p-2">
              <ShoppingCart className="h-5 w-5" />
            </Link>
            <button className="rounded-xl border border-white/10 bg-white/5 p-2">
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="mobile-shell pb-3">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <Search className="h-4 w-4 text-white/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un produit"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
            <button
              onClick={() => imageInputRef.current?.click()}
              className="rounded-xl border border-white/10 bg-white/10 p-2"
              aria-label="Recherche par image"
            >
              <Camera className="h-4 w-4 text-white/70" />
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageSearch(e.target.files?.[0] ?? null)}
            />
          </div>
          {imagePreview && (
            <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Recherche par image bientôt dispo.
            </div>
          )}
        </div>
      </header>

      <button
        type="button"
        onClick={openFilterSheet}
        className="fixed right-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-[0_18px_45px_rgba(0,0,0,0.55)] backdrop-blur-md transition hover:border-cyan-300/40 hover:bg-white/15 active:scale-[0.98] lg:hidden"
        style={{ bottom: "calc(92px + env(safe-area-inset-bottom))" }}
        aria-label="Filtrer"
      >
        <Settings2 className="h-5 w-5 text-white/90" />
      </button>

      <section className="mobile-shell space-y-4 py-4">
        {hasActiveFilters && (
          <ResultsGrid
            products={filtered}
            onAddToCart={handleAddToCart}
            onView={handleViewProduct}
            onLike={handleToggleLike}
            onReset={resetAllFilters}
          />
        )}

        {!hasActiveFilters && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Produits populaires</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-soft snap-x snap-mandatory">
            {loading
              ? Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="min-w-[180px] rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="h-4 w-16 rounded-full bg-white/10" />
                    <div className="mt-3 h-24 rounded-xl bg-white/10" />
                    <div className="mt-3 h-3 w-3/4 rounded-full bg-white/10" />
                  </div>
                ))
              : popularProducts.map((product) => (
                  <Link key={product.id} href={`/produits/${product.id}`} className="min-w-[180px] snap-start">
                    <StripCard product={product} label="Populaire" icon={Heart} />
                  </Link>
                ))}
          </div>
        </div>

        )}

        {!hasActiveFilters && gamingAccountProducts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Compte Gaming</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-soft snap-x snap-mandatory">
              {loading
                ? Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="min-w-[180px] rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="h-4 w-24 rounded-full bg-white/10" />
                      <div className="mt-3 h-24 rounded-xl bg-white/10" />
                      <div className="mt-3 h-3 w-3/4 rounded-full bg-white/10" />
                    </div>
                  ))
                : gamingAccountProducts.map((product) => (
                    <Link key={product.id} href={`/produits/${product.id}`} className="min-w-[180px] snap-start">
                      <StripCard product={product} label="Compte" icon={Crown} />
                    </Link>
                  ))}
            </div>
          </div>
        )}

        {!hasActiveFilters && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Produit cosmique</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-soft snap-x snap-mandatory">
            {loading
              ? Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="min-w-[190px] flex-shrink-0 snap-start rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="h-20 rounded-xl bg-white/10" />
                    <div className="mt-3 h-3 w-3/4 rounded-full bg-white/10" />
                    <div className="mt-2 h-3 w-1/2 rounded-full bg-white/10" />
                  </div>
                ))
              : promoProducts.slice(0, 6).map((product) => (
                  <Link
                    key={product.id}
                    href={`/produits/${product.id}`}
                    className="min-w-[210px] flex-shrink-0 snap-center"
                  >
                    <StripCard product={product} label="Cosmique" icon={Sparkles} />
                  </Link>
                ))}
          </div>
        </div>
        )}

        {!hasActiveFilters && emoteSkinProducts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Emote && Skin</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-soft snap-x snap-mandatory">
              {loading
                ? Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="min-w-[190px] flex-shrink-0 snap-start rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="h-20 rounded-xl bg-white/10" />
                      <div className="mt-3 h-3 w-3/4 rounded-full bg-white/10" />
                      <div className="mt-2 h-3 w-1/2 rounded-full bg-white/10" />
                    </div>
                  ))
                : emoteSkinProducts.slice(0, 6).map((product) => (
                    <Link
                      key={product.id}
                      href={`/produits/${product.id}`}
                      className="min-w-[210px] flex-shrink-0 snap-center"
                    >
                      <StripCard product={product} label="Emote/Skin" icon={Sparkles} />
                    </Link>
                  ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Derniers ajouts</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="h-24 rounded-xl bg-white/10" />
                    <div className="mt-3 h-3 w-3/4 rounded-full bg-white/10" />
                  </div>
                ))
              : latestProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/produits/${product.id}`}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-300/40 hover:bg-white/10"
                  >
                    <div className="h-24 overflow-hidden rounded-xl bg-white/10">
                      <img
                        src={toDisplayImageSrc(product.bannerUrl ?? product.imageUrl ?? FALLBACK_PRODUCT_IMAGE) ?? (product.bannerUrl ?? product.imageUrl ?? FALLBACK_PRODUCT_IMAGE)}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-white line-clamp-2">{product.name}</div>
                    <div className="mt-1 text-xs text-white/60 line-clamp-2">{product.description}</div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="text-sm font-bold text-cyan-200">{product.priceLabel}</div>
                        {product.oldPrice && (
                          <div className="text-[10px] text-white/40 line-through">
                            {formatNumber(product.oldPrice)}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] uppercase tracking-[0.3em] text-white/50">
                        Voir
                      </span>
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      </div>

      <MobileFiltersSheet
        open={filterSheetOpen}
        categories={categoryChipOptions}
        pending={pendingFilters}
        onPendingChange={setPendingFilters}
        onReset={resetFilterSheet}
        onApply={applyFilterSheet}
        onClose={() => setFilterSheetOpen(false)}
      />

    </main>
  );
}