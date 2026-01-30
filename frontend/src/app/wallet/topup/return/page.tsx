import { Suspense } from "react";
import Link from "next/link";
import SectionTitle from "@/components/ui/SectionTitle";
import WalletTopupReturnClient from "./WalletTopupReturnClient";

function WalletTopupReturnShell() {
  return (
    <div className="min-h-[100dvh] pb-24">
      <div className="mobile-shell py-8 space-y-6">
        <SectionTitle eyebrow="Wallet" label="Validation du rechargement" />
        <div className="glass-card rounded-2xl p-5 border border-white/10 space-y-3">
          <p className="text-sm text-white/80">
            Recharge wallet en cours de validation. Vous allez être redirigé vers votre wallet.
          </p>
          <p className="text-xs text-white/50">
            Si la redirection ne se fait pas, retournez au wallet manuellement.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/wallet"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold"
            >
              Aller au wallet
            </Link>
            <Link
              href={`/auth/login?next=${encodeURIComponent("/wallet/topup/return")}`}
              className="inline-flex items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
            >
              Se connecter
            </Link>
          </div>
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
