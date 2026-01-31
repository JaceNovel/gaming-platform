"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PaymentReturnClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const transactionId = useMemo(
    () => searchParams.get("transaction_id") ?? searchParams.get("cpm_trans_id"),
    [searchParams]
  );
  const orderId = useMemo(() => searchParams.get("order_id"), [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (orderId) params.set("order", orderId);
    if (transactionId) params.set("transaction_id", transactionId);

    const target = params.toString() ? `/account?${params.toString()}` : "/account";
    const timer = setTimeout(() => router.replace(target), 700);
    return () => clearTimeout(timer);
  }, [orderId, router, transactionId]);

  return null;
}
