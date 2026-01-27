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
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export default function WalletTopupReturnClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const transactionId = useMemo(
    () => searchParams.get("transaction_id") ?? searchParams.get("cpm_trans_id"),
    [searchParams]
  );
  const orderId = useMemo(() => searchParams.get("order_id"), [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("bbshop_token");
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    let cancelled = false;

    const redirectToProfile = (status: string) => {
      const safe = encodeURIComponent(status);
      router.replace(`/account?topup_status=${safe}`);
    };

    const poll = async () => {
      const params = new URLSearchParams();
      if (transactionId) params.set("transaction_id", transactionId);
      if (orderId) params.set("order_id", orderId);

      if (!params.toString()) {
        redirectToProfile("pending");
        return;
      }

      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (cancelled) return;

        try {
          const res = await fetch(`${API_BASE}/payments/cinetpay/status?${params.toString()}`, {
            headers: getAuthHeaders(),
          });

          if (res.status === 401) {
            router.replace("/auth/login");
            return;
          }

          const payload = await res.json().catch(() => null);
          const paymentStatus = String(payload?.data?.payment_status ?? "pending").toLowerCase();

          if (["completed", "paid", "success"].includes(paymentStatus)) {
            redirectToProfile("success");
            return;
          }

          if (["failed", "refused", "cancelled", "canceled"].includes(paymentStatus)) {
            redirectToProfile("failed");
            return;
          }
        } catch {
          // ignore and retry
        }

        await new Promise((r) => setTimeout(r, 2000));
      }

      redirectToProfile("pending");
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [orderId, router, transactionId]);

  return null;
}
