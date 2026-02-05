"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { HELP_TOPICS } from "@/lib/helpCenter";

export default function HelpPage() {
  const router = useRouter();

  return (
    <main className="min-h-[100dvh] bg-[#04020c] text-white bg-[radial-gradient(circle_at_top,_#1b0d3f,_#04020c_70%)]">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(180,70,255,0.26),transparent_45%),radial-gradient(circle_at_70%_50%,rgba(0,255,255,0.14),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(255,160,0,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.10),rgba(0,0,0,0.92))]" />
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />
      </div>
      <div className="help-shell space-y-6 py-6 pb-24">
        <SectionTitle eyebrow="Centre d’aide" label="Aide & Support" />

        <div className="rounded-[28px] border border-white/10 bg-black/45 p-5 shadow-[0_25px_80px_rgba(4,6,35,0.55)] backdrop-blur">
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
              🎧 Ouvrir le support VIP
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {HELP_TOPICS.map((topic) => (
            <Link
              key={topic.slug}
              href={`/help/${topic.slug}`}
              className="group block rounded-[28px] border border-white/10 bg-black/40 p-5 shadow-[0_18px_60px_rgba(4,6,35,0.45)] backdrop-blur transition hover:-translate-y-0.5 hover:border-fuchsia-300/40"
            >
              <div className="text-base font-semibold text-white">{topic.title}</div>
              <div className="mt-1 text-sm text-white/60">{topic.summary}</div>
              <div className="mt-3 text-xs text-cyan-200 group-hover:text-cyan-100">Voir →</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
