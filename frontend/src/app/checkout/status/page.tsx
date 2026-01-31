"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";

function CheckoutStatusRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const order = searchParams.get("order_id") ?? searchParams.get("order");
    const status = searchParams.get("status");
    const params = new URLSearchParams();
    if (status) params.set("payment_status", status);
    if (order) params.set("order", order);
    const target = params.toString() ? `/account?${params.toString()}` : "/account";
    router.replace(target);
  }, [router, searchParams]);

  return null;
}

export default function CheckoutStatusPage() {
  return (
    <RequireAuth>
      <CheckoutStatusRedirect />
    </RequireAuth>
  );
}
