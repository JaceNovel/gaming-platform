"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { HELP_TOPICS } from "@/lib/helpCenter";

export default function HelpPage() {
  const router = useRouter();

  return (
    <div className="mobile-shell min-h-screen space-y-6 py-6 pb-24">
      <SectionTitle eyebrow="Centre d’aide" label="Aide & Support" />

      <div className="glass-card rounded-2xl border border-white/10 p-5">
        <p className="text-sm text-white/70">
          Besoin d’aide ? Consulte les sujets ci-dessous ou ouvre le support (bulle en bas à droite).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <GlowButton
            className="flex-1 justify-center"
            onClick={() => {
              import("@/lib/tidioChat").then(({ openTidioChat }) => {
                void openTidioChat({ message: "Bonjour, j’ai besoin d’aide." });
              });
            }}
          >
            Ouvrir le support
          </GlowButton>
          <GlowButton
            variant="secondary"
            className="flex-1 justify-center"
            onClick={() => router.push("/shop")}
          >
            Retour boutique
          </GlowButton>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {HELP_TOPICS.map((topic) => (
          <Link
            key={topic.slug}
            href={`/help/${topic.slug}`}
            className="glass-card block rounded-2xl border border-white/10 p-5 transition hover:border-white/20"
          >
            <div className="text-base font-semibold text-white">{topic.title}</div>
            <div className="mt-1 text-sm text-white/60">{topic.summary}</div>
            <div className="mt-3 text-xs text-cyan-200">Voir →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
