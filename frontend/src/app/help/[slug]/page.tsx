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
      <div className="mobile-shell min-h-screen space-y-6 py-6 pb-24">
        <SectionTitle eyebrow="Centre d’aide" label="Sujet introuvable" />
        <div className="glass-card rounded-2xl border border-white/10 p-5">
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
    );
  }

  return (
    <div className="mobile-shell min-h-screen space-y-6 py-6 pb-24">
      <SectionTitle eyebrow="Centre d’aide" label={topic.title} />

      <div className="glass-card rounded-2xl border border-white/10 p-5">
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
            Ouvrir le support
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

      <div className="glass-card rounded-2xl border border-white/10 p-5">
        <div className="text-sm font-semibold text-white">Sujets populaires</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {HELP_TOPICS.filter((t) => t.slug !== topic.slug)
            .slice(0, 4)
            .map((t) => (
              <Link
                key={t.slug}
                href={`/help/${t.slug}`}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:border-white/20"
              >
                {t.title}
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
