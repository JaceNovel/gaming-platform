import { Suspense } from "react";
import SectionTitle from "@/components/ui/SectionTitle";
import PaymentReturnClient from "./PaymentReturnClient";

function PaymentReturnShell() {
  return (
    <div className="min-h-[100dvh] pb-24">
      <div className="mobile-shell py-8 space-y-6">
        <SectionTitle eyebrow="Paiement" label="Validation" />
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-3">
          <p className="text-sm text-white/80">
            Validation du paiement. Vous allez être redirigé vers le suivi du paiement.
          </p>
          <p className="text-xs text-white/50">
            Vous pouvez fermer cette page si la redirection ne se fait pas automatiquement.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <>
      <PaymentReturnShell />
      <Suspense fallback={null}>
        <PaymentReturnClient />
      </Suspense>
    </>
  );
}
