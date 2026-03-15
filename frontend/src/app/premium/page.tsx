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
    ceiling: "Gagnez 30 000 FCFA",
    billing: "Programme partenaire",
    badge: "Populaire",
    perks: [
      "Abonnement weekly",
      "-5% recharge & abonnements",
      "-15% articles gaming",
      "Parrainage (gagnez 10% sur l'achat payé par tes filleuls.)",
    ],
    requirements: [
      "Créer des vidéos autour de PRIMEgaming.space ou Kingleague.space",
      "Promouvoir l'application PRIME Gaming sur le Play Store",
      "Publier sur YouTube, Instagram et si possible WhatsApp",
      "1 à 2 vidéos par semaine",
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
    ceiling: "Gagnez 100.000 FCFA",
    billing: "Programme partenaire expert",
    perks: [
      "Abonnement Weekly",
      "-8% recharge & abonnements",
      "-25% articles gaming",
      "Parrainage (gagnez 18% sur l'achat payé par tes filleuls.)",
    ],
    requirements: [
      "Avoir 10 000+ abonnés ou membres sur TikTok, Instagram, Discord ou équivalent",
      "Publier régulièrement du contenu vidéo à forte visibilité",
      "Respecter toutes les directives PRIME Gaming et KING League",
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
  const { token, user } = useAuth();
  const router = useRouter();
  const [showPrompt, setShowPrompt] = useState(false);

  const currentLevel = String(user?.premium_level ?? "").trim().toLowerCase();
  const vipActive = Boolean(user?.is_premium) && currentLevel !== "";

  const requestSubscribe = (level: string) => {
    if (!token) {
      setShowPrompt(true);
      return;
    }
    if (vipActive && currentLevel === String(level).toLowerCase()) {
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
              <span className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-violet-200 bg-clip-text text-transparent">Programme Premium Créateurs</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/70">
              Le programme Premium n'est plus payant. Dépose une demande et attends la validation admin pour rejoindre PRIME Gaming et KING League.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <GlowButton className="px-6" onClick={() => (vipActive ? router.push("/account") : requestSubscribe("bronze"))}>
                {vipActive ? "Voir mon plan" : "Demande"}
              </GlowButton>
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
                  <span className="text-xs uppercase tracking-[0.35em]">Validation Admin</span>
                </div>
                <h2 className="mt-4 text-xl font-black">Créateurs, ambassadeurs et partenaires</h2>
                <p className="mt-2 text-sm text-white/70">Les demandes sont examinées par l'admin. En cas d'acceptation, tu reçois les directives officielles et un certificat de partenariat.</p>
                <div className="mt-5 grid gap-3">
                  {[
                    "Validation ou refus depuis l'admin",
                    "PDF de directives à l'acceptation",
                    "Certificat de partenariat PRIME Gaming x KING League",
                    "Refus avec récapitulatif des conditions manquantes",
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
              {premiumPlans.map((plan, index) => {
                const isCurrent = vipActive && currentLevel === String(plan.id).toLowerCase();
                return (
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

                      <div className="mt-5">
                        <p className="text-sm text-white/60">Potentiel</p>
                        <p className="mt-1 text-[clamp(0.88rem,3vw,1.5rem)] font-black text-white whitespace-nowrap">{plan.ceiling}</p>
                      </div>

                      <ul className="mt-6 space-y-3 text-left text-sm text-white/80">
                        {plan.perks.map((perk) => (
                          <li key={perk} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 text-cyan-200" />
                            <span>{perk}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-6 border-t border-white/10 pt-4">
                        <p className="text-xs uppercase tracking-[0.35em] text-white/50">Conditions</p>
                        <ul className="mt-3 space-y-2 text-xs text-white/70">
                          {plan.requirements.map((requirement) => (
                            <li key={requirement} className="flex items-start gap-2">
                              <Check className="mt-0.5 h-3.5 w-3.5 text-cyan-200" />
                              <span>{requirement}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        onClick={() => requestSubscribe(plan.id)}
                        disabled={isCurrent}
                        className={`mt-6 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold shadow-[0_14px_40px_rgba(0,0,0,0.45)] hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                          isCurrent ? "bg-white/10 text-white" : `bg-gradient-to-r ${plan.theme.button} text-black`
                        }`}
                      >
                        {isCurrent ? "Plan actuel" : "Demande"}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {showPrompt && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm space-y-3 rounded-2xl border border-white/10 bg-[#0b0b18] p-5">
              <h3 className="text-lg font-bold">Connecte-toi pour t'abonner</h3>
              <p className="text-sm text-white/70">La demande Premium nécessite un compte.</p>
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