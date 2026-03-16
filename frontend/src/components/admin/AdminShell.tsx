"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Boxes,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Gift,
  Heart,
  Key,
  LayoutDashboard,
  Mail,
  Menu,
  X,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Star,
  Crown,
  Tags,
  TicketPercent,
  Trophy,
  Users,
} from "lucide-react";
import AdminActivityBell from "@/components/admin/AdminActivityBell";
import { hasAdminPermission } from "@/components/auth/adminRoles";
import { useAuth } from "@/components/auth/AuthProvider";

type MenuItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  permissions?: string[];
  children?: Array<{
    label: string;
    href: string;
    permissions?: string[];
  }>;
};

const MENU_ITEMS: MenuItem[] = [
  { label: "Tableau de bord", icon: LayoutDashboard, href: "/admin/dashboard" },
  { label: "Utilisateurs", icon: Users, href: "/admin/users", permissions: ["users.view"] },
  {
    label: "DBWallet",
    icon: CreditCard,
    href: "/admin/dbwallet/transactions",
    permissions: ["wallet.manage"],
    children: [
      { label: "Historique", href: "/admin/dbwallet/transactions", permissions: ["wallet.manage"] },
      { label: "Payouts FedaPay", href: "/admin/dbwallet/payouts", permissions: ["wallet.manage"] },
      { label: "Recharger", href: "/admin/dbwallet/recharge", permissions: ["wallet.manage"] },
      { label: "Fraude / Blocage", href: "/admin/dbwallet/fraud", permissions: ["wallet.manage"] },
      { label: "Welcome Bonus", href: "/admin/dbwallet/welcome-bonus", permissions: ["wallet.manage"] },
    ],
  },
  {
    label: "Produits",
    icon: Package,
    href: "/admin/products",
    permissions: ["products.view", "products.manage"],
    children: [
      { label: "Liste", href: "/admin/products/list", permissions: ["products.view"] },
      { label: "Ajouter", href: "/admin/products/add", permissions: ["products.manage"] },
    ],
  },
  {
    label: "Catégories",
    icon: Tags,
    href: "/admin/categories",
    permissions: ["categories.manage"],
    children: [
      { label: "Catégories", href: "/admin/categories", permissions: ["categories.manage"] },
      { label: "Jeux", href: "/admin/games", permissions: ["categories.manage"] },
    ],
  },
  {
    label: "Promotions",
    icon: TicketPercent,
    href: "/admin/promotions",
    permissions: ["promotions.manage"],
    children: [
      { label: "Liste", href: "/admin/promotions/list", permissions: ["promotions.manage"] },
      { label: "Ajouter", href: "/admin/promotions/add", permissions: ["promotions.manage"] },
    ],
  },
  {
    label: "Codes Promo",
    icon: Gift,
    href: "/admin/coupons",
    permissions: ["coupons.manage"],
    children: [
      { label: "Liste", href: "/admin/coupons/list", permissions: ["coupons.manage"] },
      { label: "Ajouter", href: "/admin/coupons/add", permissions: ["coupons.manage"] },
    ],
  },
  { label: "Offres", icon: Heart, href: "/admin/offers", permissions: ["promotions.manage", "products.manage"] },
  {
    label: "Tournois",
    icon: Trophy,
    href: "/admin/tournaments",
    permissions: ["tournaments.view", "tournaments.manage"],
    children: [
      { label: "Liste", href: "/admin/tournaments", permissions: ["tournaments.view"] },
      { label: "Ajouter", href: "/admin/tournaments/add", permissions: ["tournaments.manage"] },
    ],
  },
  { label: "Email", icon: Mail, href: "/admin/email", permissions: ["email.view"] },
  { label: "Notifications", icon: Bell, href: "/admin/notifications", permissions: ["notifications.manage"] },
  { label: "Demandes Premium", icon: Crown, href: "/admin/premium/requests", permissions: ["premium.manage"] },
  { label: "Demandes d’importation", icon: Boxes, href: "/admin/redeem-lots", permissions: ["redeems.view", "redeems.manage"] },
  { label: "Avis Clients", icon: Star, href: "/admin/reviews", permissions: ["reviews.view"] },
  { label: "Paramètres", icon: Settings, href: "/admin/settings", permissions: ["settings.manage"] },
  {
    label: "Redeem Codes",
    icon: Key,
    href: "/admin/redeem-codes",
    permissions: ["redeems.view", "redeems.manage"],
    children: [
      { label: "Lots", href: "/admin/redeem-lots/list", permissions: ["redeems.view"] },
      { label: "Liste", href: "/admin/redeem-codes/list", permissions: ["redeems.view"] },
      { label: "Ajouter", href: "/admin/redeem-codes/add", permissions: ["redeems.manage"] },
      { label: "Low Stock", href: "/admin/redeem-codes/low-stock", permissions: ["redeems.view", "stock.manage"] },
    ],
  },
  {
    label: "Gestion vendeur",
    icon: Boxes,
    href: "/admin/marketplace/sellers",
    permissions: [
      "marketplace.sellers.view",
      "marketplace.sellers.manage",
      "marketplace.listings.manage",
      "marketplace.orders.manage",
      "marketplace.disputes.manage",
      "marketplace.withdraws.manage",
    ],
    children: [
      { label: "Vendeurs", href: "/admin/marketplace/sellers", permissions: ["marketplace.sellers.view"] },
      { label: "Annonces", href: "/admin/marketplace/listings", permissions: ["marketplace.listings.manage"] },
      { label: "Commandes", href: "/admin/marketplace/orders", permissions: ["marketplace.orders.manage"] },
      { label: "Litiges", href: "/admin/marketplace/disputes", permissions: ["marketplace.disputes.manage"] },
      { label: "Retraits", href: "/admin/marketplace/withdraws", permissions: ["marketplace.withdraws.manage"] },
    ],
  },
  { label: "Commandes", icon: ShoppingCart, href: "/admin/orders", permissions: ["orders.view"] },
  { label: "Paiements", icon: CreditCard, href: "/admin/payments", permissions: ["payments.view"] },
  { label: "Stock / Inventaire", icon: Boxes, href: "/admin/stock", permissions: ["stock.manage"] },
  {
    label: "Sourcing",
    icon: Search,
    href: "/admin/sourcing",
    permissions: ["sourcing.view", "sourcing.manage"],
    children: [
      { label: "Tableau de bord", href: "/admin/sourcing/dashboard", permissions: ["sourcing.view"] },
      { label: "Comptes fournisseurs", href: "/admin/sourcing/accounts", permissions: ["sourcing.view"] },
      { label: "Import catalogue", href: "/admin/sourcing/import", permissions: ["sourcing.manage"] },
      { label: "Mappings produit-source", href: "/admin/sourcing/mappings", permissions: ["sourcing.view"] },
      { label: "Demandes", href: "/admin/sourcing/demands", permissions: ["sourcing.view"] },
      { label: "Lots d’achat", href: "/admin/sourcing/batches", permissions: ["sourcing.view"] },
      { label: "Réceptions", href: "/admin/sourcing/inbound", permissions: ["sourcing.view"] },
    ],
  },
];

const canAccess = (role: string | null | undefined, permissions?: string[]) => {
  if (!permissions?.length) return true;
  return permissions.some((permission) => hasAdminPermission(role, permission));
};

function Navigation({ pathname, role, onNavigate }: { pathname: string | null; role?: string | null; onNavigate?: () => void }) {
  const visibleMenu = useMemo(
    () =>
      MENU_ITEMS.map((item) => ({
        ...item,
        children: item.children?.filter((child) => canAccess(role, child.permissions)),
      })).filter((item) => canAccess(role, item.permissions) || Boolean(item.children?.length)),
    [role],
  );

  return (
    <nav className="mt-6 space-y-1">
      {visibleMenu.map((item) => {
        const active = pathname?.startsWith(item.href);
        const hasChildren = Boolean(item.children?.length);
        return (
          <div key={item.label}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm ${
                active ? "bg-red-50 text-red-600" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
              {hasChildren ? active ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" /> : null}
            </Link>
            {hasChildren && active ? (
              <div className="ml-8 mt-2 space-y-1">
                {item.children?.map((child) => {
                  const childActive = pathname?.startsWith(child.href);
                  return (
                    <Link
                      key={child.label}
                      href={child.href}
                      onClick={onNavigate}
                      className={`flex items-center rounded-xl px-3 py-2 text-sm ${
                        childActive ? "bg-red-50 text-red-600" : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

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
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden min-h-screen w-72 flex-col border-r border-slate-200 bg-white px-5 py-6 lg:flex">
          <div className="flex items-center gap-3 text-lg font-semibold text-slate-900">
            <div className="h-10 w-10 rounded-2xl bg-slate-100" />
            Admin
          </div>
          <Navigation pathname={pathname} role={user?.role} />
          <div className="mt-auto pt-6 text-xs text-slate-400">Powered by Gestionnaire</div>
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 bg-slate-900/45 lg:hidden" onClick={() => setMobileOpen(false)}>
            <aside
              className="h-full w-[88vw] max-w-xs border-r border-slate-200 bg-white px-5 py-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 text-lg font-semibold text-slate-900">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-slate-100" />
                  Admin
                </div>
                <button type="button" onClick={() => setMobileOpen(false)} className="rounded-xl border border-slate-200 p-2 text-slate-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Navigation pathname={pathname} role={user?.role} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 lg:hidden">
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-red-500 sm:text-2xl">{title}</h1>
                {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 md:flex">
                <Search className="h-4 w-4" />
                Rechercher...
              </div>
              <AdminActivityBell />
              <button type="button" className="rounded-full border border-slate-200 p-2 text-slate-500">
                <Heart className="h-4 w-4" />
              </button>
              <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xs font-semibold">
                {(user?.name ?? "BB").slice(0, 2).toUpperCase()}
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
