"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { isAdminRole } from "@/components/auth/adminRoles";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { token, user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/admin";

  useEffect(() => {
    if (loading) return;
    if (!token) {
      const next = encodeURIComponent(pathname);
      router.replace(`/auth/login?next=${next}`);
      return;
    }
    if (!isAdminRole(user?.role)) {
      router.replace("/");
    }
  }, [loading, token, user?.role, pathname, router]);

  if (loading) {
    return <div className="p-4 text-center text-white">Chargement admin...</div>;
  }

  if (!token || !isAdminRole(user?.role)) {
    return null;
  }

  return <>{children}</>;
}
