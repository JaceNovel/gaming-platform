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
    return null;
  }

  return <>{children}</>;
}
