"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Camera, Search, ShoppingCart, Sparkles, Tag, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import GlowButton from "@/components/ui/GlowButton";
import { API_BASE } from "@/lib/config";

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
};

type CategoryOption = {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  productsCount: number;
};

const exampleProducts: ShopProduct[] = [
  {
    id: 9001,
    name: "Compte Free Fire Légendaire",
    description: "Skin rare + diamant bonus",
    priceLabel: "12 000 FCFA",
    priceValue: 12000,
    oldPrice: 18000,
    discountPercent: 33,
    likes: 42,
    category: "Comptes",
    categorySlug: "comptes",
    type: "account",
  },
  {
    id: 9002,
    name: "Recharge 1000 diamants",
    description: "Livraison instantanée",
    priceLabel: "4 000 FCFA",
    priceValue: 4000,
    oldPrice: 5200,
    discountPercent: 23,
    likes: 28,
    category: "Recharges",
    categorySlug: "recharges",
    type: "recharge",
  },
  {
    id: 9003,
    name: "Pack accessoires gaming",
    description: "Contrôleur + bonus",
    priceLabel: "7 000 FCFA",
    priceValue: 7000,
    oldPrice: 9800,
    discountPercent: 29,
    likes: 19,
    category: "Accessoires",
    categorySlug: "accessoires",
    type: "accessory",
  },
];

const slugifyCategory = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

function CategoryChips({
  value,
  options,
  onChange,
}: {
  value: string;
  options: CategoryOption[];
  onChange: (c: string) => void;
}) {
  const chips = [{ slug: "all", name: "Tous" }, ...options.map((opt) => ({ slug: opt.slug, name: opt.name }))];
  return (
    <div className="sticky top-[96px] z-30 mt-3 bg-black/60 backdrop-blur-md sm:top-[110px]">
      <div className="mobile-shell flex gap-2 overflow-x-auto py-3 scrollbar-soft">
        {chips.map((cat) => {
          const active = value === cat.slug;
          return (
            <button
              key={cat.slug}
              onClick={() => onChange(cat.slug)}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.2em] transition ${
                active
                  ? "border-cyan-300/60 bg-cyan-400/10 text-cyan-200"
                  : "border-white/10 bg-white/5 text-white/70 hover:text-white"
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterSheet({
  open,
  value,
  options,
  onSelect,
  onReset,
  onApply,
  onClose,
}: {
  open: boolean;
  value: string;
  options: CategoryOption[];
  onSelect: (slug: string) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const chips = [{ slug: "all", name: "Tous" }, ...options.map((opt) => ({ slug: opt.slug, name: opt.name }))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px] px-4">
      <button
        className="absolute inset-0"
        onClick={onClose}
        aria-label="Fermer les filtres"
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950/95 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/50 hover:text-white"
        >
          Fermer
        </button>
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/40">Filtrer</p>
        <h3 className="text-xl font-bold text-white">Catégories</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => {
            const active = value === chip.slug;
            return (
              <button
                key={chip.slug}
                onClick={() => onSelect(chip.slug)}
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
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={onReset}
            className="rounded-2xl border border-white/15 bg-transparent py-3 text-sm font-semibold text-white"
          >
            Réinitialiser
          </button>
          <GlowButton onClick={onApply}>Appliquer</GlowButton>
        </div>
      </div>
    </div>
  );
}

function DealCard({ product }: { product: ShopProduct }) {
  return (
    <div className="relative flex min-w-[180px] flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between text-[11px] uppercase tracking-[0.2em] text-white/60">
        <span className="flex items-center gap-1">
          <Tag className="h-3.5 w-3.5 text-amber-300" />
          Deal
        </span>
        {product.discountPercent && (
          <span className="rounded-full bg-amber-400/20 px-2 py-1 text-[10px] text-amber-200">
            -{product.discountPercent}%
          </span>
        )}
      </div>
      <div className="h-24 w-full rounded-xl bg-white/10" />
      <div className="text-sm font-semibold text-white line-clamp-2">{product.name}</div>
      <div className="text-xs text-white/60 line-clamp-2">{product.description}</div>
      <div className="mt-auto text-sm font-bold text-cyan-200">{product.priceLabel}</div>
      {product.oldPrice && (
        <div className="text-[11px] text-white/40 line-through">{formatNumber(product.oldPrice)} FCFA</div>
      )}
    </div>
  );
}

export default function ShopPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState("all");
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const nextPath = "/shop";

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
          const type = String(item?.type ?? "").toLowerCase();
          const fallbackCategory = type.includes("recharge") || type.includes("topup")
            ? "Recharges"
            : type.includes("account")
              ? "Comptes"
              : type.includes("subscription") || type.includes("premium")
                ? "Offres"
                : "Accessoires";
          const categoryName = item?.category ?? item?.category_entity?.name ?? fallbackCategory;
          const categorySlug = item?.category_entity?.slug ?? (categoryName ? slugifyCategory(categoryName) : null);
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
            type: String(item?.type ?? ""),
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

  const requireAuth = () => {
    if (!user) {
      setShowPrompt(true);
      return false;
    }
    return true;
  };

  const handleAddToCart = (product: ShopProduct) => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("bbshop_cart");
    const cart = stored ? (JSON.parse(stored) as Array<{ id: number; quantity: number } & Record<string, unknown>>) : [];
    const priceNumber = Number(product.priceValue) || 0;
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity = (existing.quantity as number) + 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        description: product.description,
        price: priceNumber,
        priceLabel: product.priceLabel,
        type: product.type,
        quantity: 1,
      });
    }
    localStorage.setItem("bbshop_cart", JSON.stringify(cart));
    setCartNotice(`${product.name} ajouté au panier`);
    setTimeout(() => setCartNotice(null), 1500);
  };

  const handleBuy = (id: number) => {
    if (!requireAuth()) return;
    router.push(`/checkout?product=${id}`);
  };

  const catalog = products.length ? products : exampleProducts;

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
    setPendingCategory(categoryFilter);
    setFilterSheetOpen(true);
  };

  const applyFilterSheet = () => {
    setCategoryFilter(pendingCategory);
    setFilterSheetOpen(false);
  };

  const resetFilterSheet = () => {
    setPendingCategory("all");
  };

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.filter((product) => {
      const matchesQuery = normalizedQuery
        ? product.name.toLowerCase().includes(normalizedQuery)
        : true;
      const filterSlug = categoryFilter;
      const productSlug = product.categorySlug ?? slugifyCategory(product.category ?? "");
      const matchesCategory =
        filterSlug === "all" ||
        productSlug === filterSlug ||
        product.category?.toLowerCase() === filterSlug;
      return matchesQuery && matchesCategory;
    });
  }, [catalog, query, categoryFilter]);

  const groupedDeals = filtered.slice(0, 6);
  const dailyDeals = filtered.slice(0, 8);
  const forYou = filtered.slice(0, 12);

  const handleImageSearch = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <header className="sticky top-0 z-40 bg-black/70 backdrop-blur-lg">
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
            >
              <Camera className="h-4 w-4 text-white/70" />
            </button>
            <button
              onClick={openFilterSheet}
              className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white sm:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtrer
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

      <div className="hidden sm:block">
        <CategoryChips value={categoryFilter} options={categoryChipOptions} onChange={setCategoryFilter} />
      </div>

      <section className="mobile-shell space-y-4 py-4">
        {cartNotice && (
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
            {cartNotice}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Offres groupées</h2>
            <span className="text-xs text-white/60">3+ dès 5 000 FCFA</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-soft">
            {loading
              ? Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="min-w-[180px] rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="h-4 w-16 rounded-full bg-white/10" />
                    <div className="mt-3 h-24 rounded-xl bg-white/10" />
                    <div className="mt-3 h-3 w-3/4 rounded-full bg-white/10" />
                  </div>
                ))
              : groupedDeals.map((product) => <DealCard key={product.id} product={product} />)}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Deal du jour</h2>
            <Link href="/shop" className="text-xs text-white/60">Voir tout</Link>
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
              : dailyDeals.map((product) => (
                  <div
                    key={product.id}
                    className="min-w-[210px] flex-shrink-0 snap-center rounded-2xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="h-20 rounded-xl bg-white/10" />
                    <div className="mt-2 text-xs font-semibold text-white line-clamp-2">{product.name}</div>
                    <div className="mt-1 text-xs text-white/60 line-clamp-1">{product.description}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm font-bold text-cyan-200">{product.priceLabel}</span>
                      {product.oldPrice && (
                        <span className="text-[10px] text-white/40 line-through">
                          {formatNumber(product.oldPrice)}
                        </span>
                      )}
                      {product.discountPercent && (
                        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-200">
                          -{product.discountPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Pour vous</h2>
            <span className="text-xs text-white/60">Scroll infini bientôt</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="h-24 rounded-xl bg-white/10" />
                    <div className="mt-3 h-3 w-3/4 rounded-full bg-white/10" />
                  </div>
                ))
              : forYou.map((product) => (
                  <div key={product.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="h-24 rounded-xl bg-white/10" />
                    <div className="mt-3 text-sm font-semibold text-white line-clamp-2">{product.name}</div>
                    <div className="mt-1 text-xs text-white/60 line-clamp-2">{product.description}</div>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-cyan-200">{product.priceLabel}</div>
                        {product.oldPrice && (
                          <div className="text-[10px] text-white/40 line-through">
                            {formatNumber(product.oldPrice)}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddToCart(product)}
                          className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white"
                        >
                          Panier
                        </button>
                        <GlowButton onClick={() => handleBuy(product.id)}>Acheter</GlowButton>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </section>

      <FilterSheet
        open={filterSheetOpen}
        value={pendingCategory}
        options={categoryChipOptions}
        onSelect={(slug) => setPendingCategory(slug)}
        onReset={resetFilterSheet}
        onApply={applyFilterSheet}
        onClose={() => setFilterSheetOpen(false)}
      />

      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl">
            <div className="text-lg font-bold">Connexion requise</div>
            <p className="mt-2 text-sm text-white/70">
              Connecte-toi ou crée un compte pour continuer.
            </p>
            <div className="mt-4 flex gap-3">
              <GlowButton onClick={() => router.push(`/auth/login?next=${encodeURIComponent(nextPath)}`)}>
                Se connecter
              </GlowButton>
              <GlowButton
                onClick={() => router.push(`/auth/register?next=${encodeURIComponent(nextPath)}`)}
                variant="secondary"
              >
                S'inscrire
              </GlowButton>
            </div>
            <button onClick={() => setShowPrompt(false)} className="mt-4 text-xs text-white/50 hover:text-white">
              Fermer
            </button>
          </div>
        </div>
      )}
    </main>
  );
}