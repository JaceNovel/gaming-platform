"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Zap, Bot, Heart, ShoppingCart } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { useCartFlight } from "@/hooks/useCartFlight";

type Stat = { value: string; label: string };
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

const heroPills = [
  { icon: ShieldCheck, label: "Sécurité sécurisée" },
  { icon: Zap, label: "Livraison instantanée" },
  { icon: Bot, label: "Anti-fraude actif" },
];

function GlowPill({
  children,
  tone = "cyan",
}: {
  children: React.ReactNode;
  tone?: "cyan" | "gold";
}) {
  const toneCls =
    tone === "gold"
      ? "from-amber-400/60 via-yellow-200/30 to-fuchsia-400/20"
      : "from-cyan-400/60 via-blue-300/30 to-fuchsia-400/20";

  return (
    <span className="relative inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-white/90">
      <span
        className={`absolute inset-0 -z-10 rounded-full bg-gradient-to-r ${toneCls} blur-[10px] opacity-70`}
      />
      <span className="absolute inset-0 -z-10 rounded-full bg-white/5 ring-1 ring-white/15" />
      {children}
    </span>
  );
}

function GlassButton({
  children,
  href,
  tone = "cyan",
  className = "",
}: {
  children: React.ReactNode;
  href: string;
  tone?: "cyan" | "gold";
  className?: string;
}) {
  const toneCls =
    tone === "gold"
      ? "from-amber-400/70 via-yellow-300/30 to-fuchsia-400/20"
      : "from-cyan-400/70 via-blue-400/30 to-fuchsia-400/20";

  return (
    <Link
      href={href}
      className={`group relative inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition active:scale-[0.98] ${className}`}
    >
      <span
        className={`absolute inset-0 -z-10 rounded-xl bg-gradient-to-r ${toneCls} opacity-80 blur-[14px]`}
      />
      <span className="absolute inset-0 -z-10 rounded-xl bg-white/8 ring-1 ring-white/20 backdrop-blur-md" />
      <span className="absolute inset-[1px] -z-10 rounded-[11px] bg-black/35" />
      <span className="relative">{children}</span>
      <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10 group-hover:ring-white/25" />
    </Link>
  );
}

function StatBar({ stats }: { stats: Stat[] }) {
  return (
    <div className="mx-auto mt-4 w-full max-w-6xl px-4">
      <div className="relative overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/15 backdrop-blur-md">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/10 via-fuchsia-400/10 to-amber-300/10" />
        <div className="relative flex gap-3 overflow-x-auto p-4 sm:grid sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex min-h-[92px] min-w-[160px] flex-col justify-between rounded-xl bg-black/25 p-3 ring-1 ring-white/10 sm:min-w-0"
            >
              <div className="text-lg font-extrabold tracking-tight text-white">
                {s.value}
              </div>
              <div className="mt-1 whitespace-pre-line text-xs leading-4 text-white/70">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductCardUI({
  p,
  onAddToCart,
  onBuy,
}: {
  p: ProductCard;
  onAddToCart: (product: ProductCard, origin?: HTMLElement | null) => void;
  onBuy: (product: ProductCard, origin?: HTMLElement | null) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/6 ring-1 ring-white/15 backdrop-blur-md">
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
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
            <Image
              src={p.image}
              alt={p.title}
              fill
              className="object-cover opacity-90"
              sizes="56px"
              priority={false}
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

          <button
            type="button"
            onClick={(event) => onAddToCart(p, event.currentTarget)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/15 transition active:scale-[0.98]"
            aria-label="Ajouter au panier"
          >
            <ShoppingCart className="h-5 w-5 text-white/90" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomeClient() {
  const router = useRouter();
  const { triggerFlight, overlay } = useCartFlight();
  const [stats, setStats] = useState<Stat[]>([
    { value: "10+", label: "Comptes\nvendus" },
    { value: "5", label: "Recharges\neffectuées" },
    { value: "3", label: "Membres\npremium" },
    { value: "200+", label: "Likes\nactifs" },
  ]);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [desktopStart, setDesktopStart] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      try {
        const res = await fetch(`${API_BASE}/products?active=1&display_section=popular&limit=4`);
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        if (!active) return;
        const mapped = items.map((item: any) => {
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
  }, []);

  const topProducts = useMemo(() => products, [products]);
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
      className="relative min-h-[100dvh] bg-[#0d0f1f] text-white overflow-x-hidden pb-[calc(80px+env(safe-area-inset-bottom))]"
      style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}
    >
      {overlay}
      <div className="absolute inset-0 -z-20 hidden sm:block bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_55%),radial-gradient(circle_at_30%_10%,rgba(14,165,233,0.16),transparent_45%),linear-gradient(180deg,#0d0f1f_0%,#0b0b14_100%)]" />

      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-120px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-[80px]" />
        <div className="absolute left-[10%] top-[10%] h-[420px] w-[420px] rounded-full bg-cyan-500/20 blur-[90px]" />
        <div className="absolute right-[8%] top-[18%] h-[380px] w-[380px] rounded-full bg-amber-400/10 blur-[90px]" />
      </div>

      <section className="mx-auto w-full max-w-6xl px-4 pb-4 pt-5 sm:pt-6 lg:pt-10">
        <div className="relative overflow-hidden rounded-none border-0 bg-transparent px-4 pb-5 pt-6 shadow-none sm:rounded-[28px] sm:border sm:border-white/10 sm:bg-black/60 sm:shadow-[0_30px_120px_rgba(15,23,42,0.6)] sm:px-8 sm:pb-6 lg:px-10">
          <div className="pointer-events-none absolute inset-0">
            <div className="hero-slideshow">
              <div
                className="hero-slide"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, rgba(10,10,20,0.65) 0%, rgba(10,10,20,0.85) 100%), url('https://wallpapercave.com/wp/wp8975622.jpg')",
                }}
              />
              <div
                className="hero-slide"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, rgba(10,10,20,0.65) 0%, rgba(10,10,20,0.85) 100%), url('https://mcdn.wallpapersafari.com/medium/19/6/LfHsD5.jpeg')",
                }}
              />
              <div
                className="hero-slide"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, rgba(10,10,20,0.65) 0%, rgba(10,10,20,0.85) 100%), url('https://bagogames-com.s3.amazonaws.com/wp-content/uploads/2022/02/25095342/call-of-duty-still-the-king-of-FPS-BG.jpg')",
                }}
              />
              <div
                className="hero-slide"
                style={{
                  backgroundImage:
                    "linear-gradient(180deg, rgba(10,10,20,0.65) 0%, rgba(10,10,20,0.85) 100%), url('https://www.bluesecure.io/app/uploads/2024/05/Capture-decran-2024-04-29-150953-min.png')",
                }}
              />
            </div>
          </div>
          <div className="relative">
            <div className="mx-auto w-full max-w-[420px] sm:hidden">
              <div className="pill-marquee">
                <div className="pill-marquee-track">
                  {[0, 1].map((loop) => (
                    <div key={loop} className="pill-marquee-group">
                      {heroPills.map((pill) => (
                        <GlowPill key={`${loop}-${pill.label}`}>
                          <pill.icon className="h-4 w-4 text-cyan-300" />
                          {pill.label}
                        </GlowPill>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mx-auto hidden max-w-xl flex-wrap items-center justify-center gap-2 text-center sm:flex">
              {heroPills.map((pill) => (
                <GlowPill key={pill.label}>
                  <pill.icon className="h-4 w-4 text-cyan-300" />
                  {pill.label}
                </GlowPill>
              ))}
            </div>

            <div className="mt-5 text-center">
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                <span className="neon-text">BADBOY</span>
                <span className="text-white/70">SHOP</span>
              </h1>
              <p className="mx-auto mt-2 max-w-[420px] text-base font-semibold leading-6 text-white/85 sm:max-w-2xl sm:text-xl">
                La plateforme gaming d’élite
              </p>
              <p className="mx-auto mt-2 max-w-[420px] text-xs leading-5 text-white/70 sm:max-w-2xl sm:text-base">
                Recharges, comptes, coaching premium et services digitaux sécurisés
              </p>

              <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <GlassButton
                  href="/shop"
                  tone="cyan"
                  className="w-full max-w-[340px] shadow-[0_0_30px_rgba(110,231,255,0.35)] sm:w-auto sm:max-w-none"
                >
                  Explorer la boutique
                </GlassButton>
                <GlassButton
                  href="/premium"
                  tone="gold"
                  className="w-full max-w-[340px] shadow-[0_0_30px_rgba(244,206,106,0.35)] sm:w-auto sm:max-w-none"
                >
                  Devenir Premium
                </GlassButton>
              </div>
            </div>

            <div className="hidden sm:block">
              <StatBar stats={stats} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-6 pt-2">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">
            Produits <span className="text-white/70">les plus populaires</span>
          </h2>
          <Link href="/shop" className="text-xs text-white/70 hover:text-white">
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
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-soft sm:hidden">
              {topProducts.map((p) => (
                <ProductCardUI
                  key={p.id}
                  p={p}
                  onAddToCart={addToCart}
                  onBuy={handleBuy}
                />
              ))}
            </div>
            <div className={`hidden sm:grid sm:grid-cols-3 sm:gap-4 transition-all duration-[3000ms] ${transitioning ? "blur-sm opacity-70" : "blur-0 opacity-100"}`}>
              {desktopPopular.map((p) => (
                <ProductCardUI
                  key={`desktop-${p.id}`}
                  p={p}
                  onAddToCart={addToCart}
                  onBuy={handleBuy}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
