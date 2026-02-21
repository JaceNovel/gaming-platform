"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const RAMADAN_END_AT = new Date("2027-03-05T23:59:59").getTime();
const DISMISS_KEY = "ramadan-overlay-dismissed-v1";

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
}: {
  hasTournaments: boolean;
}) {
  const starsRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [remaining, setRemaining] = useState(() => Math.max(0, RAMADAN_END_AT - Date.now()));

  const isExpired = remaining <= 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    const shouldShow = !dismissed && Date.now() < RAMADAN_END_AT;
    setVisible(shouldShow);
  }, []);

  useEffect(() => {
    if (!visible) return;
    document.body.style.overflow = "hidden";
    const timer = window.setInterval(() => {
      setRemaining(Math.max(0, RAMADAN_END_AT - Date.now()));
    }, 1000);
    return () => {
      window.clearInterval(timer);
      document.body.style.overflow = "";
    };
  }, [visible]);

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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
      document.body.style.overflow = "";
    }
    setVisible(false);
  };

  return (
    <div className="ramadan-overlay" role="dialog" aria-modal="true" aria-label="Message Ramadan">
      <div className="ramadan-stars" ref={starsRef} aria-hidden="true" />
      <div className="ramadan-vignette" aria-hidden="true" />
      <div className="ramadan-moon" aria-hidden="true" />

      <div className="ramadan-content">
        <h1>Bonne fête de Ramadan</h1>
        <p>Que ce mois sacré vous apporte paix et réussite</p>
        <p className="ramadan-countdown">Se termine dans {countdown}</p>

        <div className="ramadan-actions">
          {hasTournaments ? (
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
