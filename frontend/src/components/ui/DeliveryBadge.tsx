"use client";

import type { DeliveryBadgeDisplay } from "@/lib/deliveryDisplay";

export default function DeliveryBadge({ delivery }: { delivery: DeliveryBadgeDisplay }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold " +
        (delivery.tone === "bolt"
          ? "border-cyan-200/25 bg-cyan-400/10 text-cyan-100"
          : "border-white/10 bg-white/5 text-white/75")
      }
    >
      <span className="sm:hidden">{delivery.mobileLabel}</span>
      <span className="hidden sm:inline">{delivery.desktopLabel}</span>
    </span>
  );
}
