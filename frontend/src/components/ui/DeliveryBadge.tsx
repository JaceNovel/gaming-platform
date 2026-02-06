"use client";

import type { DeliveryBadgeDisplay } from "@/lib/deliveryDisplay";

export default function DeliveryBadge({ delivery }: { delivery: DeliveryBadgeDisplay }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-[11px] " +
        (delivery.tone === "bolt"
          ? "border-amber-200/20 bg-amber-400/8 text-amber-100"
          : "border-white/10 bg-white/5 text-white/75")
      }
    >
      <span className="sm:hidden">{delivery.mobileLabel}</span>
      <span className="hidden sm:inline">{delivery.desktopLabel}</span>
    </span>
  );
}
