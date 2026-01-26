"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SectionTitle from "@/components/ui/SectionTitle";

export default function PaymentReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const transactionId = useMemo(() => searchParams.get("transaction_id") ?? searchParams.get("cpm_trans_id"), [searchParams]);
  const orderId = useMemo(() => searchParams.get("order_id"), [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (transactionId) params.set("transaction_id", transactionId);
    if (orderId) params.set("order_id", orderId);

    const target = params.toString() ? `/checkout/status?${params.toString()}` : "/checkout/status";
    const timer = setTimeout(() => router.replace(target), 1200);
    return () => clearTimeout(timer);
  }, [orderId, router, transactionId]);

  return (
    <div className="min-h-[100dvh] pb-24">
      <div className="mobile-shell py-8 space-y-6">
        <SectionTitle eyebrow="Paiement" label="Validation en cours" />
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-3">
          <p className="text-sm text-white/80">
            Paiement en cours de validation. Vous allez être redirigé vers le suivi du paiement.
          </p>
          <p className="text-xs text-white/50">
            Vous pouvez fermer cette page si la redirection ne se fait pas automatiquement.
          </p>
        </div>
      </div>
    </div>
  );
}
