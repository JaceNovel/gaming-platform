"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const safeReadToken = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("bbshop_token");
  } catch {
    return null;
  }
};

export default function WalletTopupReturnClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = safeReadToken();
    if (!token) {
      const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
      window.location.replace(`/auth/login?next=${next}`);
      return;
    }

    let cancelled = false;

    const hardRedirect = (url: string) => {
      try {
        window.location.replace(url);
      } catch {
        // fallback
        window.location.href = url;
      }
    };

    const redirectToWallet = (status: string) => {
      const safe = encodeURIComponent(status);
      const target = `/wallet?topup_status=${safe}`;
      try {
        router.replace(target);
      } catch {
        // ignore
      }
      // Ensure navigation even if router is stuck (in-app webviews / hydration issues).
      window.setTimeout(() => hardRedirect(target), 250);
    };

    // Strict model: browser redirects are not a proof of payment.
    // Never query provider status nor trigger any server-side reconcile from the client.
    // The wallet will update once the signed webhook is processed.
    const timer = window.setTimeout(() => {
      if (!cancelled) redirectToWallet("pending");
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router, searchParams]);

  return null;
}
