"use client";

import { DASHBOARD_MENU, type DashboardMenuId } from "./dashboardMenu";

type ProfileSidebarProps = {
  username: string;
  premiumTier: string;
  countryCode?: string | null;
  activeMenu: DashboardMenuId;
  onChangeMenu: (menu: DashboardMenuId) => void;
  onVipClick?: () => void;
  onWalletClick?: () => void;
};

export default function ProfileSidebar({
  username,
  premiumTier,
  countryCode,
  activeMenu,
  onChangeMenu,
  onVipClick,
  onWalletClick,
}: ProfileSidebarProps) {
  return (
    <aside className="rounded-3xl bg-black/35 border border-white/10 backdrop-blur-xl p-4">
      <div className="flex items-center gap-3 p-2">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400/30 to-cyan-400/10 border border-white/15" />
        <div>
          <div className="font-bold">{username}</div>
          <div className="text-xs opacity-70">BADBOY {premiumTier}</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {DASHBOARD_MENU.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onChangeMenu(item.id);
              if (item.id === "VIP") {
                onVipClick?.();
              }
              if (item.id === "Wallet") {
                onWalletClick?.();
              }
            }}
            className={`w-full text-left px-4 py-3 rounded-2xl border transition flex items-center gap-3 ${
              activeMenu === item.id
                ? "bg-cyan-400/10 border-cyan-300/25 shadow-[0_0_0_1px_rgba(34,211,238,0.08)]"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <item.icon className={`h-4 w-4 ${activeMenu === item.id ? "text-cyan-200" : "text-white/75"}`} />
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
