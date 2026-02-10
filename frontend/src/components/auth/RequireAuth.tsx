"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !token) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/auth/login?next=${next}`);
    }
  }, [loading, token, pathname, router]);

  if (loading) {
    return <div className="p-4 text-center">Chargement...</div>;
  }

  if (!token) {
    return (
      <div className="min-h-[60dvh] grid place-items-center p-6 text-center text-white">
        <div className="max-w-sm space-y-2">
          <div className="text-lg font-semibold">Connexion requise</div>
          <div className="text-sm text-white/70">Redirection vers la page de connexion…</div>
          <button
            type="button"
            onClick={() => {
              const next = encodeURIComponent(pathname || "/");
              router.replace(`/auth/login?next=${next}`);
            }}
            className="mt-3 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
          >
            Ouvrir la connexion
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
