"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";

function OrderConfirmationModal() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderParam = useMemo(() => {
    const raw = searchParams.get("order");
    return raw ? decodeURIComponent(raw) : null;
  }, [searchParams]);

  const paymentStatus = useMemo(() => {
    const raw = searchParams.get("status");
    return raw ? decodeURIComponent(raw) : null;
  }, [searchParams]);

  const orderTrackingHref = orderParam ? `/orders/${encodeURIComponent(orderParam)}` : "/account";

  if (!orderParam) {
    return (
      <div className="min-h-screen text-white">
        <div className="fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(180,70,255,0.30),transparent_45%),radial-gradient(circle_at_70%_50%,rgba(0,255,255,0.18),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(255,160,0,0.12),transparent_55%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.15),rgba(0,0,0,0.9))]" />
          <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />
        </div>

        <main className="flex min-h-screen items-center justify-center px-5 py-10">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-black/45 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-white/45">Confirmation</p>
            <h1 className="mt-2 text-xl font-semibold">Paiement pris en compte</h1>
            <p className="mt-2 text-sm text-white/65">Retrouve ta commande dans ton compte.</p>
            <button
              type="button"
              onClick={() => router.replace("/account")}
              className="mt-5 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold"
            >
              Aller à mon compte
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(180,70,255,0.30),transparent_45%),radial-gradient(circle_at_70%_50%,rgba(0,255,255,0.18),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(255,160,0,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.15),rgba(0,0,0,0.9))]" />
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />
      </div>

      <main className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-black/45 p-6 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-white/45">Commande confirmée</p>
          <h1 className="mt-2 text-2xl font-semibold">Livré sous 24H sinon litige</h1>
          <p className="mt-2 text-sm text-white/65">
            {paymentStatus ? `Statut paiement: ${paymentStatus}. ` : ""}Suis ta commande pour voir l’état de livraison et confirmer quand tu as reçu.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => router.replace(orderTrackingHref)}
              className="w-full rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100"
            >
              Suivre ma commande
            </button>
            <button
              type="button"
              onClick={() => router.replace("/account")}
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold"
            >
              Mon compte
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <RequireAuth>
      <OrderConfirmationModal />
    </RequireAuth>
  );
}
