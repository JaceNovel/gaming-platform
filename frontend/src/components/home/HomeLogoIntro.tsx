"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const SESSION_KEY = "pg_home_logo_intro_done";

type Particle = {
  id: string;
  emoji: string;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  rot: number;
  delayMs: number;
  durMs: number;
};

const EMOJIS = ["🎮", "🕹️", "⚡", "🔥", "👑", "🛡️", "🏆", "💎", "🚀", "🎯", "🧩", "💥"];

const prefersReducedMotion = () => {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
};

export default function HomeLogoIntro() {
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");

  const particles = useMemo<Particle[]>(() => {
    // Stable random set per mount.
    const rand = (min: number, max: number) => Math.random() * (max - min) + min;
    const count = 18;
    return Array.from({ length: count }).map((_, i) => {
      const emoji = EMOJIS[i % EMOJIS.length];
      const sx = rand(-180, 180);
      const sy = rand(-120, 120);
      const ex = rand(-70, 70);
      const ey = rand(-45, 45);
      const rot = rand(-260, 260);
      const delayMs = Math.round(rand(0, 220));
      const durMs = Math.round(rand(1050, 1400));
      return {
        id: `p_${i}_${Math.random().toString(16).slice(2)}`,
        emoji,
        sx,
        sy,
        ex,
        ey,
        rot,
        delayMs,
        durMs,
      };
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (prefersReducedMotion()) {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // ignore
      }
      setShouldAnimate(false);
      setPhase("done");
      return;
    }

    let alreadyDone = false;
    try {
      alreadyDone = window.sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      alreadyDone = false;
    }

    if (alreadyDone) {
      setShouldAnimate(false);
      setPhase("done");
      return;
    }

    setShouldAnimate(true);
    setPhase("running");

    const totalMs = 1650;
    const t = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // ignore
      }
      setPhase("done");
      setShouldAnimate(false);
    }, totalMs);

    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      className={`relative mx-auto h-auto w-[260px] sm:w-[360px] lg:w-[440px] ${
        phase === "running" ? "pg-logo-intro" : ""
      }`}
      aria-label="PRIME Gaming"
    >
      {/* Particles */}
      {shouldAnimate ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
          <div className="relative h-full w-full">
            {particles.map((p) => (
              <span
                key={p.id}
                className="pg-emoji"
                style={
                  {
                    "--sx": `${p.sx}px`,
                    "--sy": `${p.sy}px`,
                    "--ex": `${p.ex}px`,
                    "--ey": `${p.ey}px`,
                    "--rot": `${p.rot}deg`,
                    "--delay": `${p.delayMs}ms`,
                    "--dur": `${p.durMs}ms`,
                  } as React.CSSProperties
                }
              >
                {p.emoji}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Logo */}
      <div className={phase === "running" ? "pg-logo" : ""}>
        <Image
          src="/images/Capture_d_écran_2026-02-10_114839-removebg-preview.png"
          alt="PRIME Gaming"
          width={900}
          height={260}
          className="h-auto w-full"
          priority
        />
      </div>

      <style jsx>{`
        .pg-logo-intro {
          transform-origin: 50% 60%;
          animation: pgRumble 620ms ease-out 1;
        }

        .pg-logo {
          transform-origin: 50% 60%;
          animation: pgLogoIn 1500ms cubic-bezier(0.2, 0.9, 0.2, 1) 1;
        }

        .pg-emoji {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(calc(-50% + var(--sx)), calc(-50% + var(--sy))) rotate(var(--rot)) scale(1);
          opacity: 0;
          filter: drop-shadow(0 10px 25px rgba(0, 0, 0, 0.65));
          font-size: 22px;
          animation: pgEmojiFlight var(--dur) ease-out var(--delay) 1;
          will-change: transform, opacity;
        }

        @media (min-width: 640px) {
          .pg-emoji {
            font-size: 26px;
          }
        }

        @keyframes pgEmojiFlight {
          0% {
            opacity: 0;
            transform: translate(calc(-50% + var(--sx)), calc(-50% + var(--sy))) rotate(var(--rot)) scale(1.05);
          }
          10% {
            opacity: 0.95;
          }
          55% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(calc(var(--rot) * 0.25)) scale(0.95);
          }
          72% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(0deg) scale(0.7);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--ex)), calc(-50% + var(--ey))) rotate(0deg) scale(0.25);
          }
        }

        @keyframes pgLogoIn {
          0% {
            opacity: 0;
            transform: scale(0.965);
            filter: blur(6px);
          }
          55% {
            opacity: 0;
            transform: scale(0.965);
            filter: blur(6px);
          }
          78% {
            opacity: 1;
            transform: scale(1.015);
            filter: blur(0px);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0px);
          }
        }

        @keyframes pgRumble {
          0% {
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
          15% {
            transform: translate3d(1px, 0, 0) rotate(-0.25deg);
          }
          30% {
            transform: translate3d(-2px, 1px, 0) rotate(0.35deg);
          }
          45% {
            transform: translate3d(2px, -1px, 0) rotate(-0.35deg);
          }
          60% {
            transform: translate3d(-1px, 1px, 0) rotate(0.25deg);
          }
          100% {
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
        }
      `}</style>
    </div>
  );
}
