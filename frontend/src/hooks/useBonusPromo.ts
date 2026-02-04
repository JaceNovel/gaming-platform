"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "bb_bonus_promo_start_ms";
const PROMO_DURATION_MS = 24 * 60 * 60 * 1000;

export type BonusPromoState = {
  startMs: number | null;
  endMs: number | null;
  remainingMs: number;
  isActive: boolean;
  label: string;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function safeParseInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

export function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Frontend-only marketing timer:
 * - Start time is the user's first view (localStorage)
 * - Runs for 24h
 */
export default function useBonusPromo(): BonusPromoState {
  const [startMs, setStartMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const existing = safeParseInt(window.localStorage.getItem(STORAGE_KEY));
    const start = existing && existing > 0 ? existing : Date.now();

    if (!existing) {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(start));
      } catch {
        // ignore storage errors
      }
    }

    setStartMs(start);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    const endMs = startMs ? startMs + PROMO_DURATION_MS : null;
    const remainingMs = endMs ? clamp(endMs - nowMs, 0, PROMO_DURATION_MS) : PROMO_DURATION_MS;
    const isActive = Boolean(endMs && nowMs < endMs);

    return {
      startMs,
      endMs,
      remainingMs,
      isActive,
      label: isActive ? "Bonus x2 pour les 20 premiers" : "Bonus terminé",
    };
  }, [nowMs, startMs]);
}
