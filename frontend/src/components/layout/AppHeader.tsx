"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Coins,
  Crown,
  Mail,
  ShoppingCart,
  User,
  Swords,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const navItems = [
  { label: "Boutique", href: "/shop" },
  { label: "Premium", href: "/premium" },
  { label: "Tournois", href: "/tournaments" },
  { label: "GVG", href: "/gvg" },
  { label: "BADBOYTrans", href: "/transfers" },
];

export default function AppHeader() {
  const pathname = usePathname();
  const { authFetch, token } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletCurrency, setWalletCurrency] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<
    Array<{ id: number; message: string; is_read: boolean; created_at: string }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [supportTickets, setSupportTickets] = useState<
    Array<{
      id: number;
      subject: string;
      status: string;
      last_message: string | null;
      last_message_at: string | null;
      unread_count: number;
    }>
  >([]);
  const [supportUnread, setSupportUnread] = useState(0);
  const [showSupport, setShowSupport] = useState(false);

  useEffect(() => {
    let active = true;
    const loadWallet = async () => {
      if (!token) {
        setWalletBalance(null);
        return;
      }
      try {
        const res = await authFetch(`${API_BASE}/wallet`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const balanceValue = typeof data?.balance === "number" ? data.balance : Number(data?.balance ?? 0);
        setWalletBalance(Number.isFinite(balanceValue) ? balanceValue : 0);
        setWalletCurrency(data?.currency ?? null);
      } catch {
        if (!active) return;
        setWalletBalance(null);
        setWalletCurrency(null);
      }
    };

    loadWallet();
    return () => {
      active = false;
    };
  }, [authFetch, token]);

  useEffect(() => {
    let active = true;
    const loadSupportInbox = async () => {
      if (!token) {
        setSupportTickets([]);
        setSupportUnread(0);
        return;
      }
      try {
        const res = await authFetch(`${API_BASE}/support/inbox?limit=6`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setSupportTickets(Array.isArray(data?.tickets) ? data.tickets : []);
        setSupportUnread(Number(data?.unread ?? 0));
      } catch {
        if (!active) return;
        setSupportTickets([]);
        setSupportUnread(0);
      }
    };

    loadSupportInbox();
    return () => {
      active = false;
    };
  }, [authFetch, token]);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      if (!token) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      try {
        const res = await authFetch(`${API_BASE}/notifications?limit=6`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
        setUnreadCount(Number(data?.unread ?? 0));
      } catch {
        if (!active) return;
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    loadNotifications();
    return () => {
      active = false;
    };
  }, [authFetch, token]);

  const unreadBadge = useMemo(() => {
    if (unreadCount <= 0) return null;
    return unreadCount > 9 ? "9+" : String(unreadCount);
  }, [unreadCount]);

  const supportBadge = useMemo(() => {
    if (supportUnread <= 0) return null;
    return supportUnread > 9 ? "9+" : String(supportUnread);
  }, [supportUnread]);

  const handleToggleNotifications = async () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next && unreadCount > 0) {
      await authFetch(`${API_BASE}/notifications/read-all`, { method: "POST" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    }
  };

  const handleToggleSupport = async () => {
    const next = !showSupport;
    setShowSupport(next);
    if (next && supportUnread > 0) {
      await authFetch(`${API_BASE}/support/inbox/read-all`, { method: "POST" });
      setSupportUnread(0);
      setSupportTickets((prev) => prev.map((item) => ({ ...item, unread_count: 0 })));
    }
  };

  const walletLabel =
    walletBalance === null ? "—" : walletBalance.toLocaleString("fr-FR");
  const walletCurrencyLabel = walletCurrency ?? "FCFA";

  return (
    <>
      <header className="sticky top-0 z-40 hidden lg:block border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-2xl ring-1 ring-white/20">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-400/70 via-fuchsia-400/30 to-cyan-400/20" />
              <div className="absolute inset-[1px] rounded-[15px] bg-black/55" />
              <span className="relative flex h-full w-full items-center justify-center text-white">
                <Crown className="h-5 w-5 text-amber-300" />
              </span>
            </div>
            <div className="text-lg font-extrabold tracking-tight text-white">
              BADBOY<span className="text-white/70">SHOP</span>
            </div>
          </Link>

          <div className="flex items-center gap-4 rounded-full bg-white/5 px-4 py-2 ring-1 ring-white/10 backdrop-blur-md">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/15">
              <Crown className="h-3.5 w-3.5 text-amber-300" />
              VIP 2
            </span>
            <nav className="flex items-center gap-5 text-xs font-medium text-white/80">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`transition ${
                      isActive ? "text-white" : "hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur-md">
              <span className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-amber-400/30 via-fuchsia-400/20 to-purple-500/30" />
              <span className="absolute inset-0 -z-20 rounded-full bg-amber-300/20 blur-[12px]" />
              <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 text-black shadow-[0_6px_18px_rgba(251,191,36,0.45)]">
                <Coins className="h-3.5 w-3.5" />
              </span>
              <span className="tracking-wide">{walletLabel}</span>
              <span className="text-xs text-white/70">{walletCurrencyLabel}</span>
            </div>

            <Link
              href="/account"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/15"
              aria-label="Profil"
            >
              <User className="h-4 w-4 text-white/80" />
            </Link>
            <div className="relative">
              <button
                type="button"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/15"
                aria-label="Support"
                onClick={handleToggleSupport}
              >
                <Mail className="h-4 w-4 text-white/80" />
                {supportBadge ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-black">
                    {supportBadge}
                  </span>
                ) : null}
              </button>

              {showSupport && (
                <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-white/10 bg-black/90 p-3 text-sm text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs uppercase tracking-[0.25em] text-white/50">Boîte support</span>
                    <button
                      type="button"
                      className="text-xs text-white/60 hover:text-white"
                      onClick={() => setShowSupport(false)}
                    >
                      Fermer
                    </button>
                  </div>
                  <div className="space-y-2">
                    {supportTickets.length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                        Aucun ticket pour le moment.
                      </div>
                    ) : (
                      supportTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-white/90">{ticket.subject}</p>
                            {ticket.unread_count > 0 && (
                              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-200">
                                +{ticket.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-white/70 line-clamp-2">
                            {ticket.last_message ?? "Message en attente"}
                          </p>
                          {ticket.last_message_at && (
                            <p className="mt-1 text-[10px] text-white/40">
                              {new Date(ticket.last_message_at).toLocaleString("fr-FR")}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/15"
                aria-label="Notifications"
                onClick={handleToggleNotifications}
              >
                <Bell className="h-4 w-4 text-white/80" />
                {unreadBadge ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {unreadBadge}
                  </span>
                ) : null}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 rounded-2xl border border-white/10 bg-black/90 p-3 text-sm text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs uppercase tracking-[0.25em] text-white/50">Notifications</span>
                    <button
                      type="button"
                      className="text-xs text-white/60 hover:text-white"
                      onClick={() => setShowNotifications(false)}
                    >
                      Fermer
                    </button>
                  </div>
                  <div className="space-y-2">
                    {notifications.length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                        Aucune notification pour le moment.
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 ${
                            item.is_read ? "opacity-70" : ""
                          }`}
                        >
                          <p className="text-white/90">{item.message}</p>
                          <p className="mt-1 text-[10px] text-white/40">
                            {new Date(item.created_at).toLocaleString("fr-FR")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <Link
              href="/cart"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/15"
              aria-label="Panier"
            >
              <ShoppingCart className="h-4 w-4 text-white/80" />
            </Link>
          </div>
        </div>
      </header>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/55 backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 text-black shadow-[0_10px_30px_rgba(110,231,255,0.35)]">
              <Swords className="h-4 w-4" />
            </span>
            <span className="text-sm font-extrabold tracking-tight text-white">
              BADBOY<span className="text-white/70">SHOP</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/90">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 text-black shadow-[0_6px_14px_rgba(251,191,36,0.4)]">
                <Coins className="h-3 w-3" />
              </span>
              <span className="tracking-wide">{walletLabel}</span>
              <span className="text-[10px] text-white/70">{walletCurrencyLabel}</span>
            </div>
            <button
              type="button"
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/15"
              aria-label="Notifications"
              onClick={handleToggleNotifications}
            >
              <Bell className="h-4 w-4 text-white/80" />
              {unreadBadge ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {unreadBadge}
                </span>
              ) : null}
            </button>
            <Link
              href="/cart"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/15"
              aria-label="Panier"
            >
              <ShoppingCart className="h-4 w-4 text-white/80" />
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
