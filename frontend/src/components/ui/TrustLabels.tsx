"use client";

import { Bot, ShieldCheck, Zap } from "lucide-react";

export default function TrustLabels({ className = "" }: { className?: string }) {
  const items = [
    { icon: ShieldCheck, label: "Paiement sécurisé" },
    { icon: Bot, label: "Anti-fraude actif" },
    { icon: Zap, label: "Livraison rapide" },
  ];

  return (
    <div className={"flex flex-wrap items-center gap-2 " + className}>
      {items.map((it) => (
        <span
          key={it.label}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/75"
        >
          <it.icon className="h-4 w-4 text-cyan-200" />
          {it.label}
        </span>
      ))}
    </div>
  );
}
