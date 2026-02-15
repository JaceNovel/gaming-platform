"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Crown, House, ShieldCheck, Wallet } from "lucide-react";
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
  gallery_image_urls?: string[] | null;
  price: number | string;
  currency?: string | null;
  account_level?: string | null;
  account_rank?: string | null;
  account_region?: string | null;
  has_email_access?: boolean | null;
  seller_company_name?: string | null;
  game?: { id: number; name: string; image?: string | null } | null;
  seller_trust?: { totalSales?: number; successRate?: number; badges?: string[] } | null;
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1400&q=80";

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

function MarketplaceListingClient({ id }: { id: number }) {
  const router = useRouter();
  const { user, authFetch } = useAuth();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/gaming-accounts");
  };

  const [loading, setLoading] = useState(true);
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"fedapay" | "wallet">("fedapay");
  const [buyerPhone, setBuyerPhone] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawUser: any = user ?? {};
    const fromUser = String(rawUser?.phone ?? rawUser?.phone_number ?? "").trim();
    const saved = String(window.localStorage.getItem("bbshop_buyer_phone") ?? "").trim();
    const candidate = fromUser || saved;
    if (candidate && !buyerPhone.trim()) {
      setBuyerPhone(candidate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const persistBuyerPhone = async (phone: string) => {
    const trimmed = String(phone ?? "").trim();
    if (!trimmed) return;

    if (typeof window !== "undefined") {
      window.localStorage.setItem("bbshop_buyer_phone", trimmed);
    }

    const rawUser: any = user ?? {};
    const existing = String(rawUser?.phone ?? rawUser?.phone_number ?? "").trim();
    if (existing) return;

    try {
      await authFetch(`${API_BASE}/me/profile`, {
        method: "PATCH",
        body: JSON.stringify({ phone: trimmed }),
      });
    } catch {
      // best-effort
    }
  };

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

  const gallery = useMemo(() => {
    const urls = Array.isArray(listing?.gallery_image_urls) ? listing.gallery_image_urls : [];
    return urls
      .map((src, idx) => {
        const raw = String(src ?? "").trim();
        if (!raw) return null;
        const safe = toDisplayImageSrc(raw) ?? raw;
        return safe ? { raw, safe, idx } : null;
      })
      .filter(Boolean) as Array<{ raw: string; safe: string; idx: number }>;
  }, [listing?.gallery_image_urls]);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    setSelectedImage(imageUrl);
  }, [imageUrl, id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!lightboxSrc) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSrc(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxSrc]);

  const mainImageSrc = selectedImage || imageUrl;

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

  const sellerCompany = useMemo(() => String(listing?.seller_company_name ?? "").trim(), [listing?.seller_company_name]);

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

    await persistBuyerPhone(buyerPhone);
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
        setStatus("Validation du paiement wallet...");

        const attemptPay = async () => {
          const payRes = await authFetch(`${API_BASE}/payments/wallet/pay`, {
            method: "POST",
            body: JSON.stringify({ order_id: orderId }),
          });
          const payPayload = await payRes.json().catch(() => null);
          return { payRes, payPayload };
        };

        // Sometimes marketplace finalization may take a short moment.
        let lastError: any = null;
        for (let i = 0; i < 3; i++) {
          const { payRes, payPayload } = await attemptPay();
          if (payRes.ok) {
            emitWalletUpdated({ source: "marketplace_listing_wallet_pay" });
            router.replace(`/order-confirmation?order=${orderId}&status=paid`);
            return;
          }

          // 409 = still processing; retry quickly.
          if (payRes.status === 409) {
            lastError = payPayload;
            setStatus("Finalisation de la commande..." + (i < 2 ? "" : " Réessaie."));
            await new Promise((r) => setTimeout(r, 700 + i * 500));
            continue;
          }

          setStatus(payPayload?.message ?? "Paiement wallet impossible.");
          return;
        }

        setStatus(lastError?.message ?? "Finalisation en cours. Réessaie dans quelques secondes.");
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
          <p className="text-sm text-white/60">😵‍💫 Annonce introuvable ou indisponible.</p>
          <div className="mt-6">
            <button type="button" onClick={handleBack} className="text-cyan-300">
              ⬅ Retour
            </button>
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
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">🎮 Marketplace</p>
            <h1 className="mt-1 text-2xl md:text-3xl font-semibold">{listing.title}</h1>
            <p className="mt-2 text-sm text-white/60">
              {listing.game?.name ? `${listing.game.name} • ` : ""}
              Compte Gaming ✨
            </p>
            {sellerCompany ? (
              <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-fuchsia-300/35 bg-gradient-to-r from-fuchsia-500/20 via-violet-500/20 to-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-fuchsia-100">
                <House className="h-4 w-4 shrink-0 text-cyan-200" />
                <span className="truncate">{sellerCompany}</span>
              </div>
            ) : null}
          </div>
          <button type="button" onClick={handleBack} className="text-sm text-white/70 hover:text-white">
            ⬅ Retour
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <div className="relative w-full overflow-hidden aspect-[1242/552]">
              <button
                type="button"
                onClick={() => setLightboxSrc(mainImageSrc)}
                className="group absolute inset-0"
                aria-label="Agrandir la photo"
              >
                <img
                  src={mainImageSrc}
                  alt={listing.title}
                  className="h-full w-full object-cover transition group-hover:scale-[1.01] cursor-zoom-in"
                />
              </button>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
              <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
                  ⏱ Livraison 24H
                </span>
                {badges.includes("verified") && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                    <ShieldCheck className="h-4 w-4" />
                    Vendeur vérifié ✅
                  </span>
                )}
              </div>
            </div>

            <div className="p-6">
              {gallery.length ? (
                <div className="mb-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/50">🖼️ Photos</p>
                  <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                    {gallery.slice(0, 4).map((row) => {
                      const active = row.safe === mainImageSrc;
                      return (
                        <button
                          key={`${row.raw}_${row.idx}`}
                          type="button"
                          onClick={() => setSelectedImage(row.safe)}
                          className={`h-28 w-44 flex-none overflow-hidden rounded-2xl border object-cover transition sm:h-32 sm:w-52 ${
                            active ? "border-cyan-300/40" : "border-white/10 hover:border-white/25"
                          }`}
                          aria-label={`Afficher la photo ${row.idx + 1}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={row.safe} alt={`photo ${row.idx + 1}`} className="h-full w-full object-cover" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-white/50">🧾 Informations du compte</p>
                <p className="mt-2 text-sm text-white/70">
                  Toutes les infos renseignées par le vendeur sont visibles ici. Après paiement, le contact vendeur est révélé pour finaliser la livraison.
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {listing.account_level ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/50">🏆 Niveau</p>
                    <p className="mt-1 text-sm font-semibold">{listing.account_level}</p>
                  </div>
                ) : null}
                {listing.account_rank ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/50">🥇 Rang</p>
                    <p className="mt-1 text-sm font-semibold">{listing.account_rank}</p>
                  </div>
                ) : null}
                {listing.account_region ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/50">🌍 Région</p>
                    <p className="mt-1 text-sm font-semibold">{listing.account_region}</p>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/50">📧 Accès email</p>
                  <p className="mt-1 text-sm font-semibold">{listing.has_email_access ? "Oui" : "Non"}</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-white/50">📝 Description</p>
                <p className="mt-2 text-sm text-white/70 whitespace-pre-wrap">
                  {String(listing.description ?? "").trim() || "Aucune description fournie."}
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/50">🛡️ Sécurité</p>
                  <p className="mt-2 text-sm text-white/70">Paiement sécurisé. L'annonce est réservée 20 minutes pendant le paiement.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/50">⚖️ Litige</p>
                  <p className="mt-2 text-sm text-white/70">En cas de souci, tu peux ouvrir un litige depuis ta commande.</p>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">💎 Prix</p>
              <div className="mt-2 text-3xl font-black text-fuchsia-200">
                {formatNumber(priceValue)} FCFA
              </div>
              <p className="mt-2 text-sm text-white/60">🚀 Livraison sous 24h</p>

              {typeof successRate === "number" && typeof totalSales === "number" ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs text-white/60">🧠 Confiance vendeur</p>
                  <p className="mt-1 text-sm font-semibold text-white/85">
                    {Math.round(successRate * 100)}% succès • {totalSales} vente{totalSales > 1 ? "s" : ""}
                  </p>
                  <p className="mt-1 text-xs text-white/55">✅ Vérifié = vendeur approuvé</p>
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <p className="text-xs text-white/60">📲 Téléphone (obligatoire)</p>
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
                      📲 Mobile Money
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
                    {submitting ? "Traitement..." : "⚡ Acheter maintenant"}
                  </span>
                </GlowButton>

                {status && (
                  <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
                    {status}
                  </p>
                )}

                <p className="text-xs text-white/50">
                  ⏳ L'achat réserve l'annonce 20 minutes. Après paiement, le WhatsApp du vendeur est révélé.
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

      {lightboxSrc ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxSrc(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Aperçu"
            className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </main>
  );
}

export default function MarketplaceListingPage() {
  const params = useParams();

  const listingId = useMemo(() => {
    const rawParam = (params as any)?.id;
    const raw = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    const trimmed = String(raw ?? "").trim();
    if (!trimmed) return null;
    const direct = Number(trimmed);
    if (Number.isFinite(direct) && direct > 0) return Math.trunc(direct);
    const match = trimmed.match(/(\d+)/);
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }, [params]);

  // On SSR, dynamic params may not be available for a client page.
  // Show the same premium skeleton instead of a false "not found".
  if (!listingId) {
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

  return <MarketplaceListingClient id={listingId} />;
}
