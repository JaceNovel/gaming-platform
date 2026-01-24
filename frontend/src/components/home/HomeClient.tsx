"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Zap, Bot, Heart, ShoppingCart } from "lucide-react";
import { API_BASE } from "@/lib/config";

type Stat = { value: string; label: string };
type ProductCard = {
  id: number;
  title: string;
  subtitle: string;
  price: string;
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
        <div className="relative grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex min-h-[92px] flex-col justify-between rounded-xl bg-black/25 p-3 ring-1 ring-white/10"
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

function ProductCardUI({ p }: { p: ProductCard }) {
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
          <Link
            href="/shop"
            className="relative inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur-md transition active:scale-[0.98]"
          >
            Acheter
            <span className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-cyan-400/15 via-fuchsia-400/10 to-amber-300/10" />
          </Link>

          <button
            type="button"
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
  const [stats, setStats] = useState<Stat[]>([
    { value: "—", label: "Comptes\nvendus" },
    { value: "—", label: "Recharges\neffectuées" },
    { value: "—", label: "Membres\npremium" },
    { value: "—", label: "Likes\nactifs" },
  ]);
  const [products, setProducts] = useState<ProductCard[]>([]);

  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/stats/overview`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setStats([
          { value: formatNumber(Number(data?.orders ?? 0)), label: "Comptes\nvendus" },
          { value: formatNumber(Number(data?.orders ?? 0)), label: "Recharges\neffectuées" },
          { value: formatNumber(Number(data?.premium ?? 0)), label: "Membres\npremium" },
          { value: formatNumber(Number(data?.likes ?? 0)), label: "Likes\nactifs" },
        ]);
      } catch {
        if (!active) return;
      }
    };

    const loadProducts = async () => {
      try {
        const res = await fetch(`${API_BASE}/products?active=1`);
        if (!res.ok) return;
        const data = await res.json();
        const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        if (!active) return;
        const mapped = items.slice(0, 3).map((item: any) => ({
          id: item.id,
          title: item.name,
          subtitle: item.game?.name ?? item.type ?? "Gaming",
          price: `${formatNumber(Number(item.price ?? 0))} FCFA`,
          likes: Number(item.likes_count ?? 0),
          badge: item.type ? String(item.type).toUpperCase().slice(0, 4) : "VIP",
          image: "/file.svg",
        }));
        setProducts(mapped);
      } catch {
        if (!active) return;
      }
    };

    loadStats();
    loadProducts();
    return () => {
      active = false;
    };
  }, []);

  const topProducts = useMemo(() => products, [products]);

  return (
    <main
      className="relative min-h-dvh bg-[#0d0f1f] text-white pb-[calc(64px+env(safe-area-inset-bottom))]"
      style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom))" }}
    >
      <div
        className="absolute inset-0 -z-20 hidden sm:block bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(13,15,31,0.85) 0%, rgba(11,11,20,0.9) 100%), url('https://as1.ftcdn.net/v2/jpg/05/55/49/54/1000_F_555495493_eENKH9YSBt11mof5hAkC77aMFpoG5BdG.jpg')",
        }}
      />

      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-120px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-[80px]" />
        <div className="absolute left-[10%] top-[10%] h-[420px] w-[420px] rounded-full bg-cyan-500/20 blur-[90px]" />
        <div className="absolute right-[8%] top-[18%] h-[380px] w-[380px] rounded-full bg-amber-400/10 blur-[90px]" />
      </div>

      <section className="mx-auto w-full max-w-6xl px-4 pb-4 pt-5 sm:pt-6 lg:pt-10">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/60 px-4 pb-5 pt-6 shadow-[0_30px_120px_rgba(15,23,42,0.6)] sm:px-8 sm:pb-6 lg:px-10">
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
                BADBOY<span className="text-white/70">SHOP</span>
              </h1>
              <p className="mx-auto mt-2 max-w-[420px] text-base font-semibold leading-6 text-white/85 sm:max-w-2xl sm:text-xl">
                La plateforme gaming d’élite
              </p>
              <p className="mx-auto mt-2 max-w-[420px] text-xs leading-5 text-white/70 sm:max-w-2xl sm:text-base">
                Recharges, comptes, tournois, GVG, transferts internationaux
              </p>

              <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <GlassButton
                  href="/shop"
                  tone="cyan"
                  className="w-full max-w-[340px] sm:w-auto sm:max-w-none"
                >
                  Explorer la boutique
                </GlassButton>
                <GlassButton
                  href="/premium"
                  tone="gold"
                  className="w-full max-w-[340px] sm:w-auto sm:max-w-none"
                >
                  Devenir Premium
                </GlassButton>
              </div>
            </div>

            <StatBar stats={stats} />
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {topProducts.map((p) => (
                <ProductCardUI key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
