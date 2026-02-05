"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { API_BASE } from "@/lib/config";
import { toDisplayImageSrc } from "@/lib/imageProxy";

type MenuGame = {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  image?: string | null;
};

const parseGamesPayload = (payload: any): MenuGame[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as MenuGame[];
  if (Array.isArray(payload?.data)) return payload.data as MenuGame[];
  if (Array.isArray(payload?.data?.data)) return payload.data.data as MenuGame[];
  return [];
};

export default function AbonnementsIndexPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<MenuGame[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/games?active=1&context=subscription&per_page=200`, {
          headers: { Accept: "application/json" },
        });
        const payload = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) throw new Error(payload?.message ?? "Impossible de charger les jeux");
        setGames(parseGamesPayload(payload));
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? "Impossible de charger");
        setGames([]);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return games;
    return games.filter((g) => String(g?.name ?? "").toLowerCase().includes(needle));
  }, [games, query]);

  return (
    <main className="min-h-[100dvh] bg-[#04020c] text-white bg-[radial-gradient(circle_at_top,_#1b0d3f,_#04020c_70%)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            <Link href="/" className="hover:text-white">
              Accueil
            </Link>
            <span className="text-white/30">/</span>
            <span className="text-white/80">Abonnements</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Abonnements</h1>
          <p className="text-sm text-white/60">Choisis ton jeu pour afficher les abonnements disponibles.</p>
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-black/40 p-4 backdrop-blur">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-white/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un jeu..."
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-10 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-cyan-300/40"
            />
          </div>
        </div>

        {error ? <div className="mt-6 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 9 }).map((_, idx) => (
                <div key={idx} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                  <div className="h-40 rounded-2xl bg-white/10" />
                  <div className="mt-4 h-4 w-2/3 rounded bg-white/10" />
                  <div className="mt-6 h-10 w-full rounded-xl bg-white/10" />
                </div>
              ))
            : filtered.map((g) => {
                const img = g.image ?? g.icon ?? null;
                const imageSrc = img ? (toDisplayImageSrc(img) ?? img) : null;
                return (
                  <Link
                    key={g.id}
                    href={`/abonnements/${encodeURIComponent(String(g.slug))}`}
                    className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-5 transition hover:border-cyan-300/40"
                  >
                    <div className="relative h-40 overflow-hidden rounded-2xl bg-black/30">
                      {imageSrc ? (
                        <>
                          <Image src={imageSrc} alt={g.name} fill className="object-cover opacity-90 transition group-hover:scale-[1.02]" sizes="(min-width: 1024px) 360px, 90vw" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
                        </>
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-cyan-400/10 via-fuchsia-400/10 to-transparent" />
                      )}
                    </div>
                    <div className="mt-4">
                      <p className="text-base font-black text-white">{g.name}</p>
                      <p className="mt-1 text-sm text-white/60">Voir les abonnements</p>
                    </div>
                  </Link>
                );
              })}

          {!loading && !error && filtered.length === 0 ? (
            <div className="col-span-full rounded-[28px] border border-white/10 bg-white/5 p-10 text-center text-white/70">Aucun jeu disponible.</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
