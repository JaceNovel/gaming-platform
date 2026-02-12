"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, ExternalLink } from "lucide-react";
import { API_BASE } from "@/lib/config";

type ActivityItem = {
  key: string;
  type: "order" | "user" | "marketplace_order" | string;
  id: number;
  title: string;
  created_at?: string | null;
  href?: string | null;
  meta?: Record<string, any> | null;
};

type ActivityResponse = {
  now: string;
  since: string;
  counts: Record<string, number>;
  items: ActivityItem[];
};

const STORAGE_LAST_SEEN = "bb_admin_activity_last_seen";

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (typeof window === "undefined") return headers;
  const token = localStorage.getItem("bbshop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const formatTime = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

function canUseNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export default function AdminActivityBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [lastError, setLastError] = useState<string | null>(null);

  const seenKeysRef = useRef<Set<string>>(new Set());
  const lastSeenRef = useRef<string>(new Date().toISOString());
  const pollTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    mountedRef.current = true;

    const stored = localStorage.getItem(STORAGE_LAST_SEEN);
    // If no cursor exists yet, default to "recent" (last 24h)
    lastSeenRef.current =
      stored && stored.trim() ? stored : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    setPermission(canUseNotifications() ? Notification.permission : "unsupported");

    const poll = async () => {
      try {
        const qs = new URLSearchParams({ since: lastSeenRef.current, limit: "12" });
        const res = await fetch(`${API_BASE}/admin/activity/recent?${qs.toString()}`, {
          headers: getAuthHeaders(),
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as ActivityResponse | null;
        if (!mountedRef.current) return;
        if (!res.ok) {
          setLastError((json as any)?.message ?? `Erreur ${res.status}`);
          return;
        }

        const incoming = Array.isArray(json?.items) ? json!.items : [];
        const fresh = incoming.filter((it) => {
          const key = String(it?.key ?? "").trim();
          if (!key) return false;
          if (seenKeysRef.current.has(key)) return false;
          return true;
        });

        if (fresh.length) {
          fresh.forEach((it) => {
            const key = String(it?.key ?? "").trim();
            if (key) seenKeysRef.current.add(key);
          });

          setUnread((prev) => prev + fresh.length);
          // Keep a compact list (newest first)
          setItems((prev) => {
            const next = [...fresh, ...prev];
            return next.slice(0, 12);
          });

          // Browser notifications (appear in the phone notification shade)
          if (canUseNotifications() && Notification.permission === "granted") {
            for (const it of fresh.slice(0, 3)) {
              // Avoid spam: max 3 popups per poll
              new Notification("Admin — Nouveau", {
                body: it.title,
              });
            }
          }
        }

        setLastError(null);
      } catch (e: any) {
        if (!mountedRef.current) return;
        setLastError(e?.message ?? "Impossible de récupérer les notifications");
      }
    };

    void poll();
    pollTimerRef.current = window.setInterval(() => void poll(), 25000);

    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest?.("[data-admin-bell-root='1']")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const hasUnread = unread > 0;

  const permissionLabel = useMemo(() => {
    if (permission === "unsupported") return "Non supporté";
    if (permission === "granted") return "Activées";
    if (permission === "denied") return "Bloquées";
    return "Désactivées";
  }, [permission]);

  const requestPermission = async () => {
    if (!canUseNotifications()) {
      setPermission("unsupported");
      return;
    }
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
    } catch {
      setPermission(Notification.permission);
    }
  };

  const markAllSeen = () => {
    const now = new Date().toISOString();
    lastSeenRef.current = now;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_LAST_SEEN, now);
    }
    setUnread(0);
  };

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        // Opening the dropdown = admin has seen them
        markAllSeen();
      }
      return next;
    });
  };

  return (
    <div className="relative" data-admin-bell-root="1">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
        aria-label="Notifications admin"
      >
        {hasUnread ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {hasUnread ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Nouveautés récentes</div>
              <div className="text-xs text-slate-500">Commandes, inscriptions, support, paiements, stock, marketplace</div>
            </div>
            <Link
              href="/admin/notifications"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              title="Aller à Notifications"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Page
            </Link>
          </div>

          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">Notifications navigateur (mobile): {permissionLabel}</div>
              {permission !== "granted" && permission !== "unsupported" ? (
                <button
                  type="button"
                  onClick={requestPermission}
                  className="rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold text-white"
                >
                  Activer
                </button>
              ) : null}
            </div>
            {permission === "denied" ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Les notifications sont bloquées par le navigateur. Autorise-les dans les paramètres du navigateur.
              </div>
            ) : null}
          </div>

          <div className="max-h-[340px] overflow-auto">
            {lastError ? (
              <div className="px-4 py-3 text-sm text-rose-600">{lastError}</div>
            ) : null}

            {!items.length ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">Rien de nouveau pour le moment.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((it) => (
                  <Link
                    key={it.key}
                    href={String(it.href ?? "/admin/dashboard")}
                    className="block px-4 py-3 hover:bg-slate-50"
                    onClick={() => setOpen(false)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{it.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{formatTime(it.created_at)}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                        {it.type === "order"
                          ? "Commande"
                          : it.type === "user"
                            ? "Inscription"
                            : it.type === "marketplace_order"
                              ? "Marketplace"
                              : it.type === "support_ticket"
                                ? "Support"
                                : it.type === "marketplace_dispute"
                                  ? "Litige"
                                  : it.type === "seller_kyc"
                                    ? "Vendeur"
                                    : it.type === "marketplace_listing"
                                      ? "Annonce"
                                      : it.type === "marketplace_withdraw"
                                        ? "Retrait"
                                        : it.type === "payment_failed"
                                          ? "Paiement"
                                          : it.type === "refund"
                                            ? "Remboursement"
                                            : it.type === "phone_change_request"
                                              ? "Téléphone"
                                              : it.type === "stock_movement"
                                                ? "Stock"
                                                : it.type === "redeem_low_stock"
                                                  ? "Low stock"
                                                  : "Event"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setItems([]);
                setOpen(false);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={() => setItems([])}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Effacer la liste
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
