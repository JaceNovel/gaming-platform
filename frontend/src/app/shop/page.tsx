"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import SectionTitle from "@/components/ui/SectionTitle";
import ProductCard from "@/components/ui/ProductCard";
import GlowButton from "@/components/ui/GlowButton";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

type ShopProduct = {
  id: number;
  name: string;
  description: string;
  priceLabel: string;
  priceValue: number;
  likes: number;
  category: string;
  badgeLevel: "Bronze" | "Or" | "Platine";
  type: string;
};

const categories = ["Comptes", "Recharges", "Articles", "Pass", "Tournois", "Gifts"];
const premiumLevels = ["Bronze", "Or", "Platine"];
const rechargeBannerUrl = "https://staticg.sportskeeda.com/editor/2022/02/fcc09-16441468734743-1920.jpg";
const accessoriesBannerUrl =
  "https://static0.makeuseofimages.com/wordpress/wp-content/uploads/2023/01/ironclad-gloves-gripping-controller.jpg";

export default function ShopPage() {
  const router = useRouter();
  const { user, authFetch } = useAuth();
  const [showFilter, setShowFilter] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [priceRange, setPriceRange] = useState(60);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [flyers, setFlyers] = useState<
    Array<{ id: number; x: number; y: number; targetX: number; targetY: number }>
  >([]);
  const nextPath = "/shop";

  const formatNumber = useMemo(() => (value: number) => new Intl.NumberFormat("fr-FR").format(value), []);

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
          const priceLabel = `${formatNumber(priceValue)} FCFA`;
          const type = String(item?.type ?? "").toLowerCase();
          const category = type.includes("recharge") || type.includes("topup")
            ? "Recharges"
            : type.includes("account")
              ? "Comptes"
              : type.includes("subscription") || type.includes("premium")
                ? "Pass"
                : "Articles";
          const badgeLevel: ShopProduct["badgeLevel"] =
            priceValue >= 30000 ? "Platine" : priceValue >= 15000 ? "Or" : "Bronze";
          return {
            id: item.id,
            name: item.name,
            description: item?.details?.description ?? item?.details?.subtitle ?? item?.game?.name ?? "Produit premium",
            priceLabel,
            priceValue,
            likes: Number(item?.likes_count ?? 0),
            category,
            badgeLevel,
            type: String(item?.type ?? ""),
          } as ShopProduct;
        });
        setProducts(mapped);
      } catch {
        if (!active) return;
      }
    };

    loadProducts();
    return () => {
      active = false;
    };
  }, [formatNumber]);

  const requireAuth = () => {
    if (!user) {
      setShowPrompt(true);
      return false;
    }
    return true;
  };

  const handleLike = async (id: number) => {
    if (!requireAuth()) return;
    const res = await authFetch(`${API_BASE}/likes/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: id }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setProducts((prev) =>
      prev.map((product) =>
        product.id === id ? { ...product, likes: Number(data?.likes_count ?? product.likes) } : product
      )
    );
  };

  const handleBuy = (id: number) => {
    if (!requireAuth()) return;
    router.push(`/checkout?product=${id}`);
  };

  const handleAddToCart = (
    product: ShopProduct,
    event?: React.MouseEvent<HTMLDivElement>,
  ) => {
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

    if (event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      const targetX = window.innerWidth - 90;
      const targetY = 24;
      const id = Date.now() + Math.random();
      setFlyers((prev) => [...prev, { id, x: startX, y: startY, targetX, targetY }]);
      setTimeout(() => {
        setFlyers((prev) => prev.filter((item) => item.id !== id));
      }, 900);
    }
  };

      return (
        <div className="min-h-[100dvh] pb-24">
          <div className="w-full py-10">
            <div className="w-full px-5 sm:px-8 lg:px-16 xl:px-24 2xl:px-32 space-y-8">
              <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-200/80">Boutique</p>
                  <h1 className="text-3xl lg:text-4xl font-black">BADBOYSHOP Store</h1>
                  <p className="text-sm text-white/60 max-w-2xl">
                    Sélection premium, recharges instantanées et comptes rares. Optimisé desktop et mobile.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setShowFilter(true)}
                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:text-white"
                  >
                    Filtres avancés
                  </button>
                  <GlowButton onClick={() => setShowFilter(true)}>Explorer</GlowButton>
                </div>
              </header>
              {cartNotice && (
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100">
                  {cartNotice}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    title={product.name}
                    subtitle={product.description}
                    price={product.priceLabel}
                    likes={product.likes}
                    tag={product.category}
                    badgeLevel={product.badgeLevel}
                    details={["Livraison instant", "ID requis", "Stock limité"]}
                    imageSlot={
                      product.category === "Recharges" ? (
                        <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${rechargeBannerUrl})` }} />
                      ) : product.category === "Articles" ? (
                        <div
                          className="h-full w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${accessoriesBannerUrl})` }}
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-white/5 via-transparent to-cyan-400/10 flex items-center justify-center">
                          <span className="text-xs text-white/70">Gaming drop</span>
                        </div>
                      )
                    }
                    onLike={() => handleLike(product.id)}
                    onAction={() => handleBuy(product.id)}
                    onDoubleClick={(event) => handleAddToCart(product, event)}
                  />
                ))}
              </div>
            </div>
          </div>

          {flyers.map((flyer) => (
            <div
              key={flyer.id}
              className="cart-flyer"
              style={
                {
                  left: flyer.x,
                  top: flyer.y,
                  "--start-x": `${flyer.x}px`,
                  "--start-y": `${flyer.y}px`,
                  "--target-x": `${flyer.targetX}px`,
                  "--target-y": `${flyer.targetY}px`,
                } as React.CSSProperties
              }
            >
              <ShoppingCart className="h-4 w-4" />
            </div>
          ))}

          {showPrompt && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div className="glass-card rounded-2xl p-5 w-full max-w-sm border border-white/10 space-y-3">
                <h3 className="text-lg font-bold">Connecte-toi pour continuer</h3>
                <p className="text-sm text-white/70">
                  Les achats et actions sensibles nécessitent un compte. Connecte-toi ou crée un compte pour continuer.
                </p>
                <div className="flex gap-3">
                  <GlowButton
                    className="flex-1 justify-center"
                    onClick={() => router.push(`/auth/login?next=${encodeURIComponent(nextPath)}`)}
                  >
                    Connexion
                  </GlowButton>
                  <GlowButton
                    variant="secondary"
                    className="flex-1 justify-center"
                    onClick={() => router.push(`/auth/register?next=${encodeURIComponent(nextPath)}`)}
                  >
                    Créer un compte
                  </GlowButton>
                </div>
                <button
                  onClick={() => setShowPrompt(false)}
                  className="w-full text-sm text-white/50 hover:text-white"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {showFilter && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
              <div className="glass-card rounded-2xl p-6 border border-white/10 w-full max-w-lg space-y-4">
                <div className="flex items-center justify-between">
                  <SectionTitle eyebrow="Filtres" label="Filtrer la boutique" />
                  <button className="text-xs text-white/50 hover:text-white" onClick={() => setShowFilter(false)}>
                    Fermer
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Recherche</p>
                  <input
                    className="mt-2 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2"
                    placeholder="Ex: Free Fire, recharge, tournoi..."
                  />
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {["Livraison instant", "Top ventes", "Nouveautés", "VIP"].map((item) => (
                      <span key={item} className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">Catégories</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      {categories.map((item) => (
                        <button
                          key={item}
                          className="rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-white/70 hover:text-white"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">Niveau premium</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {premiumLevels.map((item) => (
                        <button
                          key={item}
                          className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70 hover:text-white"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Prix</p>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={priceRange}
                    onChange={(e) => setPriceRange(Number(e.target.value))}
                    className="mt-3 w-full accent-cyan-300"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-white/60">
                    <span>0 FCFA</span>
                    <span>{priceRange * 1000} FCFA</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <GlowButton variant="secondary" className="flex-1 justify-center" onClick={() => setShowFilter(false)}>
                    Annuler
                  </GlowButton>
                  <GlowButton className="flex-1 justify-center" onClick={() => setShowFilter(false)}>
                    Appliquer
                  </GlowButton>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }