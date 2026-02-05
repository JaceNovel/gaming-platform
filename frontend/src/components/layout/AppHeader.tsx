"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, Coins, Mail, ShoppingCart } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { API_BASE } from "@/lib/config";
import { toDisplayImageSrc } from "@/lib/imageProxy";

type NotificationItem = {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  type?: string | null;
};

type MenuGame = {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  image?: string | null;
};

type MenuKey = "recharge" | "subscription" | "marketplace";

const parseGamesPayload = (payload: any): MenuGame[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as MenuGame[];
  if (Array.isArray(payload?.data)) return payload.data as MenuGame[];
  if (Array.isArray(payload?.data?.data)) return payload.data.data as MenuGame[];
  return [];
};

export default function AppHeader() {
  const pathname = usePathname();
  const { authFetch, token, user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletCurrency, setWalletCurrency] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [inboxItems, setInboxItems] = useState<
    Array<{ id: number; message: string; is_read: boolean; created_at: string }>
  >([]);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [showInbox, setShowInbox] = useState(false);

  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const menuButtonRefs = useRef<Record<MenuKey, HTMLButtonElement | null>>({
    recharge: null,
    subscription: null,
    marketplace: null,
  });
  const menuItemRefs = useRef<Record<MenuKey, Array<HTMLAnchorElement | null>>>({
    recharge: [],
    subscription: [],
    marketplace: [],
  });

  const [menuGames, setMenuGames] = useState<Record<MenuKey, MenuGame[]>>({
    recharge: [],
    subscription: [],
    marketplace: [],
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(Boolean(mq.matches));
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    // Safari old fallback
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

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

    const fetchGames = async (context: MenuKey) => {
      const url = `${API_BASE}/games?active=1&context=${context}&per_page=200`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const payload = await res.json().catch(() => null);
      return parseGamesPayload(payload);
    };

    const loadMenus = async () => {
      try {
        const [recharges, subscriptions, marketplace] = await Promise.all([
          fetchGames("recharge"),
          fetchGames("subscription"),
          fetchGames("marketplace"),
        ]);
        if (!active) return;
        setMenuGames({
          recharge: recharges,
          subscription: subscriptions,
          marketplace,
        });
      } catch {
        if (!active) return;
        setMenuGames({ recharge: [], subscription: [], marketplace: [] });
      }
    };

    loadMenus();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    if (!openMenu) return;

    const onMouseDown = (event: MouseEvent) => {
      const root = headerRef.current;
      if (!root) return;
      if (!root.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!openMenu) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setOpenMenu(null);
        menuButtonRefs.current[openMenu]?.focus();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;

      const refs = menuItemRefs.current[openMenu] ?? [];
      const items = refs.filter(Boolean) as HTMLAnchorElement[];
      if (items.length === 0) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const currentIndex = activeEl ? items.findIndex((el) => el === activeEl) : -1;

      event.preventDefault();

      if (event.key === "Home") {
        items[0]?.focus();
        return;
      }
      if (event.key === "End") {
        items[items.length - 1]?.focus();
        return;
      }

      const delta = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + delta + items.length) % items.length;
      items[nextIndex]?.focus();
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  useEffect(() => {
    let active = true;
    const loadInbox = async () => {
      if (!token) {
        setInboxItems([]);
        setInboxUnread(0);
        return;
      }
      try {
        const limit = isMobile ? 4 : 6;
        const res = await authFetch(`${API_BASE}/notifications?limit=${limit}&type=redeem_code`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setInboxItems(Array.isArray(data?.notifications) ? data.notifications : []);
        setInboxUnread(Number(data?.unread ?? 0));
      } catch {
        if (!active) return;
        setInboxItems([]);
        setInboxUnread(0);
      }
    };

    loadInbox();
    return () => {
      active = false;
    };
  }, [authFetch, token, isMobile]);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      if (!token) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      try {
        const limit = isMobile ? 4 : 6;
        const res = await authFetch(`${API_BASE}/notifications?limit=${limit}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const list = Array.isArray(data?.notifications) ? (data.notifications as NotificationItem[]) : [];
        const filteredList = list.filter((item) => item?.type !== "redeem_code");
        setNotifications(filteredList);
        setUnreadCount(filteredList.filter((item) => !item?.is_read).length);
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
  }, [authFetch, token, isMobile]);

  const unreadBadge = useMemo(() => {
    if (unreadCount <= 0) return null;
    return unreadCount > 9 ? "9+" : String(unreadCount);
  }, [unreadCount]);

  const inboxBadge = useMemo(() => {
    if (inboxUnread <= 0) return null;
    return inboxUnread > 9 ? "9+" : String(inboxUnread);
  }, [inboxUnread]);

  const mobileNotifications = useMemo(() => notifications.slice(0, 4), [notifications]);
  const mobileInboxItems = useMemo(() => inboxItems.slice(0, 4), [inboxItems]);

  const handleToggleNotifications = async () => {
    setOpenMenu(null);
    const next = !showNotifications;
    setShowNotifications(next);
    if (next && unreadCount > 0) {
      await Promise.all([
        authFetch(`${API_BASE}/notifications/read-all?type=promo`, { method: "POST" }),
        authFetch(`${API_BASE}/notifications/read-all?type=update`, { method: "POST" }),
      ]);
      setUnreadCount(0);
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    }
  };

  const handleToggleInbox = async () => {
    setOpenMenu(null);
    const next = !showInbox;
    setShowInbox(next);
    if (next && inboxUnread > 0) {
      await authFetch(`${API_BASE}/notifications/read-all?type=redeem_code`, { method: "POST" });
      setInboxUnread(0);
      setInboxItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    }
  };

  const walletLabel =
    walletBalance === null ? "—" : walletBalance.toLocaleString("fr-FR");
  const walletCurrencyLabel = walletCurrency ?? "FCFA";

  const vipLabel = useMemo(() => {
    const isPremium = Boolean(user?.is_premium);
    const rawLevel = String(user?.premium_level ?? "").trim().toLowerCase();
    if (!isPremium) return "Update Plan";
    if (rawLevel === "platine" || rawLevel === "platinum") return "VIP Platine 💎";
    return "VIP Bronze 🥉";
  }, [user?.is_premium, user?.premium_level]);

  return (
    <>
      <header
        ref={(el) => {
          headerRef.current = el;
        }}
        className="fixed top-0 z-50 hidden w-full border-b border-white/10 bg-gradient-to-r from-[#0b0214]/85 via-[#22063d]/75 to-[#0b0214]/85 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur lg:block"
      >
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="flex h-[64px] w-full items-center justify-between gap-6 whitespace-nowrap">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-2xl ring-1 ring-white/15 bg-black/20">
                <Image
                  src="/logo-v2.png"
                  alt="BADBOYSHOP"
                  width={44}
                  height={44}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <div className="text-base font-extrabold tracking-tight text-white">
                BADBOY<span className="text-fuchsia-400">SHOP</span>
              </div>
            </Link>

            <nav className="flex min-w-0 flex-1 flex-nowrap items-center justify-center gap-1 text-sm font-semibold text-white/85">
              {(
                [
                  { key: "recharge" as const, label: "Recharges" },
                  { key: "subscription" as const, label: "Abonnements" },
                  { key: "marketplace" as const, label: "Gaming Accounts" },
                ]
              ).map(({ key, label }) => {
                const isOpen = openMenu === key;
                const items = menuGames[key] ?? [];
                const baseHref =
                  key === "recharge" ? "/recharges" : key === "subscription" ? "/abonnements" : "/gaming-accounts";

                return (
                  <div key={key} className={`relative ${isOpen ? "z-[70]" : "z-0"}`}>
                    <button
                      ref={(el) => {
                        menuButtonRefs.current[key] = el;
                      }}
                      type="button"
                      className={`relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 transition ${
                        isOpen ? "bg-white/10 text-white" : "hover:bg-white/8 hover:text-white"
                      } after:absolute after:inset-x-3 after:bottom-1 after:h-px after:bg-gradient-to-r after:from-transparent after:via-cyan-200/60 after:to-transparent after:opacity-0 after:transition after:duration-200 hover:after:opacity-100 ${
                        isOpen ? "after:opacity-100" : ""
                      }`}
                      aria-haspopup="menu"
                      aria-expanded={isOpen}
                      onClick={() => {
                        setShowNotifications(false);
                        setShowInbox(false);
                        setOpenMenu((prev) => (prev === key ? null : key));
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
                          event.preventDefault();
                          setShowNotifications(false);
                          setShowInbox(false);
                          setOpenMenu(key);
                          window.setTimeout(() => {
                            const first = menuItemRefs.current[key]?.find(Boolean);
                            first?.focus();
                          }, 0);
                        }
                      }}
                    >
                      <span className="whitespace-nowrap">{label}</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isOpen ? (
                      <div
                        className="absolute left-0 z-[80] mt-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-black/90 p-2 text-sm text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur"
                        role="menu"
                        aria-label={label}
                      >
                        {items.length === 0 ? (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                            Aucun jeu pour le moment.
                          </div>
                        ) : (
                          <div className="max-h-[360px] overflow-auto">
                            {items.map((g, idx) => (
                              <Link
                                key={g.id ?? g.slug ?? `${key}-${idx}`}
                                href={`${baseHref}/${encodeURIComponent(String(g.slug ?? ""))}`}
                                ref={(el) => {
                                  menuItemRefs.current[key][idx] = el;
                                }}
                                role="menuitem"
                                tabIndex={-1}
                                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/80 outline-none hover:bg-white/8 hover:text-white focus:bg-white/10 focus:text-white"
                                onClick={() => setOpenMenu(null)}
                              >
                                <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                                  {toDisplayImageSrc((g.icon || g.image) as string) ? (
                                    <Image
                                      src={toDisplayImageSrc((g.icon || g.image) as string) as string}
                                      alt={String(g.name ?? "")}
                                      width={36}
                                      height={36}
                                      className="h-7 w-7 object-contain"
                                    />
                                  ) : (
                                    <span className="text-base">🎮</span>
                                  )}
                                </span>
                                <span className="truncate font-semibold">{String(g.name ?? "")}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <Link
                href="/accessoires"
                className={`relative inline-flex items-center rounded-xl px-3 py-2 transition after:absolute after:inset-x-3 after:bottom-1 after:h-px after:bg-gradient-to-r after:from-transparent after:via-fuchsia-200/55 after:to-transparent after:opacity-0 after:transition after:duration-200 hover:after:opacity-100 ${
                  pathname === "/accessoires" ? "bg-white/10 text-white" : "hover:bg-white/8 hover:text-white"
                }`}
              >
                <span className="whitespace-nowrap">Accessoires</span>
              </Link>
            </nav>

            <div className="flex flex-nowrap items-center gap-2">
              <Link
                href="/help"
                className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/10 hover:bg-white/10 hover:shadow-[0_10px_30px_rgba(34,211,238,0.12)]"
              >
                <span aria-hidden="true" className="text-base leading-none">🎧</span>
                <span className="whitespace-nowrap">Support 24/7</span>
              </Link>
              <Link
                href="/wallet"
                className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/10 hover:bg-white/10 hover:shadow-[0_10px_30px_rgba(217,70,239,0.10)]"
              >
                <span aria-hidden="true" className="text-base leading-none">💳</span>
                <span className="whitespace-nowrap">DB Wallet</span>
              </Link>
              <Link
                href="/account"
                className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/10 hover:bg-white/10 hover:shadow-[0_10px_30px_rgba(139,92,246,0.10)]"
              >
                <span aria-hidden="true" className="text-base leading-none">👤</span>
                <span className="whitespace-nowrap">Mon Profil</span>
              </Link>
            </div>
          </div>

          <div className="pb-3">
            <div
              className="mx-auto w-full max-w-3xl p-[1px]"
              style={{
                clipPath:
                  "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)",
                background:
                  "linear-gradient(90deg, rgba(217,70,239,0.45), rgba(34,211,238,0.25), rgba(139,92,246,0.45))",
              }}
            >
              <Link
                href="/premium"
                className="relative inline-flex w-full items-center justify-center gap-2 px-5 py-2 text-sm font-extrabold tracking-wide text-white/90 hover:text-white"
                style={{
                  clipPath:
                    "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)",
                  background: "linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.15))",
                  backdropFilter: "blur(10px)",
                  whiteSpace: "nowrap",
                }}
              >
                <span className="pointer-events-none absolute inset-0 -z-10 opacity-70" style={{ background: "radial-gradient(circle at 30% 20%, rgba(34,211,238,0.18), transparent 45%), radial-gradient(circle at 70% 60%, rgba(217,70,239,0.16), transparent 50%)" }} />
                <span aria-hidden="true" className="text-base leading-none">⚡</span>
                <span className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-violet-200 bg-clip-text text-transparent">
                  {vipLabel}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/55 backdrop-blur lg:hidden">
        <div className="mx-auto flex w-full items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-black/30 ring-1 ring-white/15">
              <Image
                src="/logo-v2.png"
                alt="BADBOYSHOP"
                width={36}
                height={36}
                className="h-7 w-7 object-contain"
                priority
              />
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
            <div className="relative">
              <button
                type="button"
                className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/15 ${
                  unreadBadge ? "notify-bounce" : ""
                }`}
                aria-label="Notifications"
                onClick={handleToggleNotifications}
              >
                <Bell className="h-4 w-4 text-white/80" />
                {unreadBadge ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white notify-dot">
                    {unreadBadge}
                  </span>
                ) : null}
              </button>
            </div>
            <div className="relative">
              <button
                type="button"
                className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/15 ${
                  inboxBadge ? "notify-bounce" : ""
                }`}
                aria-label="Boîte de réception"
                onClick={handleToggleInbox}
              >
                <Mail className="h-4 w-4 text-white/80" />
                {inboxBadge ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white notify-dot">
                    {inboxBadge}
                  </span>
                ) : null}
              </button>
            </div>
            <Link
              href="/cart"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/15"
              aria-label="Panier"
              data-cart-target="mobile"
            >
              <ShoppingCart className="h-4 w-4 text-white/80" />
            </Link>
          </div>
        </div>
      </header>

      {showNotifications && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 lg:hidden"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowNotifications(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/95 p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
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
              {mobileNotifications.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                  Aucune notification pour le moment.
                </div>
              ) : (
                mobileNotifications.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 ${
                      item.is_read ? "opacity-70" : ""
                    }`}
                  >
                    <p className="text-white/90">{item.message}</p>
                    <p className="mt-1 text-[10px] text-white/40">{new Date(item.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showInbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 lg:hidden"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowInbox(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/95 p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs uppercase tracking-[0.25em] text-white/50">Boîte mail</span>
              <button
                type="button"
                className="text-xs text-white/60 hover:text-white"
                onClick={() => setShowInbox(false)}
              >
                Fermer
              </button>
            </div>
            <div className="space-y-2">
              {mobileInboxItems.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                  Aucun message pour le moment.
                </div>
              ) : (
                mobileInboxItems.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 ${
                      item.is_read ? "opacity-70" : ""
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-white/90">{item.message}</p>
                    <p className="mt-1 text-[10px] text-white/40">{new Date(item.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="h-[70px] lg:h-[112px]" aria-hidden="true" />
    </>
  );
}
