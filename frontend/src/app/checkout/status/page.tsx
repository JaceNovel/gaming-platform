"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";

type StatusKey = "loading" | "success" | "failed" | "pending" | "error";

type PaymentStatusResponse = {
  data?: {
    payment_status?: string;
    order_status?: string;
    transaction_id?: string;
    order_id?: number;
  };
  message?: string;
};

function CheckoutStatusScreen() {
  const { authFetch } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<StatusKey>("loading");
  const [message, setMessage] = useState("Vérification du paiement en cours...");
  const [details, setDetails] = useState<{ transactionId?: string; orderId?: number }>({});
  const [checking, setChecking] = useState(false);

  const transactionId = searchParams.get("transaction_id");
  const orderId = searchParams.get("order_id");

  const fetchStatus = useCallback(async () => {
    if (!transactionId && !orderId) {
      setStatus("error");
      setMessage("Référence de paiement introuvable.");
      return;
    }

    setChecking(true);
    try {
      const qs = new URLSearchParams();
      if (transactionId) qs.set("transaction_id", transactionId);
      if (orderId) qs.set("order_id", orderId);

      const res = await authFetch(`${API_BASE}/payments/cinetpay/status?${qs.toString()}`);
      const payload = (await res.json().catch(() => null)) as PaymentStatusResponse | null;

      if (!res.ok) {
        setStatus("error");
        setMessage(payload?.message ?? "Impossible de vérifier le paiement.");
        return;
      }

      const paymentStatus = (payload?.data?.payment_status ?? "pending").toLowerCase();
      setDetails({
        transactionId: payload?.data?.transaction_id ?? transactionId ?? undefined,
        orderId: payload?.data?.order_id ?? (orderId ? Number(orderId) : undefined),
      });

      if (paymentStatus === "paid") {
        setStatus("success");
        setMessage("Paiement confirmé ! Ta commande est en préparation.");
      } else if (paymentStatus === "failed") {
        setStatus("failed");
        setMessage("Paiement refusé ou expiré. Merci de réessayer.");
      } else {
        setStatus("pending");
        setMessage("Paiement en attente de confirmation CinetPay...");
      }
    } catch (error) {
      setStatus("error");
      setMessage("Connexion impossible pour vérifier le paiement.");
    } finally {
      setChecking(false);
    }
  }, [authFetch, orderId, transactionId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const statusStyle =
    status === "success"
      ? "text-emerald-300"
      : status === "failed"
        ? "text-rose-300"
        : status === "pending"
          ? "text-amber-200"
          : "text-white";

  const handleOrdersRedirect = () => router.push("/account");

  return (
    <div className="mobile-shell min-h-screen space-y-6 py-6 pb-24">
      <SectionTitle eyebrow="Paiement" label="Statut CinetPay" />
      <div className="glass-card space-y-4 rounded-2xl border border-white/10 p-6">
        <p className={`text-lg font-semibold ${statusStyle}`}>{message}</p>
        <p className="text-sm text-white/60">
          Transaction
          <span className="ml-2 font-mono text-white/80">
            {details.transactionId ?? transactionId ?? "N/A"}
          </span>
        </p>
        <p className="text-sm text-white/60">
          Commande
          <span className="ml-2 font-semibold text-white">
            {details.orderId ?? orderId ?? "N/A"}
          </span>
        </p>
        <div className="h-px bg-white/10" />
        <div className="flex flex-wrap gap-3">
          <GlowButton
            className="flex-1 justify-center"
            onClick={fetchStatus}
            disabled={checking}
          >
            {checking ? "Vérification..." : "Actualiser"}
          </GlowButton>
          {status === "success" && (
            <GlowButton
              variant="secondary"
              className="flex-1 justify-center"
              onClick={handleOrdersRedirect}
            >
              Voir mes commandes
            </GlowButton>
          )}
          {(status === "failed" || status === "error") && (
            <GlowButton
              variant="secondary"
              className="flex-1 justify-center"
              onClick={() => router.push("/checkout")}
            >
              Revenir au checkout
            </GlowButton>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutStatusPage() {
  return (
    <RequireAuth>
      <CheckoutStatusScreen />
    </RequireAuth>
  );
}
