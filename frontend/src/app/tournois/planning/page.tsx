"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/config";

type PlanningRow = {
  id: number;
  tournament_id: number;
  tournament_name?: string | null;
  tournament_slug?: string | null;
  planning_enabled?: boolean;
  first_match_at?: string | null;
  reward_rules?: string | null;
  planning_notes?: string | null;
  game_player_id?: string | null;
  registered_at?: string | null;
};

type MinePayload = {
  count?: number;
  data?: PlanningRow[];
};

export default function TournamentPlanningPage() {
  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        if (typeof window === "undefined") return;
        const token = window.localStorage.getItem("bbshop_token");
        if (!token) {
          if (active) setError("Connectez-vous pour voir votre planning.");
          return;
        }

        const res = await fetch(`${API_BASE}/tournaments/registrations/mine`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!res.ok) {
          if (active) setError("Impossible de charger votre planning.");
          return;
        }

        const payload = (await res.json().catch(() => null)) as MinePayload | null;
        if (!active) return;
        setRows(Array.isArray(payload?.data) ? payload.data : []);
      } catch {
        if (!active) return;
        setError("Impossible de charger votre planning.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#0c2146_0%,#030712_45%,#02050d_100%)] px-4 pb-24 pt-24 text-white sm:px-6">
      <section className="mx-auto max-w-5xl">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight">Voir Planning</h1>
          <p className="mt-3 text-sm text-white/70 sm:text-base">Retrouvez vos tournois, l'heure du 1er match et les règles de récompense.</p>
        </div>

        {error ? (
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-rose-300/40 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="mt-8 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-white/70">Chargement...</div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-white/70">Aucune inscription trouvée.</div>
          ) : (
            rows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-white/10 bg-[#13233a]/90 p-6 shadow-[0_16px_45px_rgba(1,4,12,0.5)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-extrabold">{row.tournament_name ?? "Tournoi"}</h2>
                    <p className="mt-1 text-xs text-white/60">ID de jeu: {row.game_player_id ?? "—"}</p>
                  </div>
                  {row.tournament_slug ? (
                    <Link href={`/tournois/${row.tournament_slug}`} className="rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/10">
                      Détail tournoi
                    </Link>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">1er match</p>
                    <p className="mt-1 text-sm font-semibold text-white">{row.first_match_at ? new Date(row.first_match_at).toLocaleString("fr-FR") : "À programmer"}</p>
                  </div>
                  <div className="rounded-xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">Planning</p>
                    <p className="mt-1 text-sm font-semibold text-white">{row.planning_enabled ? "Disponible" : "Pas encore disponible"}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl bg-white/10 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Calcul des récompenses</p>
                  <p className="mt-1 text-sm text-white/90 whitespace-pre-line">{row.reward_rules || "Le calcul des récompenses sera communiqué par l'organisateur."}</p>
                </div>

                {row.planning_notes ? (
                  <div className="mt-3 rounded-xl bg-white/10 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/60">Notes</p>
                    <p className="mt-1 text-sm text-white/85 whitespace-pre-line">{row.planning_notes}</p>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
