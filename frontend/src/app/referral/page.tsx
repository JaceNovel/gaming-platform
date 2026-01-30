"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Link2, RefreshCcw, Share2, Users } from "lucide-react";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import SectionTitle from "@/components/ui/SectionTitle";
import GlowButton from "@/components/ui/GlowButton";
import { API_BASE } from "@/lib/config";

type ReferralItem = {
  id: number;
  referred: { id: number; name: string; created_at?: string | null } | null;
  commission_earned: number;
  commission_rate?: number | null;
  commission_base_amount?: number | null;
  rewarded_at?: string | null;
  created_at?: string | null;
};

type ReferralMeResponse = {
  referral: {
    code: string;
    link: string;
    referred_count: number;
    commission_total: number;
  };
  items: ReferralItem[];
};

const formatMoney = (value: number) => `${new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(value)))} FCFA`;

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

function ReferralClient() {
  const { authFetch } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReferralMeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/referrals/me`, { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as ReferralMeResponse | null;
      if (!res.ok || !payload?.referral?.code) {
        throw new Error((payload as any)?.message ?? "Impossible de charger le parrainage");
      }
      setData(payload);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inattendue");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = data?.items ?? [];

  const lastReferredLabel = useMemo(() => {
    const first = items.find((it) => it.referred?.created_at);
    if (!first?.referred?.created_at) return null;
    try {
      return new Date(first.referred.created_at).toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return null;
    }
  }, [items]);

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    setToast(ok ? `${label} copié` : `Impossible de copier ${label}`);
    window.setTimeout(() => setToast(null), 1800);
  };

  const handleShare = async () => {
    const link = data?.referral?.link;
    if (!link) return;

    const title = "Parrainage BADBOYSHOP";
    const text = `Rejoins BADBOYSHOP avec mon lien: ${link}`;

    const nav: any = navigator;
    if (nav?.share) {
      try {
        await nav.share({ title, text, url: link });
        return;
      } catch {
        // fall back to copy
      }
    }

    await handleCopy(link, "Lien");
  };

  return (
    <main className="min-h-[100dvh] bg-[#04020c] text-white pb-24">
      <div className="mobile-shell py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <SectionTitle eyebrow="Compte" label="Parrainage" />
            <p className="mt-1 text-sm text-white/60">
              Partage ton lien, gagne une commission sur le premier dépôt de tes filleuls.
            </p>
          </div>
          <GlowButton variant="secondary" onClick={load} disabled={loading}>
            <span className="inline-flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Rafraîchir
            </span>
          </GlowButton>
        </div>

        {toast && (
          <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
            {toast}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Ton code</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-2xl font-black tracking-[0.2em] text-cyan-200">{loading ? "…" : data?.referral.code ?? "—"}</p>
              <button
                type="button"
                onClick={() => data?.referral.code && handleCopy(data.referral.code, "Code")}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/80 hover:text-white"
              >
                <Copy className="h-4 w-4" />
                Copier
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Lien de parrainage</p>
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/30 px-3 py-3">
                <Link2 className="h-4 w-4 text-white/60" />
                <p className="min-w-0 flex-1 truncate text-sm text-white/80">{loading ? "Chargement…" : data?.referral.link ?? "—"}</p>
              </div>
              <div className="flex gap-2">
                <GlowButton
                  variant="secondary"
                  className="flex-1 justify-center"
                  onClick={() => data?.referral.link && handleCopy(data.referral.link, "Lien")}
                  disabled={loading || !data?.referral.link}
                >
                  <span className="inline-flex items-center gap-2">
                    <Copy className="h-4 w-4" />
                    Copier
                  </span>
                </GlowButton>
                <GlowButton className="flex-1 justify-center" onClick={handleShare} disabled={loading || !data?.referral.link}>
                  <span className="inline-flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Partager
                  </span>
                </GlowButton>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Tes stats</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/70 inline-flex items-center gap-2"><Users className="h-4 w-4" />Filleuls</span>
                <span className="font-semibold">{loading ? "…" : data?.referral.referred_count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/70">Total commissions</span>
                <span className="font-semibold text-emerald-200">{loading ? "…" : formatMoney(data?.referral.commission_total ?? 0)}</span>
              </div>
              {lastReferredLabel && (
                <div className="text-xs text-white/50">Dernier filleul: {lastReferredLabel}</div>
              )}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/60">
                Commission sur le <b>premier dépôt wallet</b> du filleul. VIP: 3% • Standard: 1%.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold">Historique des filleuls</p>
          <p className="mt-1 text-xs text-white/60">Tu vois ici tes inscriptions attribuées et la commission quand elle est déclenchée.</p>

          {loading ? (
            <div className="mt-4 text-sm text-white/60">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-white/70">
              Aucun filleul pour l’instant. Partage ton lien pour démarrer.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{it.referred?.name ?? "Utilisateur"}</p>
                    <p className="text-xs text-white/50">
                      {it.rewarded_at ? "Commission versée" : "En attente du premier dépôt"}
                      {it.commission_rate ? ` • ${(it.commission_rate * 100).toFixed(0)}%` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-200">{formatMoney(it.commission_earned ?? 0)}</p>
                    <p className="text-[11px] text-white/50">{it.rewarded_at ? new Date(it.rewarded_at).toLocaleString("fr-FR") : "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ReferralPage() {
  return (
    <RequireAuth>
      <ReferralClient />
    </RequireAuth>
  );
}
