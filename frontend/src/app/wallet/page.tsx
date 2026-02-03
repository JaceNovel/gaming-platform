"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  order_id?: number | null;
  transaction_id?: string | null;
  order_status?: string | null;
  payment_status?: string | null;
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
  const { authFetch, user } = useAuth();

  const [loading, setLoading] = useState(HAS_API_ENV);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [balance, setBalance] = useState<number>(0);
  const [bonusBalance, setBonusBalance] = useState<number>(0);
  const [bonusExpiresAt, setBonusExpiresAt] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("FCFA");
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string>("");
  const [walletIdToast, setWalletIdToast] = useState<string | null>(null);

  const [limit, setLimit] = useState<10 | 25 | 50>(25);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);

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

      const nextBonus = Number(summary?.bonus_balance ?? 0);
      setBonusBalance(Number.isFinite(nextBonus) ? nextBonus : 0);
      setBonusExpiresAt(typeof summary?.bonus_expires_at === "string" ? summary.bonus_expires_at : null);

      setCurrency(String(summary?.currency ?? "FCFA"));
      setWalletStatus(summary?.status ?? null);
      setWalletId(String(summary?.wallet_id ?? "").trim());

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

  // Wallet topups have been removed.

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


  const supportMessage = useMemo(() => {
    return "Bonjour, j’ai besoin d’aide concernant mon wallet.";
  }, []);

  const rechargeMessage = useMemo(() => {
    const email = String(user?.email ?? "").trim();
    const id = String(walletId ?? "").trim();
    return `Bonjour, j’aimerais recharger mon DBWallet.\nWallet ID : ${id || "(inconnu)"}\nEmail : ${email || "(inconnu)"}`;
  }, [user?.email, walletId]);

  const displayBalance = useMemo(() => formatMoney(balance, currency), [balance, currency]);
  const displayBonus = useMemo(() => formatMoney(bonusBalance, currency), [bonusBalance, currency]);
  const { label: currencyLabel } = useMemo(() => normalizeCurrency(currency), [currency]);

  const bonusIsActive = useMemo(() => {
    if (!(bonusBalance > 0)) return false;
    if (!bonusExpiresAt) return false;
    const expires = new Date(bonusExpiresAt);
    return Number.isFinite(expires.getTime()) && expires.getTime() > Date.now();
  }, [bonusBalance, bonusExpiresAt]);

  const displayBonusExpiresAt = useMemo(() => {
    if (!bonusExpiresAt) return "—";
    const d = new Date(bonusExpiresAt);
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toLocaleString("fr-FR");
  }, [bonusExpiresAt]);

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

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/45">Bonus (recharges uniquement)</p>
                    <p className="mt-1 text-sm font-semibold text-white/90">{displayBonus}</p>
                    <p className="mt-1 text-xs text-white/55">Expire: {displayBonusExpiresAt}</p>
                    {bonusIsActive ? (
                      <p className="mt-1 text-xs text-emerald-200/80">Actif</p>
                    ) : bonusBalance > 0 ? (
                      <p className="mt-1 text-xs text-amber-200/80">Inactif (expiré)</p>
                    ) : null}
                  </div>
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

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/45">Wallet ID</p>
                    <p className="mt-1 truncate text-sm font-semibold text-white/90">{walletId || "—"}</p>
                    <p className="mt-1 text-xs text-white/50">À communiquer à l’admin pour un crédit manuel.</p>
                  </div>

                  <button
                    type="button"
                    className="rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-white/85 disabled:opacity-50"
                    disabled={!walletId}
                    onClick={async () => {
                      if (!walletId) return;
                      const ok = await copyToClipboard(walletId);
                      setWalletIdToast(ok ? "Wallet ID copié" : "Impossible de copier");
                      window.setTimeout(() => setWalletIdToast(null), 1800);
                    }}
                  >
                    Copier
                  </button>
                </div>

                {walletIdToast ? <p className="mt-3 text-xs text-white/60">{walletIdToast}</p> : null}

                <button
                  type="button"
                  onClick={() => void openTidioChat({ message: rechargeMessage })}
                  className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-4 py-3 text-sm font-black text-black active:scale-[0.99]"
                >
                  Recharger mon DBWallet
                </button>
                <p className="mt-2 text-xs text-white/50">
                  Ce bouton n’effectue aucun paiement automatique : il ouvre simplement le chat.
                </p>
              </div>

              {/* Recharge wallet supprimée */}
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
