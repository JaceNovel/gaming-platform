"use client";

import { motion } from "framer-motion";
import { Heart, ShoppingCart } from "lucide-react";
import PremiumBadge from "./PremiumBadge";

export type ProductCardProps = {
  title: string;
  subtitle?: string;
  price: string;
  likes?: number;
  tag?: string;
  badgeLevel?: "Bronze" | "Or" | "Platine";
  imageSlot?: React.ReactNode;
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, scale: 1.01 }}
      className="glass-card rounded-2xl p-5 border border-white/10 min-w-[300px] card-hover"
      onDoubleClick={onDoubleClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          {tag && (
            <span className="text-[11px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
              {tag}
            </span>
          )}
          <h4 className="text-lg font-bold mt-2 leading-tight">{title}</h4>
          {subtitle && <p className="text-sm text-white/60 mt-1 line-clamp-2">{subtitle}</p>}
        </div>
        {badgeLevel && <PremiumBadge level={badgeLevel} />}
      </div>

      <div className="mt-4 h-32 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 via-transparent to-cyan-400/10 overflow-hidden relative">
        {typeof likes === "number" && (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/60 border border-white/20 px-2 py-1 text-[11px] text-white/80 backdrop-blur">
            <Heart className="h-3 w-3 text-rose-300" />
            <span>{likeLabel} likes</span>
          </div>
        )}
        {typeof likes === "number" && likes >= 1000 && (
          <div className="absolute right-3 top-3 rounded-full bg-cyan-400/20 border border-cyan-300/40 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-200">
            trending
          </div>
        )}
        {imageSlot ?? (
          <div className="h-full w-full grid place-items-center text-xs text-white/50">
            Image slot
          </div>
        )}
      </div>

      {details?.length ? (
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/60">
          {details.map((item) => (
            <span key={item} className="rounded-full border border-white/10 px-2 py-1 bg-white/5">
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between mt-5">
        <div>
          <p className="text-xs text-white/60">Prix</p>
          <p className="text-xl font-bold text-cyan-200">{price}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onLike}
            className="flex items-center gap-1 text-rose-300 hover:text-rose-200 transition"
          >
            <Heart className="h-4 w-4" />
            <span className="text-sm">{likeLabel}</span>
          </button>
          <button
            onClick={onAction}
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-black px-3 py-2 font-semibold shadow-[0_0_20px_rgba(110,231,255,0.35)]"
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
