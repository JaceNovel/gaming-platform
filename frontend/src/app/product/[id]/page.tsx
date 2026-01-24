"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronDown, ChevronLeft, ShoppingCart, Star, Truck } from "lucide-react";
import GlowButton from "@/components/ui/GlowButton";
import { API_BASE } from "@/lib/config";
import { useAuth } from "@/components/auth/AuthProvider";

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
  const id = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [showDescription, setShowDescription] = useState(false);
  const [cartAnimation, setCartAnimation] = useState(false);
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

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

  const images = useMemo(() => {
    if (product?.images && product.images.length > 0) return product.images;
    return ["/file.svg", "/file.svg", "/file.svg"];
  }, [product]);
  const coverImage = images[activeImage] ?? images[0];
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const priceValue = Number(product?.discount_price ?? product?.price ?? 0);
  const oldPrice = product?.old_price ? Number(product.old_price) : Math.round(priceValue * 1.2);
  const discountPercent = oldPrice > priceValue ? Math.round(((oldPrice - priceValue) / oldPrice) * 100) : 0;

  const handleAddToCart = () => {
    if (typeof window === "undefined" || !product) return;
    const stored = localStorage.getItem("bbshop_cart");
    const cart = stored ? (JSON.parse(stored) as Array<{ id: number; quantity: number } & Record<string, unknown>>) : [];
    const existing = cart.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity = (existing.quantity as number) + 1;
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
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    setCartAnimation(true);
    animationTimeoutRef.current = setTimeout(() => setCartAnimation(false), 900);
  };

  const proceedToCheckout = () => {
    if (!user) {
      router.push(`/auth/login?next=/product/${id}`);
      return;
    }
    router.push(`/checkout?product/${id}`);
  };

  const confirmCheckout = () => {
    setShowCheckoutModal(false);
    proceedToCheckout();
  };

  return (
    <main className="min-h-[100dvh] bg-black text-white pb-[calc(120px+env(safe-area-inset-bottom))]">
      {cartAnimation && (
        <>
          <div
            className="pointer-events-none fixed left-1/2 bottom-32 z-50 h-4 w-4 rounded-full bg-cyan-300 shadow-lg"
            style={{ animation: "cart-flight 0.9s ease forwards" }}
          />
          <div className="pointer-events-none fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-100 shadow-lg">
            <ShoppingCart className="h-4 w-4" />
            Ajouté au panier
          </div>
        </>
      )}
      <div className="mobile-shell py-4">
        <button
          onClick={() => router.back()}
          className="mb-3 inline-flex items-center gap-2 text-xs text-white/60"
        >
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <div className="relative h-72 w-full">
            <Image
              src={images[activeImage]}
              alt={product?.name ?? "Produit"}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
            <div className="absolute left-3 top-3 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
              {formatNumber(product?.purchasesCount ?? 0)} clients ont acheté
            </div>
            <div className="absolute right-3 top-3 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
              {formatNumber(product?.cartAddsCount ?? 0)} ajoutés au panier
            </div>
            {discountPercent > 0 && (
              <div className="absolute bottom-3 left-3 rounded-full bg-amber-400/20 px-3 py-1 text-xs text-amber-200">
                -{discountPercent}%
              </div>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto p-3">
            {images.map((img, idx) => (
              <button
                key={img + idx}
                onClick={() => setActiveImage(idx)}
                className={`relative h-16 w-16 overflow-hidden rounded-xl border ${
                  idx === activeImage ? "border-cyan-300" : "border-white/10"
                }`}
              >
                <Image src={img} alt="thumb" fill className="object-cover" sizes="64px" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <h1 className="text-xl font-bold">{product?.name ?? "Chargement..."}</h1>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Star className="h-4 w-4 text-amber-300" />
            {product?.ratingAvg?.toFixed(1) ?? "0.0"} ({product?.ratingCount ?? 0} avis)
            <span>•</span>
            {formatNumber(product?.purchasesCount ?? 0)} ventes
          </div>
          <div className="flex items-center gap-3">
            <div className="text-2xl font-black text-cyan-200">{formatNumber(priceValue)} FCFA</div>
            {discountPercent > 0 && (
              <div className="text-sm text-white/40 line-through">{formatNumber(oldPrice)} FCFA</div>
            )}
            {discountPercent > 0 && (
              <span className="rounded-full bg-amber-400/20 px-2 py-1 text-[10px] text-amber-200">
                -{discountPercent}%
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowDescription((prev) => !prev)}
          className="mt-4 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
        >
          Description
          <ChevronDown className={`h-4 w-4 transition ${showDescription ? "rotate-180" : ""}`} />
        </button>
        {showDescription && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            {product?.description ?? "Description bientôt disponible."}
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
          <div className="flex items-center gap-2 text-white/80">
            <Truck className="h-4 w-4 text-cyan-300" /> Livraison
          </div>
          <div className="mt-2 text-white/70">
            {product?.stockType === "PREORDER" ? "Livraison < 3 semaines" : "Livraison < 2 jours"}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Avis clients</div>
          <div className="mt-2 text-xs text-white/60">Aucun avis pour le moment.</div>
        </div>
      </div>

      <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-0 right-0 z-40">
        <div className="mobile-shell">
          <div className="flex gap-3 rounded-2xl border border-white/10 bg-black/80 p-3 backdrop-blur">
            <button
              onClick={handleAddToCart}
              className="flex-1 rounded-2xl border border-white/10 bg-white/10 py-3 text-sm text-white"
            >
              Ajouter au panier
            </button>
            <GlowButton onClick={() => setShowCheckoutModal(true)} className="flex-1 justify-center">
              Acheter
            </GlowButton>
          </div>
        </div>
      </div>
      {showCheckoutModal && product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-white/10">
                <Image src={coverImage} alt={product.name} fill className="object-cover" sizes="64px" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold line-clamp-2">{product.name}</div>
                <div className="text-xs text-white/50">{product.type ?? "Digital"}</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/70 line-clamp-3">
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
      <style jsx>{`
        @keyframes cart-flight {
          0% {
            transform: translate(-50%, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(140px, -320px) scale(0.3);
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}
