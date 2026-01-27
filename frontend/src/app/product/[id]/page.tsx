"use client";

import type { MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { BadgePercent, ChevronLeft, ShieldCheck, ShoppingCart, Sparkles, Star, Truck } from "lucide-react";
import GlowButton from "@/components/ui/GlowButton";
import { API_BASE } from "@/lib/config";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCartFlight } from "@/hooks/useCartFlight";

type Product = {
  id: number;
  name: string;
  description?: string;
  price?: number;
  discount_price?: number | null;
  old_price?: number | null;
  type?: string;
  stockType?: "IN_STOCK" | "PREORDER";
  deliveryEtaDays?: number | null;
  estimated_delivery_label?: string | null;
  purchasesCount?: number;
  cartAddsCount?: number;
  ratingAvg?: number;
  ratingCount?: number;
  images?: string[];
};

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { triggerFlight, overlay } = useCartFlight();
  const id = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const loadProduct = async () => {
      try {
        const res = await fetch(`${API_BASE}/products/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setProduct(data);
      } finally {
        if (active) setLoading(false);
      }
    };
    if (id) loadProduct();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  const images = useMemo(() => {
    if (product?.images && product.images.length > 0) return product.images;
    return ["/file.svg", "/file.svg", "/file.svg"];
  }, [product]);
  const coverImage = images[activeImage] ?? images[0];

  const priceValue = Number(product?.discount_price ?? product?.price ?? 0);
  const oldPrice = product?.old_price ? Number(product.old_price) : Math.round(priceValue * 1.2);
  const discountPercent = oldPrice > priceValue ? Math.round(((oldPrice - priceValue) / oldPrice) * 100) : 0;
  const shippingWindow =
    (product?.estimated_delivery_label
      ? `Livraison ${product.estimated_delivery_label}`
      : product?.stockType === "PREORDER"
        ? "Précommande < 3 semaines"
        : "Livraison < 48h");
  const ratingValue = product?.ratingAvg ?? 0;
  const ratingCount = product?.ratingCount ?? 0;

  const handleAddToCart = (event: MouseEvent<HTMLButtonElement>) => {
    if (typeof window === "undefined" || !product) return;
    const stored = localStorage.getItem("bbshop_cart");
    let cart: Array<{ id: number; name: string; description?: string; price: number; priceLabel?: string; quantity: number; type?: string }> = [];
    if (stored) {
      try {
        cart = JSON.parse(stored);
      } catch {
        cart = [];
      }
    }
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity = Number(existing.quantity ?? 0) + 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        description: product.description ?? "",
        price: priceValue,
        priceLabel: `${formatNumber(priceValue)} FCFA`,
        type: product.type ?? "",
        quantity: 1,
      });
    }
    localStorage.setItem("bbshop_cart", JSON.stringify(cart));
    triggerFlight(event.currentTarget);
    setStatusMessage("Ajouté au panier");
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = setTimeout(() => setStatusMessage(null), 2200);
  };

  const proceedToCheckout = () => {
    if (!user) {
      router.push(`/auth/login?next=/produits/${id}`);
      return;
    }
    router.push(`/checkout?product=${id}`);
  };

  const confirmCheckout = () => {
    setShowCheckoutModal(false);
    proceedToCheckout();
  };

  const heroStats = [
    {
      label: "Commandes",
      value: formatNumber(product?.purchasesCount ?? 0),
      caption: "joueurs livrés",
    },
    {
      label: "Vues panier",
      value: formatNumber(product?.cartAddsCount ?? 0),
      caption: "ajouts cumulés",
    },
    {
      label: "Promo",
      value: discountPercent > 0 ? `-${discountPercent}%` : "Live",
      caption: discountPercent > 0 ? "Réduction active" : "Tarif dynamique",
    },
  ];

  const featureTiles = [
    {
      icon: Truck,
      title: "Livraison",
      value: shippingWindow,
      note: "Suivi en temps réel",
    },
    {
      icon: ShieldCheck,
      title: "Protection",
      value: "Garantie vendeur 48h",
      note: "Remboursement express",
    },
    {
      icon: Sparkles,
      title: "Bonus",
      value: "Coffre mystère offert",
      note: "Valeur 2 500 FCFA",
    },
  ];

  if (loading && !product) {
    return (
      <main className="relative flex min-h-[100dvh] items-center justify-center bg-[#04010d] text-white">
        {overlay}
        <div className="text-sm text-white/60">Chargement du produit...</div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] bg-[#04010d] pb-[140px] text-white">
      {overlay}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(99,102,241,0.25),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.2),transparent_50%),linear-gradient(180deg,#03000a,#050111)]" />
      {statusMessage && (
        <div className="fixed right-4 top-[86px] z-50 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/85 px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_45px_rgba(0,0,0,0.55)] backdrop-blur">
          <ShoppingCart className="h-4 w-4 text-cyan-300" />
          <span>{statusMessage}</span>
        </div>
      )}
      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 pt-24 lg:px-8 lg:pb-16 lg:pt-32">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/60"
        >
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.4em] text-white/50">
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1 text-white/80">
            {product?.type ?? "Produit digital"}
          </span>
          <span>{shippingWindow}</span>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
          <section className="space-y-6">
            <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-white/5 shadow-[0_35px_140px_rgba(4,6,35,0.65)]">
              <Image
                src={coverImage}
                alt={product?.name ?? "Produit"}
                fill
                priority
                sizes="(min-width: 1024px) 900px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
              <div className="absolute left-6 right-6 top-6 flex flex-wrap items-center gap-3 text-xs text-white/80">
                <span className="rounded-full bg-white/10 px-3 py-1">
                  {formatNumber(product?.purchasesCount ?? 0)} joueurs livrés
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1">
                  {formatNumber(product?.cartAddsCount ?? 0)} ajouts
                </span>
                {discountPercent > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/25 px-3 py-1 text-amber-100">
                    <BadgePercent className="h-3.5 w-3.5" /> -{discountPercent}%
                  </span>
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 grid gap-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-6 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.35em] text-white/50">{stat.label}</p>
                    <p className="mt-1 text-2xl font-black text-white">{stat.value}</p>
                    <p className="text-[11px] text-white/60">{stat.caption}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {images.slice(0, 4).map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  onClick={() => setActiveImage(idx)}
                  className={`relative h-24 w-full overflow-hidden rounded-2xl border transition ${
                    idx === activeImage ? "border-cyan-300 shadow-[0_15px_40px_rgba(42,252,240,0.25)]" : "border-white/10"
                  }`}
                >
                  <Image src={img} alt="Aperçu" fill sizes="200px" className="object-cover" />
                </button>
              ))}
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Briefing</p>
                <h1 className="text-3xl font-black text-white">{product?.name ?? "Produit indisponible"}</h1>
                <p className="text-sm text-white/70">
                  {product?.description ?? "Description bientôt disponible pour ce produit premium."}
                </p>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">Popularité</p>
                  <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-white">
                    <Star className="h-5 w-5 text-amber-300" />
                    {ratingValue.toFixed(1)}
                    <span className="text-xs text-white/50">({ratingCount} avis)</span>
                  </p>
                  <p className="text-xs text-white/60">Feed premium vérifié</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                  <p className="text-xs uppercase tracking-[0.35em] text-white/40">Statut</p>
                  <p className="mt-2 text-lg font-semibold text-white">{product?.stockType === "PREORDER" ? "Précommande" : "Disponible"}</p>
                  <p className="text-xs text-white/60">{shippingWindow}</p>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[36px] border border-white/10 bg-gradient-to-br from-[#0b0d1a] via-[#0f1628] to-[#0b0d1a] p-6 shadow-[0_25px_90px_rgba(3,6,35,0.7)]">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Offre</p>
                <h2 className="text-2xl font-bold">{product?.name ?? "—"}</h2>
              </div>
              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">Prix</p>
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <span className="text-4xl font-black text-cyan-200">{formatNumber(priceValue)} FCFA</span>
                  {discountPercent > 0 && (
                    <span className="text-base text-white/40 line-through">{formatNumber(oldPrice)} FCFA</span>
                  )}
                  {discountPercent > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1 text-xs text-amber-100">
                      <BadgePercent className="h-3.5 w-3.5" /> Promo active
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={handleAddToCart}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/40 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                >
                  <ShoppingCart className="h-4 w-4" /> Ajouter au panier
                </button>
                <GlowButton onClick={() => setShowCheckoutModal(true)} className="justify-center">
                  Acheter maintenant
                </GlowButton>
              </div>
              <p className="mt-3 text-[11px] text-white/50">Paiement sécurisé - support 24/7</p>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="grid gap-4 sm:grid-cols-2">
                {featureTiles.map((tile) => (
                  <div key={tile.title} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center gap-2 text-white">
                      <tile.icon className="h-4 w-4 text-cyan-300" />
                      <p className="text-sm font-semibold">{tile.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-white/70">{tile.value}</p>
                    <p className="text-xs text-white/40">{tile.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              <p className="text-xs uppercase tracking-[0.35em] text-white/40">Assistance</p>
              <p className="mt-2">
                Besoin d&apos;aide pour finaliser ? Notre équipe vérifie les comptes avant livraison et reste dispo sur le chat support.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {showCheckoutModal && product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#070918]/95 p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.65)]">
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/15 bg-black/40">
                <Image src={coverImage} alt={product.name} fill sizes="64px" className="object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold line-clamp-2">{product.name}</p>
                <p className="text-xs text-white/60">{product.type ?? "Digital"}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/70">
              {product.description ?? "Résumé disponible bientôt."}
            </p>
            <div className="mt-4 flex items-center justify-between text-sm font-semibold">
              <span>Total</span>
              <span className="text-lg text-cyan-200">{formatNumber(priceValue)} FCFA</span>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="flex-1 rounded-2xl border border-white/15 bg-transparent py-3 text-sm text-white"
              >
                Annuler
              </button>
              <GlowButton onClick={confirmCheckout} className="flex-1 justify-center">
                Valider
              </GlowButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
