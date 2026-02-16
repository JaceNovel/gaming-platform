"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";

function OrderConfirmationRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authFetch } = useAuth();

  useEffect(() => {
    let active = true;
    const order = String(searchParams.get("order") ?? "").trim();
    const status = String(searchParams.get("status") ?? "").trim();
    const statusLower = status.toLowerCase();
    const isSuccess = ["success", "paid", "completed"].includes(statusLower);

    const toAccount = () => {
      const params = new URLSearchParams();
      if (status) params.set("payment_status", status);
      if (order) params.set("order", order);
      const target = params.toString() ? `/account?${params.toString()}` : "/account";
      router.replace(target);
    };

    (async () => {
      if (!order || !isSuccess) {
        toAccount();
        return;
      }

      try {
        const redeemRes = await authFetch(`${API_BASE}/orders/${encodeURIComponent(order)}/redeem-codes`, {
          cache: "no-store",
        });
        const redeemPayload = await redeemRes.json().catch(() => null);
        if (!active) return;

        if (redeemRes.ok && redeemPayload?.has_redeem_items) {
          router.replace(`/codes?payment_status=${encodeURIComponent(statusLower)}`);
          return;
        }
      } catch {
        // ignore
      }

      toAccount();
    })();

    return () => {
      active = false;
    };
  }, [authFetch, router, searchParams]);

  return null;
}

export default function OrderConfirmationPage() {
  return (
    <RequireAuth>
      <OrderConfirmationRedirect />
    </RequireAuth>
  );
}
