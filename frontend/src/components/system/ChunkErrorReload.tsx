"use client";

import { useEffect } from "react";

const RELOAD_GUARD_KEY = "bbshop_chunk_reload_once";

function shouldReloadForErrorMessage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("chunkloaderror") ||
    m.includes("loading chunk") ||
    m.includes("failed to load chunk") ||
    m.includes("importing a module script failed")
  );
}

export default function ChunkErrorReload() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const reloadOnce = () => {
      try {
        const already = sessionStorage.getItem(RELOAD_GUARD_KEY);
        if (already) return;
        sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
      } catch {
        // ignore
      }
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      const msg = String(event?.message ?? "");
      if (msg && shouldReloadForErrorMessage(msg)) reloadOnce();
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: any = event?.reason;
      const msg = String(reason?.message ?? reason ?? "");
      if (msg && shouldReloadForErrorMessage(msg)) reloadOnce();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
