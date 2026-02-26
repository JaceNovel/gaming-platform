"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";

const formatCountdown = (remainingMs: number): string => {
  if (remainingMs <= 0) return "00j 00h 00m 00s";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(days)}j ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
};

export default function RamadanOverlay({
  hasTournaments,
  hasRegisteredTournament,
}: {
  hasTournaments: boolean;
  hasRegisteredTournament: boolean;
}) {
  const starsRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [endsAt, setEndsAt] = useState<number>(0);
  const [winnerNames, setWinnerNames] = useState<{ first: string; second: string; third: string }>({
    first: "",
    second: "",
    third: "",
  });
  const [tournamentName, setTournamentName] = useState("");
  const [remaining, setRemaining] = useState(0);

  const isExpired = remaining <= 0;

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/tournaments/ramadan-winners`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const payload = (await res.json().catch(() => null)) as
          | {
              active?: boolean;
              expires_at?: string;
              tournament?: { name?: string };
              winners?: Array<{ place?: number; name?: string }>;
            }
          | null;

        if (!active) return;

        if (!res.ok || !payload?.active || !payload?.expires_at) {
          setVisible(false);
          return;
        }

        const expiry = new Date(payload.expires_at).getTime();
        if (!Number.isFinite(expiry) || expiry <= Date.now()) {
          setVisible(false);
          return;
        }

        const findName = (place: number) =>
          String(payload?.winners?.find((winner) => Number(winner?.place ?? 0) === place)?.name ?? "").trim();

        setWinnerNames({
          first: findName(1),
          second: findName(2),
          third: findName(3),
        });
        setTournamentName(String(payload?.tournament?.name ?? "").trim());
        setEndsAt(expiry);
        setRemaining(Math.max(0, expiry - Date.now()));
        setVisible(true);
      } catch {
        if (active) setVisible(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!visible || !endsAt) return;
    document.body.style.overflow = "hidden";
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, endsAt - Date.now()));
    }, 1000);
    return () => {
      window.clearInterval(timer);
      document.body.style.overflow = "";
    };
  }, [endsAt, visible]);

  useEffect(() => {
    if (!visible || isExpired) return;
    const starsContainer = starsRef.current;
    if (!starsContainer) return;

    starsContainer.innerHTML = "";
    for (let index = 0; index < 140; index += 1) {
      const star = document.createElement("span");
      star.className = "ramadan-star";
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.width = `${Math.random() * 2.3 + 1}px`;
      star.style.height = star.style.width;
      star.style.animationDuration = `${Math.random() * 4 + 2.5}s`;
      star.style.animationDelay = `${Math.random() * 3}s`;
      star.style.opacity = `${Math.random() * 0.7 + 0.2}`;
      starsContainer.appendChild(star);
    }
  }, [visible, isExpired]);

  const countdown = useMemo(() => formatCountdown(remaining), [remaining]);

  if (!visible || isExpired) return null;

  const closeOverlay = () => {
    document.body.style.overflow = "";
    setVisible(false);
  };

  return (
    <div className="ramadan-overlay" role="dialog" aria-modal="true" aria-label="Message Ramadan">
      <div className="ramadan-stars" ref={starsRef} aria-hidden="true" />
      <div className="ramadan-vignette" aria-hidden="true" />
      <div className="ramadan-moon" aria-hidden="true" />

      <div className="ramadan-content">
        <h1>Bonne fête de Ramadan</h1>
        <p>Félicitations aux gagnants du tournoi Ramadan</p>
        {tournamentName ? <p className="ramadan-countdown">{tournamentName}</p> : null}
        <p className="ramadan-countdown">1er: {winnerNames.first || "—"} • 2e: {winnerNames.second || "—"} • 3e: {winnerNames.third || "—"}</p>
        <p className="ramadan-countdown">Disparaît dans {countdown}</p>

        <div className="ramadan-actions">
          {hasRegisteredTournament ? (
            <Link href="/tournois/planning" className="ramadan-btn ramadan-btn-secondary" onClick={closeOverlay}>
              Voir Planning
            </Link>
          ) : hasTournaments ? (
            <Link href="/tournois" className="ramadan-btn ramadan-btn-secondary" onClick={closeOverlay}>
              Participer au Tournois
            </Link>
          ) : null}
          <button type="button" className="ramadan-btn ramadan-btn-primary" onClick={closeOverlay}>
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}
