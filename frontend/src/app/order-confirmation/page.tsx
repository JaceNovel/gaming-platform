"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";

type StatusKey = "loading" | "success" | "failed" | "pending" | "cancelled" | "error";

type PaymentStatusResponse = {
  data?: {
    payment_status?: string;
    order_status?: string;
    transaction_id?: string;
    order_id?: number;
  };
  message?: string;
};

function normalizeClientStatus(raw: string | null): StatusKey | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === "success" || v === "paid" || v === "accepted") return "success";
  if (v === "failed" || v === "refused") return "failed";
  if (v === "pending") return "pending";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  return null;
}

function OrderConfirmationScreen() {
  const { authFetch } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const order = searchParams.get("order");
  const initialStatus = normalizeClientStatus(searchParams.get("status"));
  const transactionIdFromUrl = searchParams.get("transaction_id");

  const [status, setStatus] = useState<StatusKey>("loading");
  const [message, setMessage] = useState("Vérification du paiement en cours...");
  const [details, setDetails] = useState<{ transactionId?: string; orderId?: number }>({});
  const [checking, setChecking] = useState(false);

  const numericOrderId = useMemo(() => {
    const n = Number(order);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [order]);

  const fetchStatus = useCallback(async () => {
    if (!numericOrderId && !transactionIdFromUrl) {
      setStatus("error");
      setMessage("Référence de commande introuvable.");
      return;
    }

    setChecking(true);
    try {
      const qs = new URLSearchParams();
      if (transactionIdFromUrl) qs.set("transaction_id", transactionIdFromUrl);
      if (numericOrderId) qs.set("order_id", String(numericOrderId));

      const res = await authFetch(`${API_BASE}/payments/cinetpay/status?${qs.toString()}`);
      const payload = (await res.json().catch(() => null)) as PaymentStatusResponse | null;

      if (!res.ok) {
        setStatus(initialStatus ?? "error");
        setMessage(payload?.message ?? "Impossible de vérifier le paiement.");
        return;
      }

      const paymentStatus = (payload?.data?.payment_status ?? "pending").toLowerCase();
      const resolvedOrderId = payload?.data?.order_id ?? (numericOrderId ?? undefined);
      const resolvedTxId = payload?.data?.transaction_id ?? (transactionIdFromUrl ?? undefined);

      setDetails({ orderId: resolvedOrderId, transactionId: resolvedTxId });

      if (paymentStatus === "paid") {
        setStatus("success");
        setMessage("✅ Paiement confirmé ! Merci pour votre achat.");
        return;
      }

      if (paymentStatus === "failed") {
        setStatus("failed");
        setMessage("❌ Paiement refusé ou expiré. Merci de réessayer.");
        return;
      }

      setStatus("pending");
      setMessage("⏳ Paiement en attente de confirmation CinetPay...");
    } catch {
      setStatus(initialStatus ?? "error");
      setMessage("Connexion impossible pour vérifier le paiement.");
    } finally {
      setChecking(false);
    }
  }, [authFetch, initialStatus, numericOrderId, transactionIdFromUrl]);

  useEffect(() => {
    // Affiche un message immédiat basé sur le param `status`, puis vérifie côté serveur.
    if (initialStatus === "success") setMessage("✅ Paiement accepté ! Vérification...");
    if (initialStatus === "failed") setMessage("❌ Paiement refusé. Vérification...");
    if (initialStatus === "cancelled") setMessage("Paiement annulé. Vérification...");
    if (initialStatus === "pending") setMessage("⏳ Paiement en attente. Vérification...");

    fetchStatus();
  }, [fetchStatus, initialStatus]);

  const statusStyle =
    status === "success"
      ? "text-emerald-300"
      : status === "failed"
        ? "text-rose-300"
        : status === "pending" || status === "cancelled"
          ? "text-amber-200"
          : "text-white";

  return (
    <div className="mobile-shell min-h-screen space-y-6 py-6 pb-24">
      <SectionTitle eyebrow="Paiement" label="Confirmation" />

      <div className="glass-card space-y-4 rounded-2xl border border-white/10 p-6">
        <p className={`text-lg font-semibold ${statusStyle}`}>{message}</p>

        <div className="space-y-1 text-sm text-white/60">
          <p>
            Commande <span className="ml-2 font-semibold text-white">{details.orderId ?? numericOrderId ?? "N/A"}</span>
          </p>
          <p>
            Transaction <span className="ml-2 font-mono text-white/80">{details.transactionId ?? transactionIdFromUrl ?? "N/A"}</span>
          </p>
        </div>

        <div className="h-px bg-white/10" />

        <div className="flex flex-wrap gap-3">
          <GlowButton className="flex-1 justify-center" onClick={fetchStatus} disabled={checking}>
            {checking ? "Vérification..." : "Actualiser"}
          </GlowButton>

          {status === "success" && (
            <GlowButton variant="secondary" className="flex-1 justify-center" onClick={() => router.push("/account")}
            >
              Voir mes commandes
            </GlowButton>
          )}

          {(status === "failed" || status === "cancelled" || status === "error") && (
            <GlowButton variant="secondary" className="flex-1 justify-center" onClick={() => router.push("/checkout")}
            >
              Revenir au checkout
            </GlowButton>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <RequireAuth>
      <OrderConfirmationScreen />
    </RequireAuth>
  );
}
