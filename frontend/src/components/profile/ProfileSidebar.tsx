"use client";

import { Crown, Home, Settings, ShoppingBag, Wallet } from "lucide-react";

type ProfileSidebarProps = {
  username: string;
  premiumTier: string;
  countryCode?: string | null;
  activeMenu: "MesCommandes" | "Wallet" | "VIP" | "Principal" | "Parametres";
  onChangeMenu: (menu: "MesCommandes" | "Wallet" | "VIP" | "Principal" | "Parametres") => void;
};

export default function ProfileSidebar({
  username,
  premiumTier,
  countryCode,
  activeMenu,
  onChangeMenu,
}: ProfileSidebarProps) {
  const menu = [
    { id: "MesCommandes" as const, label: "Mes Commandes", icon: ShoppingBag },
    { id: "Wallet" as const, label: "Wallet BD", icon: Wallet },
    { id: "VIP" as const, label: "BADBOY VIP", icon: Crown },
    { id: "Principal" as const, label: "Principal", icon: Home },
    { id: "Parametres" as const, label: "Paramètres", icon: Settings },
  ];

  return (
    <aside className="rounded-3xl bg-black/35 border border-white/10 backdrop-blur-xl p-4">
      <div className="flex items-center gap-3 p-2">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500/40 to-cyan-400/20 border border-white/15" />
        <div>
          <div className="font-bold">{username}</div>
          <div className="text-xs opacity-70">BADBOY {premiumTier}</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {menu.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeMenu(item.id)}
            className={`w-full text-left px-4 py-3 rounded-2xl border transition flex items-center gap-3 ${
              activeMenu === item.id
                ? "bg-white/10 border-white/20"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-3 text-xs opacity-80">
        Pays: <span className="font-semibold">{countryCode || "FR"}</span> — obligatoire à l’inscription.
      </div>
    </aside>
  );
}
