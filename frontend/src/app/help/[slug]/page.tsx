"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { getHelpTopic, HELP_TOPICS } from "@/lib/helpCenter";

export default function HelpTopicPage() {
  const router = useRouter();
  const params = useParams();
  const slug = String((params as any)?.slug ?? "");

  const topic = useMemo(() => getHelpTopic(slug), [slug]);

  if (!topic) {
    return (
      <main className="min-h-[100dvh] bg-[#04020c] text-white bg-[radial-gradient(circle_at_top,_#1b0d3f,_#04020c_70%)]">
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(180,70,255,0.26),transparent_45%),radial-gradient(circle_at_70%_50%,rgba(0,255,255,0.14),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(255,160,0,0.10),transparent_55%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.10),rgba(0,0,0,0.92))]" />
          <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />
        </div>
        <div className="help-shell space-y-6 py-6 pb-24">
          <SectionTitle eyebrow="Centre d’aide" label="Sujet introuvable" />
          <div className="rounded-[28px] border border-white/10 bg-black/45 p-5 shadow-[0_25px_80px_rgba(4,6,35,0.55)] backdrop-blur">
            <p className="text-sm text-white/70">Ce sujet n’existe pas.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <GlowButton className="flex-1 justify-center" onClick={() => router.back()}>
                Retour
              </GlowButton>
              <GlowButton
                variant="secondary"
                className="flex-1 justify-center"
                onClick={() => router.push("/help")}
              >
                Voir tous les sujets
              </GlowButton>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#04020c] text-white bg-[radial-gradient(circle_at_top,_#1b0d3f,_#04020c_70%)]">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(180,70,255,0.26),transparent_45%),radial-gradient(circle_at_70%_50%,rgba(0,255,255,0.14),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(255,160,0,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.10),rgba(0,0,0,0.92))]" />
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />
      </div>
      <div className="help-shell space-y-6 py-6 pb-24">
        <SectionTitle eyebrow="Centre d’aide" label={topic.title} />

        <div className="rounded-[28px] border border-white/10 bg-black/45 p-5 shadow-[0_25px_80px_rgba(4,6,35,0.55)] backdrop-blur">
          <p className="text-sm text-white/70">{topic.summary}</p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-white/80">
            {topic.bullets.map((b, idx) => (
              <li key={idx}>{b}</li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            <GlowButton
              className="flex-1 justify-center"
              onClick={() => {
                import("@/lib/tidioChat").then(({ openTidioChat }) => {
                  void openTidioChat({ message: `Bonjour, j’ai besoin d’aide sur: ${topic.title}.` });
                });
              }}
            >
              🎧 Ouvrir le support VIP
            </GlowButton>
            <GlowButton
              variant="secondary"
              className="flex-1 justify-center"
              onClick={() => router.push("/help")}
            >
              Autres sujets
            </GlowButton>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-black/40 p-5 shadow-[0_18px_60px_rgba(4,6,35,0.45)] backdrop-blur">
          <div className="text-sm font-semibold text-white">Sujets populaires</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {HELP_TOPICS.filter((t) => t.slug !== topic.slug)
              .slice(0, 4)
              .map((t) => (
                <Link
                  key={t.slug}
                  href={`/help/${t.slug}`}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:border-fuchsia-300/30 hover:bg-white/7"
                >
                  {t.title}
                </Link>
              ))}
          </div>
        </div>
      </div>
    </main>
  );
}
