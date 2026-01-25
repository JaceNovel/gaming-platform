"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Shield, Zap } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import GlowButton from "@/components/ui/GlowButton";

const perksHighlights = [
  { icon: Shield, label: "Anti-fraude renforcée" },
  { icon: Zap, label: "Livraisons express" },
  { icon: Check, label: "Cashback BD Wallet" },
  { icon: Check, label: "Support prioritaire" },
];

const premiumPlans = [
  {
    id: "bronze",
    name: "Bronze",
    price: "10,000 FCFA",
    billing: "Abonnement weekly",
    badge: "Populaire",
    perks: [
      "Abonnement weekly",
      "-5% recharges & abonnements",
      "-10% articles gaming",
      "Accès marché partenaire",
      "Parrainage activé (gagner 3% sur les recharges du client parrain)",
    ],
    theme: {
      border: "border-amber-300/70",
      glow: "shadow-[0_25px_80px_rgba(251,191,36,0.35)]",
      gradient: "from-amber-500/20 via-orange-400/10 to-transparent",
      accent: "text-amber-100",
      button: "from-amber-400 to-orange-400",
    },
  },
  {
    id: "platine",
    name: "Platine",
    price: "13,000 FCFA",
    billing: "Abonnement mensuel",
    perks: [
      "Abonnement mensuel",
      "Badge partenaire bleu",
      "API partenaire",
      "Support prioritaire WhatsApp",
      "Anti-fraude renforcée",
    ],
    theme: {
      border: "border-cyan-300/70",
      glow: "shadow-[0_25px_90px_rgba(56,189,248,0.35)]",
      gradient: "from-cyan-500/25 via-indigo-500/10 to-transparent",
      accent: "text-cyan-100",
      button: "from-cyan-400 to-blue-500",
    },
  },
];

const galaxyTexture = "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=2000&q=80";

export default function Premium() {
  const { token } = useAuth();
  const router = useRouter();
  const [showPrompt, setShowPrompt] = useState(false);

  const requestSubscribe = (level: string) => {
    if (!token) {
      setShowPrompt(true);
      return;
    }
    router.push(`/premium/subscribe?level=${encodeURIComponent(level)}`);
  };

  return (
    <div className="min-h-[100dvh] bg-[#040016] text-white">
      <div
        className="relative isolate overflow-hidden bg-gradient-to-b from-[#140934] via-[#05031c] to-[#01000c]"
        style={{ backgroundImage: `linear-gradient(135deg, rgba(61,25,120,0.35), rgba(5,85,151,0.25)), url(${galaxyTexture})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.4),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.35),transparent_40%)]" />
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-5 py-16 text-center sm:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-cyan-200 shadow-[0_12px_40px_rgba(99,102,241,0.4)]">
              <Crown className="h-7 w-7" />
            </div>
            <p className="mt-6 text-xs uppercase tracking-[0.45em] text-cyan-200/80">Programme premium</p>
            <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
              Passe au niveau supérieur avec <span className="text-cyan-200">BADBOY VIP</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/70">
              Accès anticipé aux promos, cashback et plus encore réservé aux Gamers BADBOY VIP.
            </p>
            <GlowButton className="mx-auto mt-6 px-6" onClick={() => requestSubscribe("bronze")}>
              Découvrir les abonnements
            </GlowButton>
          </motion.div>

          <div className="mt-12 w-full space-y-8 rounded-[40px] border border-white/10 bg-white/5/10 p-6 backdrop-blur-2xl lg:space-y-0 lg:p-10">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-[32px] border border-white/10 bg-white/5 p-6 text-left shadow-[0_20px_60px_rgba(5,6,35,0.45)]"
              >
                <p className="text-xs uppercase tracking-[0.4em] text-cyan-200/70">Des perks qui paient</p>
                <h3 className="mt-3 text-2xl font-bold">Boost garanti sur chaque recharge</h3>
                <p className="mt-2 text-sm text-white/70">
                  Pensé pour les vendeurs sérieux : plus de protection, plus de cash, plus de vitesse.
                </p>
                <div className="mt-5 space-y-3">
                  {perksHighlights.map((perk) => (
                    <div key={perk.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <perk.icon className="h-4 w-4 text-cyan-200" />
                      <span className="text-sm text-white/80">{perk.label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <div className="grid gap-6 md:grid-cols-2">
                {premiumPlans.map((plan, index) => (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -10, boxShadow: "0px 30px 80px rgba(14,165,233,0.4)" }}
                    className={`group relative overflow-hidden rounded-[32px] border bg-gradient-to-br ${plan.theme.gradient} ${plan.theme.border} ${plan.theme.glow} p-[1px] backdrop-blur-2xl`}
                  >
                    <div className="h-full rounded-[30px] bg-black/60 px-6 py-7">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.4em] text-white/50">Plan</p>
                          <h3 className="text-3xl font-black text-white">{plan.name}</h3>
                        </div>
                        {plan.badge && (
                          <span className="rounded-full border border-amber-300/40 bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-100">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <div className="mt-6">
                        <p className={`text-sm uppercase tracking-[0.3em] ${plan.theme.accent}`}>{plan.billing}</p>
                        <p className="mt-2 text-3xl font-black text-white">{plan.price}</p>
                      </div>
                      <ul className="mt-6 space-y-3 text-left text-sm text-white/80">
                        {plan.perks.map((perk) => (
                          <li key={perk} className="flex items-start gap-2">
                            <Check className="mt-1 h-4 w-4 text-cyan-200" />
                            <span>{perk}</span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => requestSubscribe(plan.name)}
                        className={`mt-8 w-full rounded-full bg-gradient-to-r ${plan.theme.button} px-5 py-3 text-sm font-semibold text-black shadow-[0_15px_40px_rgba(0,0,0,0.45)] transition duration-200 group-hover:shadow-[0_25px_70px_rgba(0,0,0,0.55)]`}
                      >
                        S'abonner
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {showPrompt && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm space-y-3 rounded-2xl border border-white/10 bg-[#0b0b18] p-5">
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
              <button onClick={() => setShowPrompt(false)} className="w-full text-sm text-white/50 hover:text-white">
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}