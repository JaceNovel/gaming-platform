import Link from "next/link";
import { Crown, Search, ShoppingCart, User } from "lucide-react";
import GlowButton from "@/components/ui/GlowButton";

export default function DesktopHeader() {
  return (
    <header className="hidden lg:block w-full sticky top-0 z-30 border-b border-white/10 bg-black/50 backdrop-blur">
      <div className="w-full px-12 xl:px-20 2xl:px-28 py-4 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-4">
          <span className="h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 text-black grid place-items-center shadow-[0_14px_36px_rgba(110,231,255,0.38)]">
            <Crown className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-200/90">BADBOYSHOP</p>
            <p className="text-base text-white/65">Gaming Premium</p>
          </div>
        </Link>

        <div className="flex flex-1 items-center justify-between gap-6">
          <nav className="flex-1 flex items-center justify-center gap-4 text-[13px] tracking-[0.2em] uppercase text-white/60">
            <Link className="px-2 py-2 rounded-lg hover:text-white transition" href="/shop">
              Boutique
            </Link>
            <Link className="px-2 py-2 rounded-lg hover:text-white transition" href="/premium">
              Premium
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="relative inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 bg-white/10 text-white border border-white/15 backdrop-blur hover:border-white/25"
            >
              <ShoppingCart className="h-4 w-4" />
              Panier
            </Link>
            <Link
              href="/account"
              className="relative inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 bg-gradient-to-r from-cyan-400 to-purple-500 text-black shadow-[0_0_30px_rgba(110,231,255,0.35)]"
            >
              <User className="h-4 w-4" />
              Compte
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
