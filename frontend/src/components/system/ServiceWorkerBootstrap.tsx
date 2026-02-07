"use client";

import { useEffect } from "react";

export default function ServiceWorkerBootstrap() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator)) return;

      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          if (cancelled) return;
          try {
            await reg.update();
          } catch {
            // ignore
          }
        }

        const reg = await navigator.serviceWorker.register(
          "/sw.js",
          ({
            scope: "/",
            updateViaCache: "none",
          } as any),
        );

        try {
          await reg.update();
        } catch {
          // ignore
        }

        // If there's a waiting SW, ask it to activate now.
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
