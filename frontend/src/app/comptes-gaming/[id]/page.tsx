"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown, ShieldCheck, ShoppingCart, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import GlowButton from "@/components/ui/GlowButton";
import { API_BASE } from "@/lib/config";
import { toDisplayImageSrc } from "@/lib/imageProxy";
import { emitWalletUpdated } from "@/lib/walletEvents";

type ListingDetail = {
  id: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
  price: number | string;
  currency?: string | null;
  account_level?: string | null;
  account_rank?: string | null;
  account_region?: string | null;
  has_email_access?: boolean | null;
  game?: { id: number; name: string; image?: string | null } | null;
  seller_trust?: { totalSales?: number; successRate?: number; badges?: string[] } | null;
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1400&q=80";

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

function MarketplaceListingClient({ id }: { id: number }) {
  const router = useRouter();
  const { user, authFetch } = useAuth();

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"fedapay" | "wallet">("fedapay");
  const [buyerPhone, setBuyerPhone] = useState<string>("");

  const isValidBuyerPhone = useMemo(() => {
    const raw = buyerPhone.trim();
    const digits = raw.replace(/\D+/g, "");
    if (!digits) return false;
    if (/^0+$/.test(digits)) return false;
    return digits.length >= 6;
  }, [buyerPhone]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setListing(null);
      try {
        const res = await fetch(`${API_BASE}/gaming-accounts/listings/${id}`, { cache: "no-store" });
        const payload = await res.json().catch(() => null);
        if (!active) return;
        if (!res.ok) {
          setListing(null);
          return;
        }
        const data = (payload?.data ?? payload) as ListingDetail;
        setListing(data && typeof data === "object" ? data : null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  const priceValue = useMemo(() => {
    const v = Number(listing?.price ?? 0);
    return Number.isFinite(v) ? v : 0;
  }, [listing?.price]);

  const imageUrl = useMemo(() => {
    const rawListing = String(listing?.image_url ?? "").trim();
    if (rawListing) return toDisplayImageSrc(rawListing) ?? rawListing;
    const rawGame = String(listing?.game?.image ?? "").trim();
    return rawGame ? (toDisplayImageSrc(rawGame) ?? rawGame) : FALLBACK_IMAGE;
  }, [listing?.game?.image, listing?.image_url]);

  const badges = useMemo(() => {
    const b = listing?.seller_trust?.badges;
    return Array.isArray(b) ? b.filter(Boolean) : [];
  }, [listing?.seller_trust?.badges]);

  const successRate = useMemo(() => {
    const r = listing?.seller_trust?.successRate;
    const n = typeof r === "number" ? r : Number(r ?? NaN);
    return Number.isFinite(n) ? n : null;
  }, [listing?.seller_trust?.successRate]);

  const totalSales = useMemo(() => {
    const t = listing?.seller_trust?.totalSales;
    const n = typeof t === "number" ? t : Number(t ?? NaN);
    return Number.isFinite(n) ? n : null;
  }, [listing?.seller_trust?.totalSales]);

  const buildCustomerPayload = () => {
    const rawUser: any = user ?? {};
    const fullName = String(rawUser?.name ?? rawUser?.full_name ?? "").trim();
    const parts = fullName ? fullName.split(/\s+/) : [];
    const firstName = String(rawUser?.first_name ?? parts[0] ?? "Client").trim() || "Client";
    const lastName = String(rawUser?.last_name ?? parts.slice(1).join(" ") ?? "").trim();

    const email = String(rawUser?.email ?? "").trim();
    const phone = buyerPhone.trim() || String(rawUser?.phone ?? rawUser?.phone_number ?? "").trim() || "";

    return {
      customer_name: `${firstName}${lastName ? ` ${lastName}` : ""}`.trim(),
      customer_email: email,
      customer_phone_number: phone,
    };
  };

  const handleBuy = async () => {
    if (!listing) return;

    if (!user) {
      const next = `/comptes-gaming/${id}`;
      router.push(`/auth/login?next=${encodeURIComponent(next)}`);
      return;
    }

    setStatus(null);
    if (!isValidBuyerPhone) {
      setStatus("Veuillez entrer un numéro de téléphone valide.");
      return;
    }
    setSubmitting(true);
    try {
      const checkoutRes = await authFetch(`${API_BASE}/gaming-accounts/listings/${id}/checkout`, {
        method: "POST",
        body: JSON.stringify({ buyer_phone: buyerPhone.trim() }),
      });
      const checkoutPayload = await checkoutRes.json().catch(() => null);
      if (!checkoutRes.ok) {
        setStatus(checkoutPayload?.message ?? "Impossible de démarrer l'achat.");
        return;
      }

      const order = checkoutPayload?.order;
      const orderId = Number(order?.id ?? 0);
      const amountToCharge = Number(Number(order?.total_price ?? priceValue ?? 0).toFixed(2));
      if (!Number.isFinite(orderId) || orderId <= 0) {
        setStatus("Commande invalide.");
        return;
      }
      if (!Number.isFinite(amountToCharge) || amountToCharge <= 0) {
        setStatus("Montant de commande invalide.");
        return;
      }

      if (paymentMethod === "wallet") {
        const payRes = await authFetch(`${API_BASE}/payments/wallet/pay`, {
          method: "POST",
          body: JSON.stringify({ order_id: orderId }),
        });
        const payPayload = await payRes.json().catch(() => null);
        if (!payRes.ok) {
          setStatus(payPayload?.message ?? "Paiement wallet impossible.");
          return;
        }
        emitWalletUpdated({ source: "marketplace_listing_wallet_pay" });
        router.replace(`/order-confirmation?order=${orderId}&status=paid`);
        return;
      }

      const currency = "XOF";
      const customer = buildCustomerPayload();
      const callbackUrl = `${window.location.origin}/order-confirmation?order=${orderId}`;

      const payRes = await authFetch(`${API_BASE}/payments/fedapay/init`, {
        method: "POST",
        body: JSON.stringify({
          order_id: orderId,
          payment_method: "fedapay",
          amount: amountToCharge,
          currency,
          customer_email: customer.customer_email,
          customer_name: customer.customer_name,
          customer_phone: customer.customer_phone_number,
          description: `Marketplace #${orderId} - ${customer.customer_email || ""}`,
          callback_url: callbackUrl,
          metadata: {
            source: "marketplace_listing",
            seller_listing_id: id,
          },
        }),
      });

      if (!payRes.ok) {
        const err = await payRes.json().catch(() => ({}));
        setStatus(err.message ?? "Impossible de démarrer le paiement.");
        return;
      }

      const payData = await payRes.json().catch(() => null);
      const paymentUrl = typeof payData?.data?.payment_url === "string" ? payData.data.payment_url : "";
      if (!paymentUrl) {
        setStatus("Paiement indisponible : URL manquante.");
        return;
      }
      setStatus("Redirection vers Mobile Money...");
      window.location.href = paymentUrl;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Connexion au serveur impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-[100dvh] bg-black text-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-10">
          <div className="h-6 w-40 rounded-full bg-white/10" />
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="h-[360px] rounded-3xl border border-white/10 bg-white/5" />
            <div className="h-[360px] rounded-3xl border border-white/10 bg-white/5" />
          </div>
        </div>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-[100dvh] bg-black text-white">
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
          <p className="text-sm text-white/60">Annonce introuvable ou indisponible.</p>
          <div className="mt-6">
            <Link href="/shop" className="text-cyan-300">
              Retour à la boutique
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-black text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.25),transparent_45%),radial-gradient(circle_at_75%_0%,rgba(14,165,233,0.22),transparent_50%),radial-gradient(circle_at_60%_80%,rgba(249,115,22,0.14),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.2),rgba(0,0,0,0.92))]" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">Marketplace</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-semibold">{listing.title}</h1>
            <p className="mt-2 text-sm text-white/60">
              {listing.game?.name ? `${listing.game.name} • ` : ""}
              Compte Gaming
            </p>
          </div>
          <Link href="/shop" className="text-sm text-white/70 hover:text-white">
            Retour
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <div className="relative w-full overflow-hidden aspect-[1242/552]">
              <img
                src={toDisplayImageSrc(imageUrl) ?? imageUrl}
                alt={listing.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
              <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                  Livraison 24H
                </span>
                {badges.includes("verified") && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                    <ShieldCheck className="h-4 w-4" />
                    Vendeur vérifié
                  </span>
                )}
                {badges.includes("new") && (
                  <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                    Nouveau
                  </span>
                )}
                {badges.includes("under_surveillance") && (
                  <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
                    Sous surveillance
                  </span>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {listing.account_level ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/50">Niveau</p>
                    <p className="mt-1 text-sm font-semibold">{listing.account_level}</p>
                  </div>
                ) : null}
                {listing.account_rank ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/50">Rang</p>
                    <p className="mt-1 text-sm font-semibold">{listing.account_rank}</p>
                  </div>
                ) : null}
                {listing.account_region ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/50">Région</p>
                    <p className="mt-1 text-sm font-semibold">{listing.account_region}</p>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/50">Accès email</p>
                  <p className="mt-1 text-sm font-semibold">{listing.has_email_access ? "Oui" : "Non"}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-white/50">Description</p>
                <p className="mt-2 text-sm text-white/70 whitespace-pre-wrap">
                  {String(listing.description ?? "").trim() || "Aucune description fournie."}
                </p>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">Prix</p>
              <div className="mt-2 text-3xl font-black text-fuchsia-200">
                {formatNumber(priceValue)} FCFA
              </div>
              <p className="mt-2 text-sm text-white/60">Livraison sous 24h</p>

              {typeof successRate === "number" && typeof totalSales === "number" ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs text-white/60">Confiance vendeur</p>
                  <p className="mt-1 text-sm font-semibold text-white/85">
                    {Math.round(successRate * 100)}% succès • {totalSales} vente{totalSales > 1 ? "s" : ""}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-white/60">Téléphone (obligatoire)</p>
                <input
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  disabled={submitting}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/90 placeholder:text-white/35"
                  placeholder="Votre numéro WhatsApp / téléphone"
                />
                {!isValidBuyerPhone && buyerPhone.trim() ? (
                  <p className="mt-2 text-xs text-amber-200">Numéro invalide.</p>
                ) : null}
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("fedapay")}
                    className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      paymentMethod === "fedapay"
                        ? "border-cyan-300/50 bg-cyan-400/10 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                    }`}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Mobile Money
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("wallet")}
                    className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      paymentMethod === "wallet"
                        ? "border-emerald-300/50 bg-emerald-400/10 text-emerald-100"
                        : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                    }`}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Wallet
                    </span>
                  </button>
                </div>

                <GlowButton onClick={handleBuy} disabled={submitting}>
                  <span className="inline-flex items-center justify-center gap-2">
                    <Crown className="h-4 w-4" />
                    {submitting ? "Traitement..." : "Acheter maintenant"}
                  </span>
                </GlowButton>

                {status && (
                  <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
                    {status}
                  </p>
                )}

                <p className="text-xs text-white/50">
                  L'achat réserve l'annonce 20 minutes. Après paiement, le WhatsApp du vendeur est révélé.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-6">
              <p className="text-xs text-white/60">
                Besoin d'aide ? Les litiges sont possibles après paiement depuis votre espace commande.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function MarketplaceListingPage({ params }: { params: { id: string } }) {
  const numericId = useMemo(() => {
    const trimmed = String(params.id ?? "").trim();
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }, [params.id]);

  if (!numericId) {
    return (
      <main className="min-h-[100dvh] bg-black text-white">
        <div className="mx-auto w-full max-w-3xl px-6 py-12">
          <p className="text-sm text-white/60">Identifiant d'annonce invalide.</p>
          <div className="mt-6">
            <Link href="/shop" className="text-cyan-300">
              Retour à la boutique
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <MarketplaceListingClient id={numericId} />;
}
