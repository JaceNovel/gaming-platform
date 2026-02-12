"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";

const HAS_API_ENV = Boolean(process.env.NEXT_PUBLIC_API_URL);

function CheckoutStatusRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authFetch } = useAuth();

  useEffect(() => {
    const order = (searchParams.get("order_id") ?? searchParams.get("order") ?? "").trim();
    const status = (searchParams.get("status") ?? "").trim();

    const params = new URLSearchParams();
    if (status) params.set("payment_status", status);
    if (order) params.set("order", order);

    const normalized = status.toLowerCase();
    const isSuccess = normalized === "success" || normalized === "paid" || normalized === "completed";

    if (!HAS_API_ENV || !order || !isSuccess) {
      const target = params.toString() ? `/account?${params.toString()}` : "/account";
      router.replace(target);
      return;
    }

    let active = true;
    (async () => {
      try {
        const redeemRes = await authFetch(`${API_BASE}/orders/${encodeURIComponent(order)}/redeem-codes`);
        const redeemPayload = await redeemRes.json().catch(() => null);
        const hasRedeemItems = redeemRes.ok ? Boolean(redeemPayload?.has_redeem_items) : false;

        if (!active) return;
        if (hasRedeemItems) {
          router.replace(`/codes?${params.toString()}`);
          return;
        }
      } catch {
        // ignore
      }

      if (!active) return;
      const target = params.toString() ? `/account?${params.toString()}` : "/account";
      router.replace(target);
    })();

    return () => {
      active = false;
    };
  }, [authFetch, router, searchParams]);

  return null;
}

export default function CheckoutStatusPage() {
  return (
    <RequireAuth>
      <CheckoutStatusRedirect />
    </RequireAuth>
  );
}
