"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import GlowButton from "@/components/ui/GlowButton";

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
      ring: "ring-amber-300/25",
      border: "border-amber-300/35",
      glow: "shadow-[0_18px_60px_rgba(251,191,36,0.20)]",
      gradient: "from-amber-500/18 via-orange-400/10 to-transparent",
      accent: "text-amber-100",
      button: "from-amber-300 via-orange-400 to-fuchsia-300",
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
      ring: "ring-cyan-300/25",
      border: "border-cyan-300/35",
      glow: "shadow-[0_18px_70px_rgba(56,189,248,0.22)]",
      gradient: "from-cyan-500/18 via-indigo-500/10 to-transparent",
      accent: "text-cyan-100",
      button: "from-cyan-300 via-fuchsia-300 to-violet-300",
    },
  },
];

const galaxyTexture = "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=2000&q=80";

const cutCorners =
  "polygon(18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px), 0 18px)";

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
        className="relative isolate overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(61,25,120,0.38), rgba(5,85,151,0.22)), url(${galaxyTexture})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.45),transparent_46%),radial-gradient(circle_at_80%_0%,rgba(217,70,239,0.24),transparent_45%),radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.22),transparent_40%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-[#040016]" />

        <div className="relative z-10 mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-cyan-200 ring-1 ring-white/15 shadow-[0_14px_45px_rgba(99,102,241,0.35)]">
              <Crown className="h-7 w-7" />
            </div>
            <p className="mt-6 text-xs uppercase tracking-[0.45em] text-white/70">Premium</p>
            <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
              <span className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-violet-200 bg-clip-text text-transparent">Update Plan</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/70">
              Choisis ton plan VIP pour débloquer des avantages, un support prioritaire et des offres réservées.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <GlowButton className="px-6" onClick={() => requestSubscribe("bronze")}>Mettre à jour maintenant</GlowButton>
              <button
                type="button"
                onClick={() => router.push("/premium/subscribe?level=Platine")}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/85 hover:bg-white/10"
              >
                Voir Platine
              </button>
            </div>
          </motion.div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <div
              className="relative overflow-hidden border border-white/10 bg-white/5 p-[1px] backdrop-blur-2xl"
              style={{ clipPath: cutCorners }}
            >
              <div
                className="h-full bg-black/55 p-6"
                style={{ clipPath: cutCorners }}
              >
                <div className="flex items-center gap-2 text-white/80">
                  <Sparkles className="h-4 w-4 text-cyan-200" />
                  <span className="text-xs uppercase tracking-[0.35em]">Avantages</span>
                </div>
                <h2 className="mt-4 text-xl font-black">Boost sur chaque achat</h2>
                <p className="mt-2 text-sm text-white/70">Réductions, cashback, support prioritaire et accès à des offres partenaires.</p>
                <div className="mt-5 grid gap-3">
                  {[
                    "Anti-fraude renforcée",
                    "Livraison express",
                    "Cashback DB Wallet",
                    "Support prioritaire",
                  ].map((label) => (
                    <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <Check className="h-4 w-4 text-cyan-200" />
                      <span className="text-sm text-white/80">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 grid gap-6 md:grid-cols-2">
              {premiumPlans.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  whileHover={{ y: -8 }}
                  className={`relative overflow-hidden border bg-gradient-to-br ${plan.theme.gradient} ${plan.theme.border} ${plan.theme.glow} p-[1px] backdrop-blur-2xl ${plan.theme.ring}`}
                  style={{ clipPath: cutCorners }}
                >
                  <div className="h-full bg-black/60 px-6 py-7" style={{ clipPath: cutCorners }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-white/55">Plan</p>
                        <h3 className="mt-1 text-3xl font-black text-white">{plan.name}</h3>
                        <p className={`mt-2 text-xs uppercase tracking-[0.35em] ${plan.theme.accent}`}>{plan.billing}</p>
                      </div>
                      {plan.badge ? (
                        <span className="rounded-full border border-amber-300/35 bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-100">
                          {plan.badge}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm text-white/60">Prix</p>
                        <p className="mt-1 text-3xl font-black text-white">{plan.price}</p>
                      </div>
                      <button
                        onClick={() => requestSubscribe(plan.name)}
                        className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-r ${plan.theme.button} px-5 py-3 text-sm font-semibold text-black shadow-[0_14px_40px_rgba(0,0,0,0.45)] hover:opacity-95`}
                      >
                        Mettre à jour
                      </button>
                    </div>

                    <ul className="mt-6 space-y-3 text-left text-sm text-white/80">
                      {plan.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 text-cyan-200" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
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