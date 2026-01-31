"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";

type StatusKey = "loading" | "success" | "failed" | "pending" | "error";

type OrderItemProduct = {
  type?: string | null;
};

type OrderItemRow = {
  product?: OrderItemProduct | null;
};

type OrderShowResponse = {
  id?: number;
  status?: string;
  type?: string;
  meta?: Record<string, unknown> | null;
  orderItems?: OrderItemRow[];
  order_items?: OrderItemRow[];
};

type RedeemCodeRow = {
  code: string;
  label?: string | null;
  diamonds?: number | null;
  quantity_index?: number;
};

type RedeemCodesResponse = {
  has_redeem_items?: boolean;
  codes?: RedeemCodeRow[];
  guide_url?: string | null;
};

type PostPurchaseKind = "redeem" | "account" | "subscription" | "accessory";

function CheckoutStatusScreen() {
  const { authFetch } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<StatusKey>("loading");
  const [message, setMessage] = useState("Vérification du paiement...");
  const [pollStartedAt] = useState(() => Date.now());

  const [redeemCodes, setRedeemCodes] = useState<RedeemCodeRow[]>([]);
  const [guideUrl, setGuideUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [outOfStock, setOutOfStock] = useState(false);
  const [postPurchaseKind, setPostPurchaseKind] = useState<PostPurchaseKind>("accessory");

  const doneRef = useRef(false);
  const orderId = searchParams.get("order_id") ?? searchParams.get("order");

  const numericOrderId = useMemo(() => {
    const n = Number(orderId);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [orderId]);

  const fetchStatus = useCallback(async () => {
    if (!numericOrderId) {
      setStatus("error");
      setMessage("Référence de commande introuvable.");
      return;
    }

    try {
      const orderRes = await authFetch(`${API_BASE}/orders/${numericOrderId}`);
      const orderPayload = (await orderRes.json().catch(() => null)) as OrderShowResponse | null;

      if (!orderRes.ok) {
        setStatus("error");
        setMessage("Impossible de vérifier la commande.");
        return;
      }

      const orderStatus = String(orderPayload?.status ?? "").toLowerCase();
      const orderType = String(orderPayload?.type ?? "").toLowerCase();
      const meta = (orderPayload?.meta ?? {}) as Record<string, unknown>;
      const fulfillmentStatus = String(meta?.fulfillment_status ?? "").toLowerCase();

      if (orderStatus === "payment_success") {
        doneRef.current = true;
        setStatus("success");

        if (orderType === "wallet_topup") {
          setMessage("Paiement confirmé. Votre wallet va être mis à jour.");
          setShowModal(false);
          window.setTimeout(() => {
            router.replace("/account?topup_status=pending");
          }, 800);
          return;
        }

        if (orderType === "premium_subscription") {
          setMessage("Paiement confirmé. Votre abonnement VIP va être activé.");
          setShowModal(false);
          return;
        }

        if (fulfillmentStatus === "out_of_stock" || fulfillmentStatus === "waiting_stock") {
          setOutOfStock(true);
          setMessage("Commande payée – en attente de réapprovisionnement.");
          setShowModal(true);
          return;
        }

        setOutOfStock(false);
        setMessage("Paiement confirmé !");

        const orderItemsRaw = orderPayload?.orderItems ?? orderPayload?.order_items ?? [];
        const orderItems = Array.isArray(orderItemsRaw) ? orderItemsRaw : [];
        const types = orderItems
          .map((row) => String(row?.product?.type ?? "").toLowerCase())
          .filter(Boolean);

        const codesRes = await authFetch(`${API_BASE}/orders/${numericOrderId}/redeem-codes`);
        const codesPayload = (await codesRes.json().catch(() => null)) as RedeemCodesResponse | null;
        if (codesRes.ok) {
          const isRedeem = Boolean(codesPayload?.has_redeem_items);
          if (isRedeem) {
            setPostPurchaseKind("redeem");
            setRedeemCodes(Array.isArray(codesPayload?.codes) ? codesPayload.codes : []);
            setGuideUrl(codesPayload?.guide_url ?? null);
            setShowModal(true);
            return;
          }

          if (types.includes("account")) {
            setPostPurchaseKind("account");
            setShowModal(true);
            return;
          }

          if (types.includes("subscription")) {
            setPostPurchaseKind("subscription");
            setShowModal(true);
            return;
          }

          setPostPurchaseKind("accessory");
          setShowModal(true);
        }

        return;
      }

      if (orderStatus === "payment_failed") {
        doneRef.current = true;
        setStatus("failed");
        if (orderType === "wallet_topup") {
          setMessage("Recharge wallet échouée ou annulée.");
        } else {
          setMessage("Paiement refusé ou expiré. Merci de réessayer.");
        }
        return;
      }

      const elapsed = Date.now() - pollStartedAt;
      if (elapsed <= 30_000) {
        setStatus("loading");
        setMessage("Vérification du paiement...");
        return;
      }

      setStatus("pending");
      if (orderType === "wallet_topup") {
        setMessage("Recharge wallet en attente de confirmation...");
      } else {
        setMessage("Paiement en attente de confirmation...");
      }
    } catch {
      setStatus("error");
      setMessage("Connexion impossible pour vérifier le paiement.");
    }
  }, [authFetch, numericOrderId, pollStartedAt, router]);

  useEffect(() => {
    doneRef.current = false;

    if (!numericOrderId) {
      setStatus("error");
      setMessage("Référence de commande introuvable.");
      return;
    }

    let active = true;

    const tick = async () => {
      if (!active) return;
      if (doneRef.current) return;
      await fetchStatus();
    };

    void tick();

    const interval = window.setInterval(() => {
      void tick();
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
  };
