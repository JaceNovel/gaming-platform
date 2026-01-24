"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Shield, Zap } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import GlowButton from "@/components/ui/GlowButton";
import PremiumBadge from "@/components/ui/PremiumBadge";
import SectionTitle from "@/components/ui/SectionTitle";

const premiumPlans = [
  {
    level: "Bronze",
    price: 6000,
    color: "from-amber-700/70 via-amber-500/60 to-orange-400/60",
    accent: "from-amber-400/40 via-orange-400/20 to-transparent",
    badge: "Bronze" as const,
    bannerUrl: "https://afhomes.com.ph/wp-content/uploads/2024/12/Introducing-the-Bronze-VIP-MembershipHeader.png",
    perks: ["110D cash offert", "Accès premium de base", "Accès anticipé aux promos", "Récompense fidélité 3 mois"],
    headline: "Starter Pro",
  },
  {
    level: "Or",
    price: 10000,
    color: "from-yellow-300 via-amber-200 to-orange-200",
    accent: "from-yellow-300/40 via-amber-200/30 to-transparent",
    badge: "Or" as const,
    bannerUrl: "https://img.freepik.com/free-vector/black-vip-card-golden-badge_107988-203.jpg?size=626&ext=jpg",
    perks: [
      "Abonnement weekly",
      "-5% recharges & abonnements",
      "-10% articles gaming",
      "Accès marché partenaire",
      "Parrainage activé",
    ],
    featured: true,
    headline: "Gold Elite",
  },
  {
    level: "Platine",
    price: 13000,
    color: "from-cyan-300 via-sky-200 to-blue-200",
    accent: "from-cyan-300/45 via-sky-200/30 to-transparent",
    badge: "Platine" as const,
    bannerUrl: "https://img.freepik.com/premium-vector/vip-invitation-with-golden-typography_53562-12790.jpg",
    perks: ["Abonnement mensuel", "Badge partenaire bleu", "API partenaire", "Support prioritaire WhatsApp", "Anti-fraude renforcée"],
    headline: "Platinum Apex",
  },
];

const comparison = [
  { feature: "Cashback BD Wallet", bronze: "1%", gold: "3%", platinum: "5%" },
  { feature: "Support prioritaire", bronze: "Email", gold: "WhatsApp", platinum: "WhatsApp 24/7" },
  { feature: "Réductions boutique", bronze: "-2%", gold: "-8%", platinum: "-12%" },
  { feature: "Conciergerie évènementielle", bronze: "Basique", gold: "Prioritaire", platinum: "Élite" },
];

const faqs = [
  {
    q: "Un ID erroné est-il remboursé ?",
    a: "Non. Toute erreur d'ID/compte invalide annule la livraison et n'est pas remboursable.",
  },
  {
    q: "Puis-je changer de plan ?",
    a: "Oui, l'upgrade est possible à tout moment et prend effet immédiatement.",
  },
  {
    q: "Combien de temps pour l'activation ?",
    a: "Généralement instantané, maximum 5 minutes selon la charge.",
  },
];

export default function Premium() {
  const { token } = useAuth();
  const router = useRouter();
  const [showPrompt, setShowPrompt] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const requestSubscribe = (level: string) => {
    if (!token) {
      setShowPrompt(true);
      return;
    }
    router.push(`/premium/subscribe?level=${encodeURIComponent(level)}`);
  };

  return (
    <div className="min-h-[100dvh] pb-24">
      <div className="w-full py-10">
        <div className="w-full px-5 sm:px-8 lg:px-16 xl:px-24 2xl:px-32 space-y-10">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 text-black grid place-items-center shadow-[0_10px_30px_rgba(251,191,36,0.35)]">
                <Crown className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-200/80">Programme premium</p>
                <h1 className="text-3xl lg:text-4xl font-black neon-text">Gamers BADBOY VIP</h1>
                <p className="text-sm text-white/60 max-w-2xl">Pass VIP, cashback et support ultra rapide.</p>
              </div>
            </div>
            <GlowButton variant="primary" className="px-5 py-3">
              Devenir Premium
            </GlowButton>
          </header>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-6 border border-white/10"
          >
            <SectionTitle eyebrow="Avantages" label="Des perks qui paient" />
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/70 lg:grid-cols-4">
              <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-300" /> Anti-fraude mobile</div>
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-cyan-300" /> Livraisons express</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-300" /> Cashback BD Wallet</div>
              <div className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-300" /> Support prioritaire</div>
            </div>
          </motion.div>

          <div className="space-y-4">
            <SectionTitle eyebrow="Plans" label="Choisis ton niveau" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {premiumPlans.map((plan, idx) => (
                <motion.div
                  key={plan.level}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`relative overflow-hidden rounded-3xl border border-white/10 glass-card ${
                    plan.featured ? "shadow-[0_18px_50px_rgba(244,206,106,0.3)]" : ""
                  }`}
                >
                  <div
                    className={`h-40 w-full bg-gradient-to-br ${plan.color} relative ${
                      plan.bannerUrl ? "bg-cover bg-center" : ""
                    }`}
                    style={plan.bannerUrl ? { backgroundImage: `url(${plan.bannerUrl})` } : undefined}
                  >
                    {plan.bannerUrl && <div className="absolute inset-0 bg-black/45" />}
                    <div className={`absolute inset-0 bg-gradient-to-r ${plan.accent}`} />
                    <div className="absolute left-6 top-6 flex items-center gap-2">
                      <PremiumBadge level={plan.badge} />
                      {plan.featured && (
                        <span className="text-xs px-2 py-1 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/30">
                          Populaire
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-5 left-6">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/70">{plan.headline}</p>
                      <h3 className="text-2xl font-black text-white">{plan.level}</h3>
                    </div>
                  </div>
                  <div className="relative p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white/70">{plan.price.toLocaleString()} FCFA / mois</p>
                      <span className="text-xs text-white/50">Accès VIP</span>
                    </div>
                    <ul className="space-y-2 text-sm text-white/80">
                      {plan.perks.map((perk) => (
                        <li key={perk} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-300" />
                          {perk}
                        </li>
                      ))}
                    </ul>
                    <GlowButton
                      variant={plan.featured ? "primary" : "secondary"}
                      className="w-full justify-center"
                      onClick={() => requestSubscribe(plan.level)}
                    >
                      S'abonner
                    </GlowButton>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <section className="rounded-3xl p-6 border border-white/10 bg-gradient-to-br from-white/5 via-transparent to-cyan-400/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <SectionTitle eyebrow="Comparatif" label="Arsenal d'avantages" />
            <p className="mt-2 text-sm text-white/70 max-w-3xl">
              Parrainage : gagne 3% de la somme rechargée par chaque personne que tu invites. Les gains sont crédités
              sur ton BD Wallet (Mon compte).
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr,3fr]">
              <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
                <p className="text-xs uppercase tracking-[0.25em] text-white/50">Niveaux</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-sm text-white/70">Bronze</span>
                    <span className="text-xs text-amber-200">Starter</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-sm text-white/70">Or</span>
                    <span className="text-xs text-yellow-200">Elite</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-sm text-white/70">Platine</span>
                    <span className="text-xs text-cyan-200">Apex</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {comparison.map((row) => (
                  <div key={row.feature} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold text-white">{row.feature}</p>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-amber-200">
                        {row.bronze}
                      </div>
                      <div className="rounded-xl border border-white/10 bg-gradient-to-r from-yellow-400/15 to-amber-300/10 px-3 py-2 text-yellow-200">
                        {row.gold}
                      </div>
                      <div className="rounded-xl border border-white/10 bg-gradient-to-r from-cyan-400/15 to-blue-400/10 px-3 py-2 text-cyan-200">
                        {row.platinum}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="glass-card rounded-2xl p-6 border border-white/10">
              <SectionTitle eyebrow="Preview" label="Avant / Après" />
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Sans Premium</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/10 grid place-items-center text-white/60">A</div>
                    <div>
                      <p className="text-lg font-semibold">Astral10M</p>
                      <p className="text-xs text-white/50">Support standard • Badge gris</p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-white/50">K/D: 1.4 • Rank: Silver</div>
                </div>
                <div className="rounded-2xl bg-gradient-to-r from-cyan-400/20 via-purple-400/15 to-transparent border border-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Premium activé</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 text-black grid place-items-center shadow-[0_10px_30px_rgba(110,231,255,0.35)]">
                      A
                    </div>
                    <div>
                      <p className="text-lg font-black text-cyan-200">Astral10M ✦ APEX</p>
                      <p className="text-xs text-white/70">Badge néon • Support VIP • Cashback actif</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/70">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">K/D: 2.9</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">Rank: Mythic</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">VIP+</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6 border border-white/10">
              <SectionTitle eyebrow="FAQ" label="Questions fréquentes" />
              <div className="mt-4 space-y-3">
                {faqs.map((item, idx) => (
                  <button
                    key={item.q}
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full text-left rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <p className="font-semibold text-sm text-white">{item.q}</p>
                    {openFaq === idx && <p className="mt-2 text-sm text-white/60">{item.a}</p>}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-2xl p-4 border border-white/10"
          >
            <h3 className="font-bold mb-2">Règle anti-fraude</h3>
            <p className="text-sm text-white/70">
              1 ID de jeu = 1 membre premium. Tentative de doublon : refus automatique et alerte sécurité.
            </p>
          </motion.div>
        </div>

        {showPrompt && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl p-5 w-full max-w-sm border border-white/10 space-y-3">
              <h3 className="text-lg font-bold">Connecte-toi pour t'abonner</h3>
              <p className="text-sm text-white/70">La souscription Premium nécessite un compte.</p>
              <div className="flex gap-3">
                <GlowButton
                  className="flex-1 justify-center"
                  onClick={() => router.push(`/auth/login?next=${encodeURIComponent("/premium")}`)}
                >
                  Connexion
                </GlowButton>
                <GlowButton
                  variant="secondary"
                  className="flex-1 justify-center"
                  onClick={() => router.push(`/auth/register?next=${encodeURIComponent("/premium")}`)}
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
      </div>
    </div>
  );
}