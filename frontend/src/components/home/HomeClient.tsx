"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Sparkles, Shield, Flame, Crown, Zap, Rocket } from "lucide-react";
import GlowButton from "@/components/ui/GlowButton";
import StatCard from "@/components/ui/StatCard";
import SectionTitle from "@/components/ui/SectionTitle";
import ProductCard from "@/components/ui/ProductCard";
import PremiumBadge from "@/components/ui/PremiumBadge";
import Badge from "@/components/ui/Badge";
import StatPill from "@/components/ui/StatPill";

const products = [
  {
    title: "Compte Free Fire",
    subtitle: "Légendaire",
    price: "15 000 FCFA",
    likes: 43,
    tag: "Comptes",
    badgeLevel: "Platine" as const,
  },
  {
    title: "Recharge 1000 diamants",
    subtitle: "Mobile Legends",
    price: "8 500 FCFA",
    likes: 28,
    tag: "Recharges",
    badgeLevel: "Or" as const,
  },
  {
    title: "Pack Accessoires",
    subtitle: "Mobile",
    price: "12 000 FCFA",
    likes: 15,
    tag: "Articles",
    badgeLevel: "Bronze" as const,
  },
];

const heroBanners = [
  "https://dafunda.com/wp-content/uploads/2019/09/cheat-ff.jpeg",
  "https://4kwallpapers.com/images/wallpapers/call-of-duty-modern-warfare-2-war-zone-ghost-2022-games-2880x1800-8542.jpg",
  "https://cdn2.unrealengine.com/fortnite-og-social-1920x1080-a5adda66fab9.jpg",
  "https://cdn.geekwire.com/wp-content/uploads/2022/07/Netflix2154.jpg",
];

const rechargeBannerUrl = "https://staticg.sportskeeda.com/editor/2022/02/fcc09-16441468734743-1920.jpg";
const accessoriesBannerUrl =
  "https://static0.makeuseofimages.com/wordpress/wp-content/uploads/2023/01/ironclad-gloves-gripping-controller.jpg";

export default function HomeClient() {
  return (
    <div className="min-h-screen pb-24">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="mobile-shell relative space-y-8 lg:hidden">
        <Hero />
        <Highlights />
        <PopularProducts />
        <PremiumCTA />
      </div>

      <div className="relative hidden lg:block w-full min-h-[100dvh]">
        <section className="w-full py-12">
          <div className="mx-auto w-full max-w-screen-2xl px-16 xl:px-24 2xl:px-32">
            <HeroDesktop />
          </div>
        </section>
        <section className="w-full py-10">
          <div className="mx-auto w-full max-w-screen-2xl px-16 xl:px-24 2xl:px-32">
            <HighlightsDesktop />
          </div>
        </section>
        <section className="w-full py-12">
          <div className="mx-auto w-full max-w-screen-2xl px-16 xl:px-24 2xl:px-32">
            <PopularProductsDesktop />
          </div>
        </section>
        <section className="w-full py-12">
          <div className="mx-auto w-full max-w-screen-2xl px-16 xl:px-24 2xl:px-32">
            <PremiumCTADesktop />
          </div>
        </section>
      </div>
    </div>
  );
}

function HeroDesktop() {
  const router = useRouter();
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative w-full rounded-3xl p-10 glass-card glow-border overflow-hidden card-hover"
    >
      <div className="absolute inset-0 hero-slideshow">
        {heroBanners.map((src) => (
          <div key={src} className="hero-slide" style={{ backgroundImage: `url(${src})` }} />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/30 to-cyan-500/20 pointer-events-none" />
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          <Badge label="Sécurisé" variant="cyan" />
          <Badge label="Livraison instantanée" variant="purple" />
          <Badge label="Anti-fraude actif" variant="gold" />
        </div>
        <h1 className="text-5xl font-black leading-tight neon-text max-w-3xl">
          BADBOYSHOP
        </h1>
        <h2 className="text-2xl font-semibold text-white/90">La plateforme gaming d'élite</h2>
        <p className="text-base text-white/70 max-w-2xl">
          Recharges, comptes, tournois, GVG, transferts internationaux
        </p>
        <div className="flex gap-3">
          <GlowButton variant="primary" onClick={() => router.push("/shop")}>Explorer la boutique</GlowButton>
          <GlowButton variant="secondary" onClick={() => router.push("/premium")}>
            Devenir Premium
          </GlowButton>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatPill label="Comptes vendus" value="1 234" />
          <StatPill label="Recharges effectuées" value="567" />
          <StatPill label="Membres premium" value="2 100" />
          <StatPill label="Guides actifs" value="185" />
        </div>
      </div>
    </motion.section>
  );
}

function HighlightsDesktop() {
  return (
    <div className="space-y-4">
      <SectionTitle eyebrow="Stats live" label="BADBOYSHOP en chiffres" />
      <div className="grid grid-cols-2 gap-4">
        <StatCard title="Comptes vendus" value="1 234" hint="+64 cette semaine" icon={<Shield className="h-5 w-5" />} glow />
        <StatCard title="Recharges effectuées" value="567" hint="Livraison instantanée" icon={<Zap className="h-5 w-5" />} />
        <StatCard title="Membres premium" value="2 100" hint="Communauté VIP" icon={<Crown className="h-5 w-5" />} />
        <StatCard title="Guides actifs" value="185" hint="Coachs & support" icon={<Flame className="h-5 w-5" />} />
      </div>
    </div>
  );
}

function PopularProductsDesktop() {
  return (
    <section className="space-y-4">
      <SectionTitle eyebrow="Populaires" label="Produits les plus populaires" />
      <div className="grid grid-cols-3 gap-4 xl:grid-cols-4 2xl:grid-cols-5">
        {products.map((p) => (
          <ProductCard
            key={p.title}
            title={p.title}
            subtitle={p.subtitle}
            price={p.price}
            likes={p.likes}
            tag={p.tag}
            badgeLevel={p.badgeLevel}
            imageSlot={
              p.tag === "Recharges" ? (
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${rechargeBannerUrl})` }} />
              ) : p.tag === "Articles" ? (
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${accessoriesBannerUrl})` }} />
              ) : (
                <div className="h-full w-full bg-gradient-to-r from-cyan-400/20 via-purple-400/10 to-transparent flex items-center justify-center">
                  <span className="text-xs text-white/70">Preview</span>
                </div>
              )
            }
            onLike={() => undefined}
            onAction={() => undefined}
          />
        ))}
      </div>
    </section>
  );
}

function PremiumCTADesktop() {
  const router = useRouter();
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="glass-card rounded-3xl p-8 border border-white/10"
    >
      <div className="flex items-start gap-6">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-black grid place-items-center shadow-[0_10px_40px_rgba(251,191,36,0.3)]">
          <Crown className="h-7 w-7" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <PremiumBadge level="Or" />
            <PremiumBadge level="Platine" />
          </div>
          <h3 className="text-2xl font-bold">Passe en mode VIP</h3>
          <p className="text-sm text-white/70">
            Cashback BD Wallet, support prioritaire, deals secrets et tournois réservés aux membres.
          </p>
          <div className="flex gap-3">
            <GlowButton variant="primary" onClick={() => router.push("/premium")}>
              Devenir Premium
            </GlowButton>
            <GlowButton variant="ghost" onClick={() => router.push("/premium")}>
              Voir les avantages
            </GlowButton>
          </div>
        </div>
        <div className="grid gap-3 text-sm text-white/70">
          <div className="flex items-center gap-2"><Rocket className="h-4 w-4 text-cyan-300" /> Boost XP & drops</div>
          <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-300" /> Anti-fraude mobile</div>
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-cyan-300" /> Support prioritaire</div>
        </div>
      </div>
    </motion.section>
  );
}

function Hero() {
  const router = useRouter();
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative mt-6 rounded-3xl p-5 glass-card glow-border overflow-hidden card-hover"
    >
      <div className="absolute inset-0 hero-slideshow">
        {heroBanners.map((src) => (
          <div key={src} className="hero-slide" style={{ backgroundImage: `url(${src})` }} />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/30 to-cyan-500/20 pointer-events-none" />
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge label="Sécurisé" variant="cyan" />
          <Badge label="Livraison instantanée" variant="purple" />
          <Badge label="Anti-fraude actif" variant="gold" />
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-cyan-100 bg-white/5 border border-white/10 px-3 py-1 rounded-full w-fit">
          <Sparkles className="h-4 w-4" />
          Plateforme gaming d'élite
        </div>
        <h1 className="text-3xl font-black leading-tight neon-text">
          BADBOYSHOP
        </h1>
        <h2 className="text-lg font-semibold text-white/90">La plateforme gaming d'élite</h2>
        <p className="text-sm text-white/70">
          Recharges, comptes, tournois, GVG, transferts internationaux
        </p>
        <div className="flex flex-wrap gap-3">
          <GlowButton variant="primary" onClick={() => router.push("/shop")}>Explorer la boutique</GlowButton>
          <GlowButton variant="secondary" onClick={() => router.push("/premium")}>
            Devenir Premium
          </GlowButton>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatPill label="Comptes vendus" value="1 234" />
          <StatPill label="Recharges effectuées" value="567" />
          <StatPill label="Membres premium" value="2 100" />
          <StatPill label="Guides actifs" value="185" />
        </div>
      </div>
    </motion.section>
  );
}

function Highlights() {
  return (
    <section className="space-y-4">
      <SectionTitle eyebrow="Stats live" label="BADBOYSHOP en chiffres" />
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Comptes vendus" value="1 234" hint="+64 cette semaine" icon={<Shield className="h-5 w-5" />} glow />
        <StatCard title="Recharges effectuées" value="567" hint="Livraison instantanée" icon={<Zap className="h-5 w-5" />} />
        <StatCard title="Membres premium" value="2 100" hint="Communauté VIP" icon={<Crown className="h-5 w-5" />} />
        <StatCard title="Guides actifs" value="185" hint="Coachs & support" icon={<Flame className="h-5 w-5" />} />
      </div>
    </section>
  );
}

function PopularProducts() {
  return (
    <section className="space-y-4">
      <SectionTitle eyebrow="Populaires" label="Produits les plus populaires" />
      <div className="flex gap-4 overflow-x-auto scrollbar-soft pb-2">
        {products.map((p, idx) => (
          <ProductCard
            key={p.title}
            title={p.title}
            subtitle={p.subtitle}
            price={p.price}
            likes={p.likes}
            tag={p.tag}
            badgeLevel={p.badgeLevel}
            imageSlot={
              p.tag === "Recharges" ? (
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${rechargeBannerUrl})` }} />
              ) : p.tag === "Articles" ? (
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${accessoriesBannerUrl})` }} />
              ) : (
                <div className="h-full w-full bg-gradient-to-r from-cyan-400/20 via-purple-400/10 to-transparent flex items-center justify-center">
                  <span className="text-xs text-white/70">Preview</span>
                </div>
              )
            }
            onLike={() => undefined}
            onAction={() => undefined}
            // slight stagger via transition
          />
        ))}
      </div>
    </section>
  );
}

function PremiumCTA() {
  const router = useRouter();
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="glass-card rounded-3xl p-5 border border-white/10"
    >
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-black grid place-items-center shadow-[0_10px_40px_rgba(251,191,36,0.3)]">
          <Crown className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <PremiumBadge level="Or" />
            <PremiumBadge level="Platine" />
          </div>
          <h3 className="text-xl font-bold">Passe en mode VIP</h3>
          <p className="text-sm text-white/70">
            Cashback BD Wallet, support prioritaire, deals secrets et tournois réservés aux membres.
          </p>
          <div className="flex gap-3">
            <GlowButton variant="primary" onClick={() => router.push("/premium")}>
              Devenir Premium
            </GlowButton>
            <GlowButton variant="ghost" onClick={() => router.push("/premium")}>
              Voir les avantages
            </GlowButton>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/70">
        <div className="flex items-center gap-2"><Rocket className="h-4 w-4 text-cyan-300" /> Boost XP & drops</div>
        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-300" /> Anti-fraude mobile</div>
      </div>
    </motion.section>
  );
}
