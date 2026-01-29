"use client";

import { useEffect } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/config";
import { openTidioChat } from "@/lib/tidioChat";

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep a console breadcrumb for debugging production issues.
    console.error("/account crashed", error);

    // Best-effort server-side reporting (helps when console is not accessible).
    try {
      fetch(`${API_BASE}/client-errors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error?.message || "Unknown client error",
          digest: error?.digest || null,
          path: "/account",
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
      }).catch(() => null);
    } catch {
      // ignore
    }
  }, [error]);

  return (
    <main className="min-h-[100dvh] bg-[#04010d] px-5 py-16 text-white">
      <div className="mx-auto w-full max-w-xl rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        <h1 className="text-xl font-semibold">Problème sur le profil</h1>
        <p className="mt-2 text-sm text-white/70">
          Une erreur est survenue pendant le chargement de ton compte.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Réessayer
          </button>
          <Link
            href="/auth/login"
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
          >
            Se reconnecter
          </Link>
          <button
            type="button"
            onClick={() => void openTidioChat()}
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
          >
            Ouvrir le support
          </button>
        </div>

        <p className="mt-6 text-xs text-white/50">
          Détail: {error?.message || "Erreur inconnue"}
          {error?.digest ? ` (digest: ${error.digest})` : ""}
        </p>
      </div>
    </main>
  );
}
