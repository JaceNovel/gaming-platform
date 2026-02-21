"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Trophy, Users } from "lucide-react";
import { API_BASE } from "@/lib/config";

type Tournament = {
  id: number;
  name: string;
  slug: string;
  status: "upcoming" | "live" | "finished";
  description?: string | null;
  image?: string | null;
  prize_pool_fcfa?: number | null;
  entry_fee_fcfa?: number | null;
  is_free?: boolean | null;
  max_participants?: number | null;
  registered_participants?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(value)));

const statusLabel = (status: Tournament["status"]) => {
  if (status === "live") return "En cours";
  if (status === "finished") return "Terminés";
  return "À venir";
};

type FilterKey = "all" | "upcoming" | "live" | "finished";

export default function TournamentsPage() {
  const [items, setItems] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/tournaments?active=1&per_page=60`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const payload = (await res.json().catch(() => null)) as
          | { data?: Tournament[] }
          | null;
        if (!active) return;
        setItems(Array.isArray(payload?.data) ? payload.data : []);
      } catch {
        if (!active) return;
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return items;
    return items.filter((item) => item.status === activeFilter);
  }, [items, activeFilter]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#0c2146_0%,#030712_45%,#02050d_100%)] px-4 pb-24 pt-24 text-white sm:px-6">
      <section className="mx-auto max-w-6xl">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight">Tournois</h1>
          <p className="mt-3 text-sm text-white/70 sm:text-base">
            Participez à des tournois exclusifs et gagnez des prix incroyables
          </p>
        </div>

        <div className="mx-auto mt-8 grid w-full max-w-xl grid-cols-4 rounded-2xl border border-white/10 bg-white/5 p-1">
          {([
            ["all", "Tous"],
            ["upcoming", "À venir"],
            ["live", "En cours"],
            ["finished", "Terminés"],
          ] as Array<[FilterKey, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFilter(key)}
              className={`rounded-xl px-2 py-2 text-sm font-semibold transition ${
                activeFilter === key
                  ? "bg-cyan-500/70 text-white shadow-[0_8px_25px_rgba(6,182,212,0.35)]"
                  : "text-white/65 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
          {filteredItems.length} tournois trouvés
        </p>

        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-[390px] animate-pulse rounded-3xl border border-white/10 bg-white/5" />
              ))
            : filteredItems.map((tournament) => {
                const max = Math.max(1, Number(tournament.max_participants ?? 0));
                const current = Math.min(max, Math.max(0, Number(tournament.registered_participants ?? 0)));
                const percent = Math.round((current / max) * 100);

                return (
                  <article
                    key={tournament.id}
                    className="overflow-hidden rounded-3xl border border-white/12 bg-[#101d33]/90 shadow-[0_16px_45px_rgba(1,4,12,0.5)]"
                  >
                    <div className="relative h-44 w-full">
                      <img
                        src={tournament.image || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80"}
                        alt={tournament.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                      <div className="absolute left-3 top-3 flex items-center gap-2">
                        <span className="rounded-full bg-cyan-500 px-3 py-1 text-[11px] font-bold text-white">Tournoi</span>
                        <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold text-white">{statusLabel(tournament.status)}</span>
                      </div>
                      <div className="absolute right-3 top-3 rounded-full bg-cyan-400 px-3 py-1 text-xs font-black text-slate-900">
                        {formatNumber(Number(tournament.prize_pool_fcfa ?? 0))} FCFA
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      <h2 className="text-2xl font-extrabold">{tournament.name}</h2>
                      <p className="text-sm text-white/70">{tournament.description || "Tournoi compétitif avec cash prize."}</p>

                      <div className="space-y-2 text-sm text-white/85">
                        <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-cyan-300" />{tournament.starts_at ? new Date(tournament.starts_at).toLocaleDateString("fr-FR") : "Date à venir"}</div>
                        <div className="flex items-center gap-2"><Users className="h-4 w-4 text-cyan-300" />{current}/{max} participants</div>
                        <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-cyan-300" />{tournament.is_free ? "Inscription gratuite" : `Frais d'entrée: ${formatNumber(Number(tournament.entry_fee_fcfa ?? 0))} FCFA`}</div>
                      </div>

                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-white/70">
                          <span>Participation</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10">
                          <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${percent}%` }} />
                        </div>
                      </div>

                      <Link
                        href={`/tournois/${tournament.slug}`}
                        className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-500 py-3 text-sm font-bold text-white transition hover:bg-cyan-400"
                      >
                        S'inscrire
                      </Link>
                    </div>
                  </article>
                );
              })}
        </div>

        {!loading && filteredItems.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-white/70">
            Aucun tournoi disponible pour ce filtre.
          </div>
        ) : null}
      </section>
    </main>
  );
}
