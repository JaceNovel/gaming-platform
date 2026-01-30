"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE } from "@/lib/config";

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (typeof window === "undefined") return headers;
  let token: string | null = null;
  try {
    token = localStorage.getItem("bbshop_token");
  } catch {
    token = null;
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

type LastTopupHint = {
  provider?: string;
  order_id?: string | number;
  transaction_id?: string;
  reference?: string;
  created_at?: string;
};

const safeReadLastTopup = (): LastTopupHint | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("bbshop_last_topup");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as LastTopupHint;
  } catch {
    return null;
  }
};

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

  const transactionId = useMemo(() => {
    const direct = searchParams.get("transaction_id") ?? searchParams.get("cpm_trans_id") ?? searchParams.get("id");
    if (direct) return direct;
    return safeReadLastTopup()?.transaction_id ?? null;
  }, [searchParams]);
  const orderId = useMemo(() => {
    const direct = searchParams.get("order_id");
    if (direct) return direct;
    const hint = safeReadLastTopup();
    if (!hint?.order_id) return null;
    return String(hint.order_id);
  }, [searchParams]);
  const provider = useMemo(() => {
    const direct = String(searchParams.get("provider") ?? "").toLowerCase();
    if (direct) return direct;
    const hint = safeReadLastTopup()?.provider;
    return String(hint ?? "fedapay").toLowerCase();
  }, [searchParams]);

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

    const poll = async () => {
      const params = new URLSearchParams();
      if (transactionId) params.set("transaction_id", transactionId);
      if (orderId) params.set("order_id", orderId);

      if (!params.toString()) {
        // No provider identifiers; try a server-side "best effort" reconcile (latest pending topup), then go back.
        try {
          await fetch(`${API_BASE}/wallet/topup/reconcile`, {
            method: "POST",
            headers: getAuthHeaders(),
          });
        } catch {
          // ignore
        }
        redirectToWallet("pending");
        return;
      }

      // Safety: force a redirect even if polling hangs.
      const forceTimer = window.setTimeout(() => {
        if (!cancelled) redirectToWallet("pending");
      }, 20000);

      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (cancelled) return;

        try {
          const endpoint = provider === "cinetpay" ? "cinetpay" : "fedapay";
          const res = await fetch(`${API_BASE}/payments/${endpoint}/status?${params.toString()}`, {
            headers: getAuthHeaders(),
          });

          if (res.status === 401) {
            const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
            hardRedirect(`/auth/login?next=${next}`);
            return;
          }

          const payload = await res.json().catch(() => null);
          const paymentStatus = String(payload?.data?.payment_status ?? "pending").toLowerCase();

          if (["completed", "paid", "success"].includes(paymentStatus)) {
            window.clearTimeout(forceTimer);
            redirectToWallet("success");
            return;
          }

          if (["failed", "refused", "cancelled", "canceled"].includes(paymentStatus)) {
            window.clearTimeout(forceTimer);
            redirectToWallet("failed");
            return;
          }
        } catch {
          // ignore and retry
        }

        await new Promise((r) => setTimeout(r, 2000));
      }

      window.clearTimeout(forceTimer);
      // Final attempt: reconcile last pending topup server-side.
      try {
        await fetch(`${API_BASE}/wallet/topup/reconcile`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ order_id: orderId ?? undefined, transaction_id: transactionId ?? undefined }),
        });
      } catch {
        // ignore
      }

      redirectToWallet("pending");
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [orderId, provider, router, transactionId]);

  return null;
}
