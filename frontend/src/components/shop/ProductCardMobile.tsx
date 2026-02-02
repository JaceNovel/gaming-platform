"use client";

import { MouseEvent, useEffect, useMemo, useState } from "react";
import { Heart, ShoppingBag } from "lucide-react";
import DeliveryBadge from "@/components/ui/DeliveryBadge";
import { getDeliveryBadgeDisplay } from "@/lib/deliveryDisplay";
import { toDisplayImageSrc } from "@/lib/imageProxy";
import { openTidioChat } from "@/lib/tidioChat";

export type ProductCardMobileProduct = {
  id: number;
  name: string;
  description: string;
  priceLabel: string;
  priceValue: number;
  oldPrice?: number;
  discountPercent?: number;
  likes: number;
  category: string;
  type: string;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  displaySection?: string | null;
  deliveryEtaDays?: number | null;
  estimatedDeliveryLabel?: string | null;
  deliveryEstimateLabel?: string | null;
};

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR").format(value);

export function ProductCardMobileSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[18px] border border-white/10 bg-white/5 p-3 shadow-[0_20px_70px_rgba(4,6,35,0.6)]">
      <div className="animate-pulse">
        <div className="aspect-[4/3] w-full rounded-[16px] bg-white/10" />
        <div className="mt-3 h-3 w-2/3 rounded-full bg-white/10" />
        <div className="mt-2 h-3 w-5/6 rounded-full bg-white/10" />
        <div className="mt-4 flex items-center justify-between">
          <div className="h-4 w-20 rounded-full bg-white/10" />
          <div className="h-4 w-10 rounded-full bg-white/10" />
        </div>
        <div className="mt-4 h-10 w-full rounded-full bg-white/10" />
      </div>
    </div>
  );
}

export default function ProductCardMobile({
  product,
  onAddToCart,
  onView,
  onLike,
  fallbackImageUrl,
  index = 0,
}: {
  product: ProductCardMobileProduct;
  onAddToCart: (product: ProductCardMobileProduct, origin?: HTMLElement | null) => void;
  onView: (product: ProductCardMobileProduct) => void;
  onLike: (product: ProductCardMobileProduct) => void;
  fallbackImageUrl: string;
  index?: number;
}) {
  const [adding, setAdding] = useState(false);
  const [likePulse, setLikePulse] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const isRechargeDirect = (product.displaySection ?? "").toLowerCase() === "recharge_direct";
  const cardImage = product.bannerUrl ?? product.imageUrl ?? fallbackImageUrl;

  const badgeLabel = useMemo(() => {
    if (product.discountPercent) return `-${product.discountPercent}%`;
    if (product.likes > 30) return "Populaire";
    return product.category;
  }, [product.category, product.discountPercent, product.likes]);

  const delivery = getDeliveryBadgeDisplay({
    type: product.type,
    displaySection: product.displaySection ?? null,
    deliveryEtaDays: product.deliveryEtaDays ?? null,
    estimatedDeliveryLabel: product.estimatedDeliveryLabel ?? null,
    deliveryEstimateLabel: product.deliveryEstimateLabel ?? null,
  });

  useEffect(() => {
    const id = window.setTimeout(() => setRevealed(true), Math.min(240, index * 35));
    return () => window.clearTimeout(id);
  }, [index]);

  const handleChatOrBuy = () => {
    if (isRechargeDirect) {
      void openTidioChat({
        message: `Bonjour, je veux une Recharge Direct : ${product.name} (ID: ${product.id}).`,
      });
      return;
    }

    onView(product);
  };

  const handleAddToCart = (event: MouseEvent<HTMLButtonElement>) => {
    if (isRechargeDirect) {
      onView(product);
      return;
    }

    setAdding(true);
    window.setTimeout(() => setAdding(false), 520);
    onAddToCart(product, event.currentTarget);
  };

  const handleLike = () => {
    setLikePulse(true);
    window.setTimeout(() => setLikePulse(false), 520);
    onLike(product);
  };

  return (
    <div
      className={
        "group relative overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(217,70,239,0.16),rgba(251,146,60,0.12))] p-px shadow-[0_22px_80px_rgba(4,6,35,0.65)] " +
        "transition-transform duration-300 active:scale-[0.99] " +
        (revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")
      }
      style={{ transitionProperty: "opacity, transform" }}
    >
      <div className="relative overflow-hidden rounded-[17px] border border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
          <div className="absolute -left-10 -top-10 h-28 w-28 rounded-full bg-cyan-400/20 blur-2xl" />
          <div className="absolute -bottom-12 -right-10 h-32 w-32 rounded-full bg-fuchsia-400/15 blur-2xl" />
        </div>

        <div className="relative p-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] border border-white/10 bg-black/30">
            <img
              src={toDisplayImageSrc(cardImage) ?? cardImage}
              alt={product.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

            <div className="pointer-events-none absolute -inset-20 opacity-0 transition duration-500 group-hover:opacity-100">
              <div className="absolute left-1/2 top-1/2 h-56 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-12 bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm" />
            </div>

            <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur">
              {badgeLabel}
            </span>

            <button
              type="button"
              onClick={handleLike}
              className="absolute right-3 top-3 inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-full border border-white/15 bg-black/40 px-3 text-[11px] font-semibold text-white/85 backdrop-blur transition active:scale-[0.98]"
              aria-label={`Liker ${product.name}`}
            >
              <span
                className={`absolute -inset-1 rounded-full bg-rose-400/20 transition ${likePulse ? "opacity-100" : "opacity-0"}`}
              />
              <Heart className={`relative h-3.5 w-3.5 text-rose-300 transition ${likePulse ? "scale-110" : "scale-100"}`} />
              <span className="relative">{product.likes}</span>
            </button>

            {delivery ? (
              <div className="absolute bottom-3 right-3">
                <DeliveryBadge delivery={delivery} />
              </div>
            ) : null}
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45 line-clamp-1">
              {product.category}
            </p>
            <h3 className="mt-1 text-[15px] font-bold leading-snug text-white line-clamp-2">{product.name}</h3>
            <p className="mt-1 text-[13px] text-white/60 line-clamp-2">{product.description}</p>

            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <div className="text-base font-black text-cyan-200">{product.priceLabel}</div>
                {product.oldPrice ? (
                  <div className="text-[11px] text-white/35 line-through">{formatNumber(product.oldPrice)} FCFA</div>
                ) : null}
              </div>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70">
                {product.discountPercent ? "Promo" : "Pro"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-[1fr_48px] gap-2">
              <button
                type="button"
                onClick={handleChatOrBuy}
                className="relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-orange-400 px-4 text-sm font-semibold text-black shadow-[0_18px_50px_rgba(14,165,233,0.35)] transition hover:brightness-110 active:scale-[0.98]"
              >
                <span className="pointer-events-none absolute inset-0 bg-white/10 opacity-0 transition group-hover:opacity-100" />
                <span className="pointer-events-none absolute -inset-8 rounded-full bg-white/15 opacity-0 blur-2xl transition group-hover:opacity-100" />
                {isRechargeDirect ? "Ouvrir le chat" : "Acheter"}
              </button>

              <button
                type="button"
                onClick={handleAddToCart}
                aria-label={isRechargeDirect ? "Voir le produit" : "Ajouter au panier"}
                className={
                  "relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/85 shadow-[0_12px_35px_rgba(0,0,0,0.4)] " +
                  "transition hover:bg-white/10 active:scale-[0.98]"
                }
              >
                <span
                  className={
                    "pointer-events-none absolute inset-0 rounded-full bg-white/10 transition " +
                    (adding ? "opacity-100" : "opacity-0")
                  }
                />
                <ShoppingBag className={"h-4 w-4 transition " + (adding ? "scale-105" : "scale-100")} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
