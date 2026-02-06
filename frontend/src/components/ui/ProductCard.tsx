"use client";

import { motion } from "framer-motion";
import { Heart, ShoppingCart } from "lucide-react";
import PremiumBadge from "./PremiumBadge";
import DeliveryBadge from "./DeliveryBadge";
import type { DeliveryBadgeDisplay } from "@/lib/deliveryDisplay";

export type ProductCardProps = {
  title: string;
  subtitle?: string;
  price: string;
  likes?: number;
  tag?: string;
  badgeLevel?: "Bronze" | "Or" | "Platine";
  imageSlot?: React.ReactNode;
  delivery?: DeliveryBadgeDisplay | null;
  details?: string[];
  onLike?: () => void;
  onAction?: () => void;
  onDoubleClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
};

export default function ProductCard({
  title,
  subtitle,
  price,
  likes,
  tag,
  badgeLevel,
  imageSlot,
  delivery,
  details,
  onLike,
  onAction,
  onDoubleClick,
}: ProductCardProps) {
  const formatLikes = (value?: number) => {
    if (value === undefined || value === null) return "";
    if (value < 1000) return `${value}`;
    const thousands = Math.floor(value / 1000);
    const hundreds = Math.floor((value % 1000) / 100);
    return hundreds > 0 ? `${thousands}k${hundreds}` : `${thousands}k`;
  };

  const likeLabel = formatLikes(likes);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card card-hover group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 p-5 motion-reduce:transition-none"
      onDoubleClick={onDoubleClick}
    >
      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-[1fr,220px] sm:items-stretch">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            {tag ? (
              <span className="inline-flex text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                {tag}
              </span>
            ) : (
              <span />
            )}
            {badgeLevel ? <PremiumBadge level={badgeLevel} /> : null}
          </div>

          <h4 className="mt-2 text-lg sm:text-xl font-bold leading-snug text-white line-clamp-2">{title}</h4>
          {subtitle ? (
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/55 line-clamp-1">{subtitle}</p>
          ) : null}

          {details?.length ? (
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/60">
              {details.map((item) => (
                <span key={item} className="rounded-full border border-white/10 px-2 py-1 bg-white/5">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-transparent to-cyan-400/10 aspect-video sm:aspect-[4/3]">
          {typeof likes === "number" ? (
            <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 border border-white/20 px-2 py-1 text-[11px] text-white/80 backdrop-blur">
              <Heart className="h-3 w-3 text-rose-300" />
              <span>{likeLabel}</span>
            </div>
          ) : null}

          {imageSlot ?? (
            <div className="h-full w-full grid place-items-center text-xs text-white/50">Image slot</div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">Prix</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-cyan-200">{price}</p>
        </div>

        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 px-4 py-2 text-sm font-bold text-black shadow-[0_0_22px_rgba(110,231,255,0.22)] transition-transform duration-200 hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Acheter</span>
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        {typeof likes === "number" ? (
          <div className="text-xs text-white/55">{likeLabel} likes</div>
        ) : (
          <span />
        )}

        {delivery ? <DeliveryBadge delivery={delivery} /> : null}
      </div>
    </motion.div>
  );
}
