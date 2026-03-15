"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import PaymentMethodModal, { type PaymentMethodOption } from "@/components/payments/PaymentMethodModal";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { API_BASE } from "@/lib/config";
import { openTidioChat } from "@/lib/tidioChat";
import { emitWalletUpdated } from "@/lib/walletEvents";

const HAS_API_ENV = Boolean(process.env.NEXT_PUBLIC_API_URL);

type WalletTx = {
  id: string;
  label: string;
  amount: number;
  currency: string;
  created_at: string;
  type: "credit" | "debit";
  status: "success" | "pending" | "failed";
  reference?: string | null;
  order_id?: number | null;
  transaction_id?: string | null;
  order_status?: string | null;
  payment_status?: string | null;
  payout_id?: string | null;
  payout_status?: string | null;
  failure_reason?: string | null;
};

type WalletPayout = {
  id: string;
  amount: number;
  fee: number;
  total_debit: number;
  currency: string;
  country: string;
  phone: string;
  provider: string;
  provider_ref?: string | null;
  status: string;
  failure_reason?: string | null;
  created_at: string;
};

type WalletRecipient = {
  id: number;
  username: string;
  wallet_id: string;
  phone_masked: string;
};

const normalizeCurrency = (currency?: string | null): { intl: string; label: string } => {
  const raw = String(currency ?? "").trim().toUpperCase();
  if (!raw) return { intl: "XOF", label: "FCFA" };
  if (raw === "FCFA") return { intl: "XOF", label: "FCFA" };
  if (raw === "XOF") return { intl: "XOF", label: "FCFA" };
  if (raw.length === 3) return { intl: raw, label: raw };
  return { intl: "XOF", label: raw };
};

const formatMoney = (amount: number, currency?: string | null) => {
  const { intl, label } = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: intl, maximumFractionDigits: 0 }).format(
      Number.isFinite(amount) ? amount : 0,
    );
  } catch {
    const value = Number.isFinite(amount) ? Math.round(amount).toLocaleString("fr-FR") : "0";
    return `${value} ${label}`;
  }
};

const statusChipClass = (status?: string | null) => {
  const s = String(status ?? "").toLowerCase();
  if (s === "success" || s === "completed" || s === "paid") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
  if (s === "failed") return "border-rose-300/30 bg-rose-500/10 text-rose-100";
  return "border-amber-300/30 bg-amber-400/10 text-amber-100";
};

const payoutStatusChipClass = (status?: string | null) => {
  const s = String(status ?? "").toLowerCase();
  if (s === "sent") return "border-emerald-300/30 bg-emerald-400/10 text-emerald-100";
  if (s === "failed" || s === "cancelled") return "border-rose-300/30 bg-rose-500/10 text-rose-100";
  return "border-amber-300/30 bg-amber-400/10 text-amber-100";
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
};

function WalletClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authFetch, user } = useAuth();

  const defaultCountry = String((user as any)?.country_code ?? "CI").trim().toUpperCase() || "CI";
  const defaultPhone = String((user as any)?.phone ?? "").trim();

  const [loading, setLoading] = useState(HAS_API_ENV);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [balance, setBalance] = useState<number>(0);
  const [rewardBalance, setRewardBalance] = useState<number>(0);
  const [rewardMinPurchaseAmount, setRewardMinPurchaseAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("FCFA");
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string>("");
  const [walletUsername, setWalletUsername] = useState<string>(String(user?.name ?? ""));
  const [exchangeAmount, setExchangeAmount] = useState<string>("");
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState<string>("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [topupProvider, setTopupProvider] = useState<"fedapay" | "paypal" | "bank_card">("fedapay");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawMethod, setWithdrawMethod] = useState<string>("wave");
  const [withdrawPhone, setWithdrawPhone] = useState<string>(defaultPhone);
  const [withdrawCountry, setWithdrawCountry] = useState<string>(defaultCountry);
  const [withdrawName, setWithdrawName] = useState<string>(String(user?.name ?? ""));
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawFeeAmount, setWithdrawFeeAmount] = useState<number>(1000);
  const [transferQuery, setTransferQuery] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [transferRecipient, setTransferRecipient] = useState<WalletRecipient | null>(null);
  const [transferLookupLoading, setTransferLookupLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);

  const [limit, setLimit] = useState<10 | 25 | 50>(25);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [payouts, setPayouts] = useState<WalletPayout[]>([]);

  const refreshSeq = useRef(0);

  const hasPendingTx = useMemo(
    () => transactions.some((t) => String(t.status ?? "").toLowerCase() === "pending"),
    [transactions],
  );

  const loadWallet = async (options?: { silent?: boolean }) => {
    if (!HAS_API_ENV) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const seq = ++refreshSeq.current;
    if (!options?.silent) setRefreshing(true);

    try {
      const summaryRes = await authFetch(`${API_BASE}/wallet`);
      if (!summaryRes.ok) return;
      const summary = await summaryRes.json().catch(() => null);
      if (refreshSeq.current !== seq) return;

      const nextBalance = Number(summary?.balance ?? 0);
      setBalance(Number.isFinite(nextBalance) ? nextBalance : 0);
      setWalletId(String(summary?.wallet_id ?? ""));
      setWalletUsername(String(summary?.username ?? user?.name ?? ""));
      const nextRewardBalance = Number(summary?.reward_balance ?? 0);
      setRewardBalance(Number.isFinite(nextRewardBalance) ? nextRewardBalance : 0);
      const nextRewardMin = Number(summary?.reward_min_purchase_amount ?? 0);
      setRewardMinPurchaseAmount(Number.isFinite(nextRewardMin) ? nextRewardMin : 0);
      setCurrency(String(summary?.currency ?? "FCFA"));
      setWalletStatus(summary?.status ?? null);
      const nextWithdrawFee = Number(summary?.withdraw_fee_amount ?? 1000);
      setWithdrawFeeAmount(Number.isFinite(nextWithdrawFee) ? nextWithdrawFee : 1000);

      const payoutRows = Array.isArray(summary?.payouts) ? summary.payouts : [];
      setPayouts(
        payoutRows
          .map((payout: any) => {
            const amountValue = Number(payout?.amount ?? 0);
            const feeValue = Number(payout?.fee ?? 0);
            const totalDebitValue = Number(payout?.total_debit ?? 0);
            return {
              id: String(payout?.id ?? ""),
              amount: Number.isFinite(amountValue) ? amountValue : 0,
              fee: Number.isFinite(feeValue) ? feeValue : 0,
              total_debit: Number.isFinite(totalDebitValue) ? totalDebitValue : 0,
              currency: String(payout?.currency ?? summary?.currency ?? "FCFA"),
              country: String(payout?.country ?? ""),
              phone: String(payout?.phone ?? ""),
              provider: String(payout?.provider ?? "CINETPAY"),
              provider_ref: payout?.provider_ref ? String(payout.provider_ref) : null,
              status: String(payout?.status ?? "queued"),
              failure_reason: payout?.failure_reason ? String(payout.failure_reason) : null,
              created_at: String(payout?.created_at ?? new Date().toISOString()),
            } satisfies WalletPayout;
          })
          .filter((payout: WalletPayout) => Boolean(payout.id)),
      );

      const txRes = await authFetch(`${API_BASE}/wallet/transactions?limit=${limit}`);
      if (!txRes.ok) return;
      const txPayload = await txRes.json().catch(() => null);
      if (refreshSeq.current !== seq) return;

      const rows = Array.isArray(txPayload?.transactions) ? txPayload.transactions : [];
      const mapped: WalletTx[] = rows
        .map((tx: any) => {
          const amountValue = Number(tx.amount ?? 0);
          return {
            id: String(tx.id ?? ""),
            label: String(tx.label ?? "Transaction wallet"),
            amount: Number.isFinite(amountValue) ? amountValue : 0,
            currency: String(tx.currency ?? summary?.currency ?? "FCFA"),
            created_at: String(tx.created_at ?? new Date().toISOString()),
            type: (tx.type === "debit" ? "debit" : "credit") as "credit" | "debit",
            status: (tx.status === "failed" ? "failed" : tx.status === "pending" ? "pending" : "success") as
              | "success"
              | "pending"
              | "failed",
            reference: tx.reference ? String(tx.reference) : null,
            order_id: tx.order_id != null ? Number(tx.order_id) : null,
            transaction_id: tx.transaction_id ? String(tx.transaction_id) : null,
            order_status: tx.order_status ? String(tx.order_status) : null,
            payment_status: tx.payment_status ? String(tx.payment_status) : null,
            payout_id: tx.payout_id ? String(tx.payout_id) : null,
            payout_status: tx.payout_status ? String(tx.payout_status) : null,
            failure_reason: tx.failure_reason ? String(tx.failure_reason) : null,
          };
        })
        .filter((t: WalletTx) => Boolean(t.id));

      setTransactions(mapped);
    } catch {
      // best effort
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setWithdrawPhone((current) => current || defaultPhone);
  }, [defaultPhone]);

  useEffect(() => {
    setWithdrawCountry((current) => current || defaultCountry);
  }, [defaultCountry]);

  useEffect(() => {
    setWithdrawName((current) => current || String(user?.name ?? ""));
  }, [user?.name]);

  useEffect(() => {
    void loadWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onFocus = () => void loadWallet({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadWallet({ silent: true });
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  useEffect(() => {
    if (!hasPendingTx) return;

    let active = true;
    let ticks = 0;
    const interval = window.setInterval(() => {
      if (!active) return;
      ticks += 1;
      void loadWallet({ silent: true });
      if (ticks >= 10) {
        window.clearInterval(interval);
      }
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPendingTx, limit]);

  useEffect(() => {
    const walletPaid = String(searchParams.get("wallet_paid") ?? "").toLowerCase();
    const topupOrder = searchParams.get("topup_order");
    if (!topupOrder || !HAS_API_ENV) return;

    const providerParam = String(searchParams.get("provider") ?? "fedapay").toLowerCase();
    const provider = providerParam === "paypal" ? "paypal" : "fedapay";

    if (["success", "paid", "completed"].includes(walletPaid)) {
      setBanner("Recharge wallet validée. Ton solde a été mis à jour.");
      emitWalletUpdated({ source: "wallet_topup_paid" });
      void loadWallet({ silent: true });
      router.replace("/wallet");
      return;
    }

    if (["failed", "cancelled", "canceled"].includes(walletPaid)) {
      setBanner(walletPaid === "failed" ? "La recharge wallet a échoué." : "La recharge wallet a été annulée.");
      void loadWallet({ silent: true });
      router.replace("/wallet");
      return;
    }

    let active = true;
    let ticks = 0;

    const checkStatus = async () => {
      try {
        const res = await authFetch(`${API_BASE}/payments/${encodeURIComponent(provider)}/status?order_id=${encodeURIComponent(topupOrder)}`);
        const payload = await res.json().catch(() => null);
        if (!active || !res.ok) return;

        const paymentStatus = String(payload?.data?.payment_status ?? "processing").toLowerCase();
        if (paymentStatus === "paid") {
          setBanner("Recharge wallet validée. Ton solde a été mis à jour.");
          emitWalletUpdated({ source: "wallet_topup_paid" });
          await loadWallet({ silent: true });
          router.replace("/wallet");
          return;
        }

        if (paymentStatus === "failed") {
          setBanner("La recharge wallet a échoué.");
          await loadWallet({ silent: true });
          router.replace("/wallet");
          return;
        }

        if (ticks === 0) {
          setBanner("Recharge en cours de validation...");
        }
      } catch {
        // ignore best effort polling
      }
    };

    void checkStatus();

    const interval = window.setInterval(() => {
      ticks += 1;
      if (ticks > 10) {
        window.clearInterval(interval);
        return;
      }
      void checkStatus();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [authFetch, loadWallet, router, searchParams]);


  const supportMessage = useMemo(() => {
    return "Bonjour, j’ai besoin d’aide concernant mon wallet.";
  }, []);

  const displayBalance = useMemo(() => formatMoney(balance, currency), [balance, currency]);
  const displayRewardBalance = useMemo(() => formatMoney(rewardBalance, currency), [currency, rewardBalance]);
  const { label: currencyLabel } = useMemo(() => normalizeCurrency(currency), [currency]);
  const withdrawMax = useMemo(() => Math.max(0, Math.floor(balance - withdrawFeeAmount)), [balance, withdrawFeeAmount]);
  const topupAmountValue = useMemo(() => Math.round(Number(topupAmount || 0)), [topupAmount]);
  const topupPaymentOptions = useMemo<PaymentMethodOption[]>(() => {
    return [
      {
        key: "paypal",
        title: "PayPal",
        description: "Recharge le DB Wallet avec PayPal. Le montant est converti automatiquement en EUR côté PayPal.",
        badge: "EUR",
        variant: "paypal",
      },
      {
        key: "bank_card",
        title: "Carte bancaire",
        description: "Recharge le DB Wallet par carte bancaire via l’interface sécurisée PayPal pour le moment.",
        badge: "CB",
        variant: "bank_card",
      },
      {
        key: "fedapay",
        title: "Mobile Money",
        description: "Recharge le DB Wallet avec Orange Money, MTN MoMo et les moyens mobiles supportés par FedaPay.",
        badge: "FCFA",
        variant: "mobile_money",
      },
    ];
  }, []);
  const selectedTopupOption = useMemo(
    () => topupPaymentOptions.find((option) => option.key === topupProvider) ?? topupPaymentOptions[0] ?? null,
    [topupPaymentOptions, topupProvider],
  );
  const topupProviderRequestValue = topupProvider === "bank_card" ? "paypal" : topupProvider;

  const handleExchangeReward = async () => {
    if (exchangeLoading) return;
    setBanner(null);
    setExchangeLoading(true);
    try {
      const amountValue = Number(exchangeAmount || 0);
      const payload = Number.isFinite(amountValue) && amountValue > 0 ? { amount: amountValue } : {};
      const res = await authFetch(`${API_BASE}/payments/wallet-reward/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setBanner(data?.message ?? "Échange impossible.");
        return;
      }
      setBanner("Échange effectué (taux appliqué: 70%).");
      setExchangeAmount("");
      await loadWallet({ silent: true });
    } catch {
      setBanner("Échange impossible.");
    } finally {
      setExchangeLoading(false);
    }
  };

  const handleTopup = async () => {
    if (topupLoading) return;
    setBanner(null);

    const amountValue = Math.round(Number(topupAmount || 0));
    if (!Number.isFinite(amountValue) || amountValue < 100) {
      setBanner("Le montant minimum de recharge est 100 FCFA.");
      return;
    }

    setTopupLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/wallet/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountValue, provider: topupProviderRequestValue }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setBanner(data?.message ?? "Impossible de démarrer la recharge wallet.");
        return;
      }

      const paymentUrl = data?.data?.payment_url;
      if (!paymentUrl) {
        setBanner("Lien de paiement indisponible.");
        return;
      }

      setTopupModalOpen(false);
      window.location.href = String(paymentUrl);
    } catch {
      setBanner("Impossible de démarrer la recharge wallet.");
    } finally {
      setTopupLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (withdrawLoading) return;
    setBanner(null);

    const amountValue = Math.round(Number(withdrawAmount || 0));
    if (!Number.isFinite(amountValue) || amountValue < 1) {
      setBanner("Montant de retrait invalide.");
      return;
    }

    if (amountValue > withdrawMax) {
      setBanner("Le montant dépasse le maximum retirable après frais.");
      return;
    }

    if (withdrawPhone.trim().length < 6) {
      setBanner("Renseigne un numéro valide pour recevoir le retrait.");
      return;
    }

    if (withdrawCountry.trim().length !== 2) {
      setBanner("Renseigne un code pays valide sur 2 lettres.");
      return;
    }

    setWithdrawLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/wallet/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountValue,
          payoutDetails: {
            method: withdrawMethod,
            phone: withdrawPhone.trim(),
            country: withdrawCountry.trim().toUpperCase(),
            name: withdrawName.trim() || null,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setBanner(data?.message ?? "Retrait impossible.");
        return;
      }

      setBanner(`Retrait demandé. ${Math.round(withdrawFeeAmount).toLocaleString("fr-FR")} FCFA de frais ont été ajoutés.`);
      setWithdrawAmount("");
      emitWalletUpdated({ source: "wallet_withdraw_request" });
      await loadWallet({ silent: true });
    } catch {
      setBanner("Retrait impossible.");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleResolveRecipient = async () => {
    const query = transferQuery.trim();
    if (query.length < 2) {
      setBanner("Entre un ID wallet, un pseudo ou un numéro.");
      setTransferRecipient(null);
      return;
    }

    setTransferLookupLoading(true);
    setBanner(null);
    try {
      const res = await authFetch(`${API_BASE}/wallet/recipient?query=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setTransferRecipient(null);
        setBanner(data?.message ?? "Destinataire introuvable.");
        return;
      }

      setTransferRecipient(data?.recipient ?? null);
    } catch {
      setTransferRecipient(null);
      setBanner("Destinataire introuvable.");
    } finally {
      setTransferLookupLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (transferLoading) return;
    const amountValue = Math.round(Number(transferAmount || 0));
    if (!transferRecipient) {
      setBanner("Recherche d'abord le destinataire.");
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue < 1) {
      setBanner("Montant de transfert invalide.");
      return;
    }
    if (amountValue > Math.floor(balance)) {
      setBanner("Solde insuffisant.");
      return;
    }

    setTransferLoading(true);
    setBanner(null);
    try {
      const res = await authFetch(`${API_BASE}/wallet/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountValue,
          recipient_query: transferQuery.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setBanner(data?.message ?? "Transfert impossible.");
        return;
      }

      setBanner(`Transfert envoyé à ${transferRecipient.username} sans frais.`);
      setTransferAmount("");
      setTransferQuery("");
      setTransferRecipient(null);
      emitWalletUpdated({ source: "wallet_transfer_sent" });
      await loadWallet({ silent: true });
    } catch {
      setBanner("Transfert impossible.");
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(180,70,255,0.30),transparent_45%),radial-gradient(circle_at_70%_50%,rgba(0,255,255,0.18),transparent_50%),radial-gradient(circle_at_50%_90%,rgba(255,160,0,0.12),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.15),rgba(0,0,0,0.9))]" />
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]" />
      </div>

      <main className="w-full px-5 md:px-10 lg:px-12 py-10 pb-24">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <SectionTitle eyebrow="Wallet" label="PRIME Wallet" />
          

          {banner && (
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
              {banner}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-[28px] border border-white/10 bg-black/45 p-5 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/45">Solde</p>
                  <p className="mt-2 text-4xl font-semibold">{displayBalance}</p>
                  <p className="mt-1 text-xs text-white/60">Devise: {currencyLabel}</p>
                  {walletStatus ? (
                    <p className="mt-1 text-xs text-white/60">Statut: {walletStatus}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadWallet()}
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold"
                    disabled={refreshing}
                  >
                    {refreshing ? "Actualisation..." : "Actualiser"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openTidioChat({ message: supportMessage })}
                    className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
                  >
                    Support
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <GlowButton variant="secondary" onClick={() => router.push("/shop")}>
                  Aller à la boutique
                </GlowButton>
                <GlowButton variant="ghost" onClick={() => router.push("/account")}>
                  Aller au profil
                </GlowButton>
              </div>

              <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-cyan-100/80">DB Wallet ID</p>
                    <p className="mt-1 text-lg font-semibold text-cyan-50">{walletId || "Chargement..."}</p>
                    <p className="mt-1 text-xs text-cyan-100/75">Pseudo public: {walletUsername || String(user?.name ?? "—")}</p>
                  </div>
                  {walletId ? (
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyToClipboard(walletId);
                        if (ok) {
                          setBanner("DB Wallet ID copié.");
                          window.setTimeout(() => setBanner(null), 1500);
                        }
                      }}
                      className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
                    >
                      Copier mon ID
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-sky-100/80">Envoi compte à compte</p>
                    <p className="mt-1 text-sm text-sky-50/85">Envoie de l'argent vers un autre DB Wallet sans frais.</p>
                  </div>
                  <div className="text-xs text-sky-100/75">Recherche par ID wallet, pseudo ou téléphone</div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    value={transferQuery}
                    onChange={(event) => setTransferQuery(event.target.value)}
                    placeholder="DBW-..., pseudo ou téléphone"
                    className="w-full rounded-xl border border-sky-200/25 bg-black/30 px-3 py-2 text-sm text-white"
                  />
                  <GlowButton variant="ghost" onClick={handleResolveRecipient} disabled={transferLookupLoading}>
                    {transferLookupLoading ? "Recherche..." : "Trouver"}
                  </GlowButton>
                </div>

                {transferRecipient ? (
                  <div className="mt-3 rounded-2xl border border-sky-200/20 bg-black/20 p-4">
                    <p className="text-sm font-semibold text-white">{transferRecipient.username}</p>
                    <p className="mt-1 text-xs text-white/70">Wallet: {transferRecipient.wallet_id} • Tel: {transferRecipient.phone_masked}</p>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={Math.floor(balance)}
                    value={transferAmount}
                    onChange={(event) => setTransferAmount(event.target.value)}
                    placeholder={`Montant à envoyer (max ${Math.floor(balance)})`}
                    className="w-full max-w-xs rounded-xl border border-sky-200/25 bg-black/30 px-3 py-2 text-sm text-white"
                  />
                  <GlowButton variant="ghost" onClick={handleTransfer} disabled={transferLoading || !transferRecipient}>
                    {transferLoading ? "Envoi..." : "Envoyer sans frais"}
                  </GlowButton>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-emerald-100/80">Recharge wallet</p>
                    <p className="mt-1 text-sm text-emerald-50/85">Recharge ton DB Wallet via PayPal ou Mobile Money.</p>
                  </div>
                  <div className="text-xs text-emerald-100/75">Minimum: 100 FCFA</div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={100}
                    value={topupAmount}
                    onChange={(event) => setTopupAmount(event.target.value)}
                    placeholder="Montant à recharger"
                    className="w-full max-w-xs rounded-xl border border-emerald-200/25 bg-black/30 px-3 py-2 text-sm text-white"
                  />
                  <GlowButton variant="ghost" onClick={() => setTopupModalOpen(true)} disabled={topupLoading}>
                    {topupLoading ? "Préparation..." : "Choisir le paiement"}
                  </GlowButton>
                </div>

                <div className="mt-3 rounded-2xl border border-emerald-200/20 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{selectedTopupOption?.title ?? "Choisir un moyen"}</p>
                      <p className="mt-1 text-xs text-emerald-50/80">{selectedTopupOption?.description ?? "Sélectionne un moyen de recharge sécurisé."}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTopupModalOpen(true)}
                      className="rounded-xl border border-emerald-200/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                    >
                      Changer
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-orange-300/20 bg-orange-500/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-orange-100/80">Retrait wallet</p>
                    <p className="mt-1 text-sm text-orange-50/85">Les retraits utilisent ton solde principal. Frais fixes: {Math.round(withdrawFeeAmount).toLocaleString("fr-FR")} FCFA.</p>
                  </div>
                  <div className="text-xs text-orange-100/75">Max retirable: {withdrawMax.toLocaleString("fr-FR")} FCFA</div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-white/70">
                    Montant (FCFA)
                    <input
                      type="number"
                      min={1}
                      max={withdrawMax}
                      value={withdrawAmount}
                      onChange={(event) => setWithdrawAmount(event.target.value)}
                      placeholder={`Max ${withdrawMax}`}
                      className="mt-2 w-full rounded-xl border border-orange-200/25 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-white/70">
                    Méthode
                    <select
                      value={withdrawMethod}
                      onChange={(event) => setWithdrawMethod(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-orange-200/25 bg-black/30 px-3 py-2 text-sm text-white"
                    >
                      <option value="wave">Wave</option>
                      <option value="orange_money">Orange Money</option>
                      <option value="mtn_mobile_money">MTN MoMo</option>
                      <option value="moov_money">Moov Money</option>
                      <option value="bank">Banque</option>
                    </select>
                  </label>
                  <label className="text-sm text-white/70">
                    Numéro bénéficiaire
                    <input
                      value={withdrawPhone}
                      onChange={(event) => setWithdrawPhone(event.target.value)}
                      placeholder="Ex: +225..."
                      className="mt-2 w-full rounded-xl border border-orange-200/25 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-sm text-white/70">
                    Code pays
                    <input
                      value={withdrawCountry}
                      onChange={(event) => setWithdrawCountry(event.target.value.toUpperCase())}
                      maxLength={2}
                      placeholder="CI"
                      className="mt-2 w-full rounded-xl border border-orange-200/25 bg-black/30 px-3 py-2 text-sm text-white uppercase"
                    />
                  </label>
                  <label className="text-sm text-white/70 sm:col-span-2">
                    Nom bénéficiaire (optionnel)
                    <input
                      value={withdrawName}
                      onChange={(event) => setWithdrawName(event.target.value)}
                      placeholder="Nom complet"
                      className="mt-2 w-full rounded-xl border border-orange-200/25 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>

                <p className="mt-3 text-xs text-white/60">
                  Montant + frais doivent rester inférieurs ou égaux à ton solde disponible.
                </p>

                <div className="mt-3">
                  <GlowButton variant="ghost" onClick={handleWithdraw} disabled={withdrawLoading || withdrawMax < 1}>
                    {withdrawLoading ? "Envoi du retrait..." : "Demander le retrait"}
                  </GlowButton>
                </div>
              </div>

              {rewardBalance > 0 ? (
                <div className="mt-5 rounded-2xl border border-violet-300/25 bg-violet-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-violet-100/80">Wallet récompense</p>
                  <p className="mt-2 text-lg font-semibold text-violet-100">{displayRewardBalance}</p>
                  {rewardMinPurchaseAmount > 0 ? (
                    <p className="mt-1 text-xs text-violet-100/75">Achat minimum: {Math.floor(rewardMinPurchaseAmount)} FCFA</p>
                  ) : null}
                  <p className="mt-1 text-xs text-violet-100/75">Conversion disponible à 70% (30% de frais).</p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={exchangeAmount}
                      onChange={(event) => setExchangeAmount(event.target.value)}
                      placeholder="Montant à échanger (vide = tout)"
                      className="w-full max-w-xs rounded-xl border border-violet-200/25 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <GlowButton variant="ghost" onClick={handleExchangeReward} disabled={exchangeLoading}>
                      {exchangeLoading ? "Échange..." : "Échanger vers wallet principal"}
                    </GlowButton>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/45 p-5 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/45">Historique</p>
                  <p className="mt-1 text-sm text-white/60">Dernières transactions (limit {limit}).</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-white/60">
                    Limite
                    <select
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value) as 10 | 25 | 50)}
                      className="ml-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </label>
                </div>
              </div>

              {loading ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="h-14 w-full animate-pulse rounded-2xl bg-white/5" />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <p className="mt-4 text-sm text-white/60">Aucune transaction pour le moment.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{tx.label}</p>
                          <p className="mt-1 text-xs text-white/60">
                            {new Date(tx.created_at).toLocaleString("fr-FR")}
                            {tx.reference ? ` • ${tx.reference}` : ""}
                          </p>
                          {tx.counterparty_username || tx.counterparty_wallet_id ? (
                            <p className="mt-1 text-[11px] text-white/55">
                              {tx.type === "debit" ? "Vers" : "Depuis"} {tx.counterparty_username ?? "Utilisateur"}
                              {tx.counterparty_wallet_id ? ` • ${tx.counterparty_wallet_id}` : ""}
                            </p>
                          ) : null}
                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${statusChipClass(tx.status)}`}
                            >
                              {tx.status === "success" ? "Validée" : tx.status === "failed" ? "Échouée" : "En validation"}
                            </span>
                            {tx.reference ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = await copyToClipboard(tx.reference ?? "");
                                  if (ok) {
                                    setBanner("Référence copiée.");
                                    window.setTimeout(() => setBanner(null), 1500);
                                  }
                                }}
                                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/80"
                              >
                                Copier ref
                              </button>
                            ) : null}

                            {null}
                          </div>

                          {tx.status === "pending" && (tx.order_status || tx.payment_status) ? (
                            <p className="mt-2 text-[11px] text-white/55">
                              Statut commande: {tx.order_status ?? "—"} • Paiement: {tx.payment_status ?? "—"}
                            </p>
                          ) : null}
                        </div>

                        <div className="text-right">
                          <p
                            className={`text-lg font-semibold ${tx.type === "credit" ? "text-emerald-300" : "text-rose-300"}`}
                          >
                            {tx.type === "credit" ? "+" : "-"}
                            {formatMoney(Math.abs(tx.amount), tx.currency)}
                          </p>
                          <p className="mt-1 text-xs text-white/60">{tx.currency}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <p>Ton wallet se met à jour automatiquement.</p>
                <p className="mt-2 text-xs text-white/70">En cas de souci, clique sur “Actualiser” ou ouvre le support.</p>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/45">Retraits récents</p>
                    <p className="mt-1 text-sm text-white/60">Suivi des demandes envoyées depuis ton wallet.</p>
                  </div>
                </div>

                {payouts.length === 0 ? (
                  <p className="mt-4 text-sm text-white/60">Aucune demande de retrait pour le moment.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {payouts.map((payout) => (
                      <div key={payout.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Retrait vers {payout.phone}</p>
                            <p className="mt-1 text-xs text-white/60">
                              {new Date(payout.created_at).toLocaleString("fr-FR")} • {payout.provider} • {payout.country}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${payoutStatusChipClass(payout.status)}`}
                              >
                                {payout.status === "sent"
                                  ? "Envoyé"
                                  : payout.status === "failed"
                                    ? "Échec"
                                    : payout.status === "cancelled"
                                      ? "Annulé"
                                      : "En traitement"}
                              </span>
                              {payout.provider_ref ? (
                                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                                  Ref: {payout.provider_ref}
                                </span>
                              ) : null}
                            </div>
                            {payout.failure_reason ? (
                              <p className="mt-2 text-[11px] text-rose-200">{payout.failure_reason}</p>
                            ) : null}
                          </div>

                          <div className="text-right">
                            <p className="text-lg font-semibold text-orange-200">-{formatMoney(Math.abs(payout.total_debit), payout.currency)}</p>
                            <p className="mt-1 text-xs text-white/60">
                              Net: {formatMoney(payout.amount, payout.currency)} • Frais: {formatMoney(payout.fee, payout.currency)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 text-xs text-white/50">
                <Link href="/help/paiement" className="underline underline-offset-4 hover:text-white">
                  Besoin d’aide sur les paiements ?
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PaymentMethodModal
        open={topupModalOpen}
        title="Moyens de paiement"
        subtitle="Nous protégeons vos informations de paiement."
        amountLabel={
          Number.isFinite(topupAmountValue) && topupAmountValue > 0
            ? `Montant à recharger: ${topupAmountValue.toLocaleString("fr-FR")} FCFA`
            : "Entre un montant avant de confirmer la recharge."
        }
        options={topupPaymentOptions}
        value={topupProvider}
        loading={topupLoading}
        status={banner}
        confirmLabel={
          Number.isFinite(topupAmountValue) && topupAmountValue > 0
            ? `Recharger ${topupAmountValue.toLocaleString("fr-FR")} FCFA`
            : "Confirmer la recharge"
        }
        onChange={(key) => setTopupProvider(key as typeof topupProvider)}
        onClose={() => setTopupModalOpen(false)}
        onConfirm={handleTopup}
      />
    </div>
  );
}

export default function WalletPage() {
  return (
    <RequireAuth>
      <WalletClient />
    </RequireAuth>
  );
}
