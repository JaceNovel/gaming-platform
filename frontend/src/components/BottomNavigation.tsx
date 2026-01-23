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
  { name: "Compte", href: "/account", icon: User },
];

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 lg:hidden">
      <div className="mobile-shell glass-card rounded-2xl border border-white/10 backdrop-blur flex gap-2 overflow-x-auto py-2 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex min-w-[72px] flex-col items-center px-3 py-2 rounded-xl transition-all ${
                isActive
                  ? "text-cyan-200 bg-white/10 shadow-[0_0_20px_rgba(110,231,255,0.25)]"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs mt-1">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}