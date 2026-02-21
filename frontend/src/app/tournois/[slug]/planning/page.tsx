"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/config";

type Tournament = {
  name: string;
  slug: string;
  planning_enabled?: boolean;
  first_match_at?: string | null;
  reward_rules?: string | null;
  planning_notes?: string | null;
};

export default function TournamentSlugPlanningPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [item, setItem] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/tournaments/${encodeURIComponent(slug)}`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) {
          if (active) setItem(null);
          return;
        }
        const payload = (await res.json().catch(() => null)) as Tournament | null;
        if (!active) return;
        setItem(payload);
      } catch {
        if (!active) return;
        setItem(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#0c2146_0%,#030712_45%,#02050d_100%)] px-4 pb-24 pt-24 text-white sm:px-6">
      <section className="mx-auto max-w-3xl">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-white/70">Chargement...</div>
        ) : !item ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-white/70">Planning introuvable.</div>
        ) : (
          <article className="rounded-2xl border border-white/10 bg-[#13233a]/90 p-6 shadow-[0_16px_45px_rgba(1,4,12,0.5)]">
            <h1 className="text-3xl font-black">Planning • {item.name}</h1>
            <p className="mt-2 text-sm text-white/70">Consultez ici les horaires et le calcul des récompenses.</p>

            <div className="mt-5 rounded-xl bg-white/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">1er match</p>
              <p className="mt-1 text-sm font-semibold text-white">{item.first_match_at ? new Date(item.first_match_at).toLocaleString("fr-FR") : "À programmer"}</p>
            </div>

            <div className="mt-4 rounded-xl bg-white/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Calcul des récompenses</p>
              <p className="mt-1 whitespace-pre-line text-sm text-white/90">{item.reward_rules || "Le calcul sera communiqué bientôt."}</p>
            </div>

            {item.planning_notes ? (
              <div className="mt-4 rounded-xl bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Notes</p>
                <p className="mt-1 whitespace-pre-line text-sm text-white/85">{item.planning_notes}</p>
              </div>
            ) : null}

            <div className="mt-6">
              <Link href="/tournois/planning" className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10">
                Voir tous mes plannings
              </Link>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}
