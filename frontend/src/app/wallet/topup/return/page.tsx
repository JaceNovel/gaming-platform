import { Suspense } from "react";
import SectionTitle from "@/components/ui/SectionTitle";
import WalletTopupReturnClient from "./WalletTopupReturnClient";

function WalletTopupReturnShell() {
  return (
    <div className="min-h-[100dvh] pb-24">
      <div className="mobile-shell py-8 space-y-6">
        <SectionTitle eyebrow="Wallet" label="Validation du rechargement" />
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-3">
          <p className="text-sm text-white/80">
            Recharge wallet en cours de validation. Vous allez être redirigé vers votre profil.
          </p>
          <p className="text-xs text-white/50">
            Si la redirection ne se fait pas, retournez au profil manuellement.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WalletTopupReturnPage() {
  return (
    <>
      <WalletTopupReturnShell />
      <Suspense fallback={null}>
        <WalletTopupReturnClient />
      </Suspense>
    </>
  );
}
