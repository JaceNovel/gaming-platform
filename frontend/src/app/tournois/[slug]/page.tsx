"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Users } from "lucide-react";
import { API_BASE } from "@/lib/config";

type TournamentDetails = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  rules?: string | null;
  image?: string | null;
  is_free?: boolean | null;
  entry_fee_fcfa?: number | null;
  prize_pool_fcfa?: number | null;
  first_prize_fcfa?: number | null;
  second_prize_fcfa?: number | null;
  third_prize_fcfa?: number | null;
  max_participants?: number | null;
  registered_participants?: number | null;
  real_registered_participants?: number | null;
};

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(value)));

export default function TournamentDetailsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [item, setItem] = useState<TournamentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "prizes">("overview");
  const [registering, setRegistering] = useState(false);
  const [registerMessage, setRegisterMessage] = useState<string>("");
  const [gamePlayerId, setGamePlayerId] = useState("");

  useEffect(() => {
    if (!slug) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/tournaments/${encodeURIComponent(slug)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          if (active) setItem(null);
          return;
        }
        const payload = (await res.json().catch(() => null)) as TournamentDetails | null;
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

  const participants = useMemo(() => {
    const max = Math.max(1, Number(item?.max_participants ?? 0));
    const current = Math.min(max, Math.max(0, Number(item?.registered_participants ?? 0)));
    const percent = Math.round((current / max) * 100);
    return { current, max, percent };
  }, [item]);

  const handleRegister = async () => {
    if (!item?.id || !slug || registering) return;
    if (typeof window === "undefined") return;

    const normalizedGamePlayerId = gamePlayerId.trim();
    if (!normalizedGamePlayerId) {
      setRegisterMessage("Veuillez entrer votre ID de jeu avant de vous inscrire.");
      return;
    }

    const token = window.localStorage.getItem("bbshop_token");
    if (!token) {
      setRegisterMessage("Connectez-vous pour vous inscrire.");
      return;
    }

    setRegistering(true);
    setRegisterMessage("");

    try {
      const res = await fetch(`${API_BASE}/tournaments/${item.id}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ game_player_id: normalizedGamePlayerId }),
      });

      const payload = (await res.json().catch(() => null)) as { message?: string; registered_participants?: number } | null;

      if (!res.ok) {
        setRegisterMessage(payload?.message ?? "Inscription impossible.");
        return;
      }

      const refresh = await fetch(`${API_BASE}/tournaments/${encodeURIComponent(slug)}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (refresh.ok) {
        const refreshed = (await refresh.json().catch(() => null)) as TournamentDetails | null;
        if (refreshed) setItem(refreshed);
      }
      setRegisterMessage(payload?.message ?? "Inscription confirmée.");
    } catch {
      setRegisterMessage("Inscription impossible.");
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return <main className="min-h-screen bg-[#060b18] px-4 pb-24 pt-24 text-white">Chargement...</main>;
  }

  if (!item) {
    return (
      <main className="min-h-screen bg-[#060b18] px-4 pb-24 pt-24 text-white">
        <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          Tournoi introuvable.
          <div className="mt-4">
            <Link href="/tournois" className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-white">
              Retour aux tournois
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#0c2146_0%,#030712_45%,#02050d_100%)] px-4 pb-24 pt-24 text-white sm:px-6">
      <section className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border border-white/10">
          <img
            src={item.image || "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&q=80"}
            alt={item.name}
            className="h-[300px] w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040a16] via-[#040a16]/55 to-transparent" />
          <div className="absolute bottom-7 left-6 right-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-bold">Tournoi</span>
              <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-bold">Bientôt</span>
            </div>
            <h1 className="text-4xl font-black">{item.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-lg font-semibold">
              <span className="inline-flex items-center gap-2 text-violet-200"><Trophy className="h-5 w-5" />{formatNumber(Number(item.prize_pool_fcfa ?? 0))} FCFA</span>
              <span className="inline-flex items-center gap-2 text-violet-200"><Users className="h-5 w-5" />{participants.current}/{participants.max}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr,0.8fr]">
          <div>
            <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setTab("overview")}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === "overview" ? "bg-violet-500 text-white" : "text-white/70"}`}
              >
                Aperçu
              </button>
              <button
                type="button"
                onClick={() => setTab("prizes")}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === "prizes" ? "bg-violet-500 text-white" : "text-white/70"}`}
              >
                Prix
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-[#13233a]/90 p-6">
              {tab === "overview" ? (
                <>
                  <h2 className="text-3xl font-black">À propos du tournoi</h2>
                  <p className="mt-3 text-white/80">{item.description || "Bataille d'équipes intense"}</p>
                  {item.rules ? <p className="mt-4 text-sm text-white/70">{item.rules}</p> : null}
                </>
              ) : (
                <div className="space-y-3">
                  <h2 className="text-3xl font-black">Répartition des prix</h2>
                  <p className="text-white/80">1ère place: {formatNumber(Number(item.first_prize_fcfa ?? 0))} FCFA</p>
                  <p className="text-white/80">2ème place: {formatNumber(Number(item.second_prize_fcfa ?? 0))} FCFA</p>
                  <p className="text-white/80">3ème place: {formatNumber(Number(item.third_prize_fcfa ?? 0))} FCFA</p>
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-2xl border border-white/12 bg-[#13233a]/95 p-5">
            <h3 className="text-3xl font-black">Inscription au tournoi</h3>
            <div className="mt-4 text-sm text-white/80">
              <div className="mb-2 flex items-center justify-between">
                <span>Participants</span>
                <strong>{participants.current}/{participants.max}</strong>
              </div>
              <div className="h-2 rounded-full bg-white/15">
                <div className="h-2 rounded-full bg-cyan-400" style={{ width: `${participants.percent}%` }} />
              </div>
              <p className="mt-2 text-white/60">{participants.percent}% complet</p>
            </div>

            <div className="mt-4 rounded-xl border border-blue-400/40 bg-blue-500/15 px-4 py-3 text-sm font-semibold text-blue-100">
              Commence aujourd'hui!
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold">
              <span>Frais d'entrée</span>
              <span>{item.is_free ? "Gratuit" : `${formatNumber(Number(item.entry_fee_fcfa ?? 0))} FCFA`}</span>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/60">ID de jeu</label>
              <input
                value={gamePlayerId}
                onChange={(event) => setGamePlayerId(event.target.value)}
                placeholder="Entrez votre ID de jeu"
                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/45"
              />
            </div>

            <button
              type="button"
              onClick={handleRegister}
              disabled={registering}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-400 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {registering ? "Inscription..." : "S'inscrire maintenant"}
            </button>
            {registerMessage ? <p className="mt-2 text-xs text-cyan-100">{registerMessage}</p> : null}

            <div className="mt-6 text-sm text-white/70">
              <h4 className="text-2xl font-black text-white">Comment participer:</h4>
              <ol className="mt-3 list-decimal space-y-1 pl-5">
                <li>Inscrivez-vous {item.is_free ? "gratuitement" : "en payant les frais d'entrée"}</li>
                <li>Attendez le début du tournoi</li>
                <li>Participez aux matchs selon le planning</li>
                <li>Gagnez des prix selon votre classement</li>
              </ol>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
