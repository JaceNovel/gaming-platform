"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { API_BASE } from "@/lib/config";
import { openTidioChat } from "@/lib/tidioChat";

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
  const { authFetch } = useAuth();

  const [loading, setLoading] = useState(HAS_API_ENV);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [balance, setBalance] = useState<number>(0);
  const [currency, setCurrency] = useState<string>("FCFA");
  const [walletStatus, setWalletStatus] = useState<string | null>(null);

  const [limit, setLimit] = useState<10 | 25 | 50>(25);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);

  const [topupAmount, setTopupAmount] = useState("1000");
  const [topupProcessing, setTopupProcessing] = useState(false);
  const [topupMessage, setTopupMessage] = useState<string | null>(null);

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
      setCurrency(String(summary?.currency ?? "FCFA"));
      setWalletStatus(summary?.status ?? null);

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
    const status = (searchParams.get("topup_status") ?? "").toLowerCase();
    if (!status) return;

    if (status === "success" || status === "completed" || status === "paid") {
      setBanner("Recharge wallet réussie.");
    } else if (status === "failed" || status === "cancelled" || status === "canceled") {
      setBanner("Recharge wallet échouée ou annulée.");
    } else {
      setBanner("Recharge wallet en attente de confirmation.");
    }

    const timer = window.setTimeout(() => {
      setBanner(null);
      router.replace("/wallet");
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [router, searchParams]);

  useEffect(() => {
    if (!HAS_API_ENV) return;
    const status = (searchParams.get("topup_status") ?? "").toLowerCase();
    if (!status) return;

    let cancelled = false;

    const reconcile = async () => {
      try {
        const hintRaw = localStorage.getItem("bbshop_last_topup");
        const hint = hintRaw ? JSON.parse(hintRaw) : null;
        await authFetch(`${API_BASE}/wallet/topup/reconcile`, {
          method: "POST",
          body: JSON.stringify({
            order_id: hint?.order_id ?? undefined,
            transaction_id: hint?.transaction_id ?? undefined,
          }),
        });
      } catch {
        // best effort
      } finally {
        if (!cancelled) {
          void loadWallet({ silent: true });
        }
      }
    };

    void reconcile();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
      void authFetch(`${API_BASE}/wallet/topup/reconcile`, {
        method: "POST",
        body: JSON.stringify({ limit: 5 }),
      }).catch(() => null);
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

  const handleTopup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountValue = Number(topupAmount);

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setTopupMessage("Montant invalide.");
      return;
    }

    setTopupProcessing(true);
    setTopupMessage("Connexion au paiement...");

    try {
      const res = await authFetch(`${API_BASE}/wallet/topup/init`, {
        method: "POST",
        body: JSON.stringify({
          amount: amountValue,
          return_url: `${window.location.origin}/wallet/topup/return`,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.message ?? "Impossible de lancer le paiement");
      }

      const paymentUrl = typeof payload?.payment_url === "string" ? payload.payment_url : "";
      if (!paymentUrl) {
        throw new Error("Lien de paiement indisponible");
      }

      try {
        const hint = {
          provider: "fedapay",
          transaction_id: payload?.transaction_id ? String(payload.transaction_id) : undefined,
          order_id: payload?.order_id ? String(payload.order_id) : undefined,
          reference: payload?.reference ? String(payload.reference) : undefined,
          created_at: new Date().toISOString(),
        };
        localStorage.setItem("bbshop_last_topup", JSON.stringify(hint));
      } catch {
        // best effort
      }

      setTopupMessage("Redirection vers FedaPay...");
      window.location.href = paymentUrl;
    } catch (error: any) {
      setTopupMessage(error?.message ?? "Erreur inattendue");
      setTopupProcessing(false);
    }
  };

  const supportMessage = useMemo(() => {
    return "Bonjour, j’ai besoin d’aide concernant mon wallet.";
  }, []);

  const displayBalance = useMemo(() => formatMoney(balance, currency), [balance, currency]);
  const { label: currencyLabel } = useMemo(() => normalizeCurrency(currency), [currency]);

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
          <SectionTitle eyebrow="Wallet" label="BADBOY Wallet" />

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

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-white/45">Recharger</p>
                <p className="mt-1 text-sm text-white/60">Paiement via FedaPay. Aucun plafond journalier.</p>

                <form onSubmit={handleTopup} className="mt-4 space-y-3">
                  <label className="block text-sm text-white/80">
                    Montant ({currencyLabel})
                    <input
                      type="number"
                      min="100"
                      step="100"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-base focus:border-cyan-300 focus:outline-none"
                      placeholder="1000"
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={topupProcessing}
                    className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-5 py-3 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    {topupProcessing ? "Connexion..." : "Lancer FedaPay"}
                  </button>

                  {topupMessage ? <p className="text-sm text-white/70">{topupMessage}</p> : null}
                </form>
              </div>
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
                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${statusChipClass(tx.status)}`}
                            >
                              {tx.status === "success" ? "Validée" : tx.status === "failed" ? "Échouée" : "En cours"}
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
                          </div>
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
                <p>Après une recharge, l’historique se met à jour automatiquement.</p>
                <p className="mt-2 text-xs text-white/70">
                  Si ça tarde, clique sur “Actualiser” ou ouvre le support.
                </p>
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
