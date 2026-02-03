"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Boxes,
  CreditCard,
  Gift,
  Heart,
  Key,
  LayoutDashboard,
  Mail,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Star,
  Tags,
  TicketPercent,
  Users,
  ChevronDown,
} from "lucide-react";

const MENU_ITEMS = [
  { label: "Tableau de bord", icon: LayoutDashboard, href: "/admin/dashboard" },
  { label: "Utilisateurs", icon: Users, href: "/admin/users" },
  {
    label: "DBWallet",
    icon: CreditCard,
    href: "/admin/dbwallet/transactions",
    children: [
      { label: "Historique", href: "/admin/dbwallet/transactions" },
      { label: "Recharger", href: "/admin/dbwallet/recharge" },
      { label: "Fraude / Blocage", href: "/admin/dbwallet/fraud" },
      { label: "Welcome Bonus", href: "/admin/dbwallet/welcome-bonus" },
    ],
  },
  {
    label: "Produits",
    icon: Package,
    href: "/admin/products",
    children: [
      { label: "Liste", href: "/admin/products/list" },
      { label: "Ajouter", href: "/admin/products/add" },
    ],
  },
  {
    label: "Catégories",
    icon: Tags,
    href: "/admin/categories",
    children: [
      { label: "Catégories", href: "/admin/categories" },
      { label: "Jeux", href: "/admin/games" },
    ],
  },
  {
    label: "Promotions",
    icon: TicketPercent,
    href: "/admin/promotions",
    children: [
      { label: "Liste", href: "/admin/promotions/list" },
      { label: "Ajouter", href: "/admin/promotions/add" },
    ],
  },
  {
    label: "Codes Promo",
    icon: Gift,
    href: "/admin/coupons",
    children: [
      { label: "Liste", href: "/admin/coupons/list" },
      { label: "Ajouter", href: "/admin/coupons/add" },
    ],
  },
  { label: "Offres", icon: Heart, href: "/admin/offers" },
  { label: "Email", icon: Mail, href: "/admin/email" },
  { label: "Notifications", icon: Bell, href: "/admin/notifications" },
  { label: "Demandes d’importation", icon: Boxes, href: "/admin/redeem" },
  { label: "Avis Clients", icon: Star, href: "/admin/reviews" },
  { label: "Paramètres", icon: Settings, href: "/admin/settings" },
  {
    label: "Redeem Codes",
    icon: Key,
    href: "/admin/redeem-codes",
    children: [
      { label: "Lots", href: "/admin/redeem-lots/list" },
      { label: "Liste", href: "/admin/redeem-codes/list" },
      { label: "Ajouter", href: "/admin/redeem-codes/add" },
      { label: "Low Stock", href: "/admin/redeem-codes/low-stock" },
    ],
  },
  { label: "Commandes", icon: ShoppingCart, href: "/admin/orders" },
  { label: "Paiements", icon: CreditCard, href: "/admin/payments" },
  { label: "Stock / Inventaire", icon: Boxes, href: "/admin/stock" },
];

export default function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-black/70 p-6 text-center">
          <div className="text-sm uppercase tracking-[0.3em] text-white/50">BADBOYSHOP</div>
          <h1 className="mt-3 text-xl font-semibold">Accès admin limité</h1>
          <p className="mt-2 text-sm text-white/70">
            Connectez-vous sur un PC pour accéder à l’administration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        <aside className="hidden min-h-screen w-64 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
          <div className="flex items-center gap-3 text-lg font-semibold text-slate-900">
            <div className="h-10 w-10 rounded-2xl bg-slate-100" />
            Admin
          </div>
          <nav className="mt-8 space-y-1">
            {MENU_ITEMS.map((item) => {
              const active = pathname?.startsWith(item.href);
              const hasChildren = !!item.children?.length;
              return (
                <div key={item.label}>
                  <Link
                    href={item.href}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                      active ? "bg-red-50 text-red-600" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    {hasChildren && (
                      <ChevronDown className={`h-4 w-4 transition ${active ? "rotate-180" : ""}`} />
                    )}
                  </Link>
                  {hasChildren && active && (
                    <div className="ml-8 mt-2 space-y-1">
                      {item.children?.map((child) => {
                        const childActive = pathname?.startsWith(child.href);
                        return (
                          <Link
                            key={child.label}
                            href={child.href}
                            className={`flex items-center rounded-lg px-3 py-2 text-sm ${
                              childActive
                                ? "bg-red-50 text-red-600"
                                : "text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="mt-auto pt-6 text-xs text-slate-400">Powered by Gestionnaire</div>
        </aside>

        <main className="flex-1 px-6 py-6">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <button className="rounded-lg border border-slate-200 p-2 lg:hidden">
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-red-500">{title}</h1>
                {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 md:flex">
                <Search className="h-4 w-4" />
                Rechercher...
              </div>
              <button className="rounded-full border border-slate-200 p-2 text-slate-500">
                <Bell className="h-4 w-4" />
              </button>
              <button className="rounded-full border border-slate-200 p-2 text-slate-500">
                <Heart className="h-4 w-4" />
              </button>
              <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xs font-semibold">
                BB
              </div>
            </div>
          </div>

          {actions && <div className="mt-6">{actions}</div>}
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
