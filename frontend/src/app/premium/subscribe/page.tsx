"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";
import { API_BASE } from "@/lib/config";

type Game = { id: number; name: string };

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  headers.Accept = "application/json";
  headers["X-Requested-With"] = "XMLHttpRequest";
  return headers;
};

function PremiumSubscribeScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [gameId, setGameId] = useState<string>("");
  const [gameUsername, setGameUsername] = useState<string>("");

  const level = useMemo(() => {
    const raw = String(searchParams.get("level") ?? "bronze").trim().toLowerCase();
    return raw === "platine" ? "platine" : "bronze";
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    setLoadingGames(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/games`, { cache: "no-store" });
        const payload = await res.json().catch(() => null);
        const list: Game[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        if (!active) return;
        setGames(list);
        if (!gameId && list.length) setGameId(String(list[0].id));
      } catch {
        // ignore
      } finally {
        if (active) setLoadingGames(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPayment = useCallback(async () => {
    setStatus(null);
    if (!gameId) {
      setStatus("Choisissez un jeu.");
      return;
    }
    if (!gameUsername.trim()) {
      setStatus("Entrez votre pseudo de jeu.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/premium/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          level: String(level ?? "bronze").toLowerCase(),
          game_id: Number(gameId),
          game_username: gameUsername.trim(),
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(payload?.message ?? "Impossible de lancer le paiement VIP.");
        return;
      }

      const url = String(payload?.payment_url ?? "").trim();
      if (!url) {
        setStatus("Lien de paiement introuvable.");
        return;
      }

      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible de lancer le paiement VIP.";
      setStatus(message || "Impossible de lancer le paiement VIP.");
    } finally {
      setSubmitting(false);
    }
  }, [gameId, gameUsername, level]);

  return (
    <div className="mobile-shell min-h-screen space-y-6 py-6 pb-24">
      <SectionTitle eyebrow="Premium" label="Souscription" />
      <div className="glass-card space-y-4 rounded-2xl border border-white/10 p-6">
        <p className="text-sm text-white/70">Plan: <span className="font-semibold text-white">{level}</span></p>
        <div className="grid gap-3">
          <div>
            <label className="text-sm text-white/70">Jeu</label>
            <select
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              disabled={loadingGames || submitting}
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white"
            >
              {games.map((g) => (
                <option key={g.id} value={String(g.id)} className="text-black">
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-white/70">Pseudo (Game Username)</label>
            <input
              value={gameUsername}
              onChange={(e) => setGameUsername(e.target.value)}
              disabled={submitting}
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-white"
              placeholder="Votre pseudo en jeu"
            />
          </div>
        </div>

        {status ? <p className="text-sm text-amber-200">{status}</p> : null}
        <div className="flex gap-3">
          <GlowButton
            variant="secondary"
            className="flex-1 justify-center"
            onClick={() => router.push("/premium")}
            disabled={submitting}
          >
            Retour
          </GlowButton>
          <GlowButton className="flex-1 justify-center" onClick={startPayment} disabled={submitting || loadingGames}>
            {submitting ? "Paiement..." : "Payer et activer"}
          </GlowButton>
        </div>
      </div>
    </div>
  );
}

export default function PremiumSubscribePage() {
  return (
    <RequireAuth>
      <PremiumSubscribeScreen />
    </RequireAuth>
  );
}
