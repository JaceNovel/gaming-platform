"use client";

import { Capacitor } from "@capacitor/core";
import { ExternalLink, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=space.primegaming.app173654";
const RELATED_APP_IDS = ["space.primegaming.app173654"];
const DISABLED_KEY = "prime.android_app_prompt.disabled";

type RelatedApp = {
  id?: string;
  platform?: string;
  url?: string;
};

type NavigatorWithInstalledApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
  standalone?: boolean;
  userAgentData?: {
    mobile?: boolean;
    platform?: string;
  };
};

const isAndroidMobileBrowser = () => {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as NavigatorWithInstalledApps;
  const ua = String(nav.userAgent ?? "").toLowerCase();
  const platform = String(nav.userAgentData?.platform ?? "").toLowerCase();
  const mobile = nav.userAgentData?.mobile;
  const touchCapable = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints > 0 : true;
  const isAndroid = ua.includes("android") || platform.includes("android");
  const isMobile = mobile ?? /mobile|phone|tablet/.test(ua);
  return isAndroid && isMobile && touchCapable;
};

const isStandaloneContext = () => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;

  const nav = window.navigator as NavigatorWithInstalledApps;
  if (nav.standalone) return true;

  return document.referrer.startsWith("android-app://");
};

const isPromptDisabled = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DISABLED_KEY) === "1";
};

const setPromptDisabled = () => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISABLED_KEY, "1");
};

const matchesRelatedApp = (app: RelatedApp) => {
  const id = String(app.id ?? "").trim().toLowerCase();
  const url = String(app.url ?? "").trim().toLowerCase();
  return RELATED_APP_IDS.includes(id) || RELATED_APP_IDS.some((candidate) => url.includes(candidate));
};

export default function AndroidAppDownloadPrompt() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ready, setReady] = useState(false);
  const reopenTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (reopenTimerRef.current) {
      window.clearTimeout(reopenTimerRef.current);
      reopenTimerRef.current = null;
    }

    if (Capacitor.isNativePlatform() || !isAndroidMobileBrowser() || isStandaloneContext() || isPromptDisabled()) {
      setInstalled(false);
      setOpen(false);
      setReady(true);
      return;
    }

    let active = true;

    const syncVisibility = async () => {
      const nav = window.navigator as NavigatorWithInstalledApps;
      let nextInstalled = false;

      if (typeof nav.getInstalledRelatedApps === "function") {
        try {
          const apps = await nav.getInstalledRelatedApps();
          nextInstalled = apps.some(matchesRelatedApp);
        } catch {
          nextInstalled = false;
        }
      }

      if (!active) return;

      setInstalled(nextInstalled);
      setReady(true);

      if (nextInstalled) {
        setOpen(false);
        return;
      }

      reopenTimerRef.current = window.setTimeout(() => {
        if (!active || isPromptDisabled()) return;
        setOpen(true);
      }, 900);
    };

    const handleForeground = () => {
      if (document.visibilityState === "visible") {
        void syncVisibility();
      }
    };

    void syncVisibility();
    document.addEventListener("visibilitychange", handleForeground);
    window.addEventListener("focus", handleForeground);

    return () => {
      active = false;
      if (reopenTimerRef.current) {
        window.clearTimeout(reopenTimerRef.current);
        reopenTimerRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleForeground);
      window.removeEventListener("focus", handleForeground);
    };
  }, [pathname]);

  if (!ready || installed || !open) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[120] sm:inset-x-auto sm:right-5 sm:w-[360px]">
      <div className="overflow-hidden rounded-[28px] border border-emerald-300/25 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.22),transparent_42%),linear-gradient(135deg,rgba(5,12,25,0.96),rgba(10,18,35,0.98))] text-white shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-400/15 text-emerald-100">
              <img src="/favicon-32x32.png" alt="PRIME Gaming" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-emerald-100/70">Android</p>
              <h3 className="mt-1 text-lg font-semibold leading-tight">Télécharge l'application PRIME Gaming</h3>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer la fenêtre"
            onClick={() => setOpen(false)}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-5">
          <p className="text-sm leading-6 text-white/72">
            Installe l'application Android pour profiter d'une expérience plus fluide, des notifications natives et d'un accès direct à ton DB Wallet.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105"
            >
              Télécharger l'application
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              type="button"
              onClick={() => {
                setPromptDisabled();
                setOpen(false);
              }}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/76 transition hover:bg-white/10 hover:text-white"
            >
              Ne plus recevoir ce pop-up
            </button>
          </div>

          <p className="mt-3 text-[11px] leading-5 text-white/45">
            Si l'application est déjà installée sur ce téléphone, cette fenêtre se masquera automatiquement dès que la détection navigateur la remonte.
          </p>
        </div>
      </div>
    </div>
  );
}