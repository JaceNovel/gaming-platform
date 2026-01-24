"use client";

import { Home, ShoppingBag, Crown, User, ArrowRightLeft, Trophy, Swords } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: "Accueil", href: "/", icon: Home },
  { name: "Boutique", href: "/shop", icon: ShoppingBag },
  { name: "Premium", href: "/premium", icon: Crown },
  { name: "Tournois", href: "/tournaments", icon: Trophy },
  { name: "GVG", href: "/gvg", icon: Swords },
  { name: "Transferts", href: "/transfers", icon: ArrowRightLeft },
  { name: "Profil", href: "/account", icon: User },
];

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mobile-shell glass-card h-16 rounded-2xl border border-white/10 backdrop-blur flex gap-1 overflow-x-auto px-2 py-1 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-1 min-w-0 flex-col items-center justify-center rounded-xl transition-all ${
                isActive
                  ? "text-cyan-200 bg-white/10 shadow-[0_0_20px_rgba(110,231,255,0.25)]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="mt-1 text-[10px]">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}