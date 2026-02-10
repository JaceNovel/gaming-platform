"use client";

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";
import { API_BASE } from "@/lib/config";
import { onNotificationsPrefChanged, readNotificationsEnabled, writeNotificationsEnabled } from "@/lib/notificationPrefs";

type NotificationItem = {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  type?: string | null;
};

function NotificationsClient() {
  const { authFetch } = useAuth();

  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  const stateLabel = useMemo(() => (enabled ? "Activées ✅" : "Désactivées"), [enabled]);

  const load = async () => {
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/notifications?limit=50`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Impossible de charger les notifications");
      }
      const payload = await res.json().catch(() => null);
      const list = Array.isArray(payload?.notifications) ? (payload.notifications as NotificationItem[]) : [];
      setItems(list);
      setUnread(Number(payload?.unread ?? 0));
    } catch (e: any) {
      setItems([]);
      setUnread(0);
      setError(e?.message ?? "Erreur inattendue");
    }
  };

  useEffect(() => {
    setEnabled(readNotificationsEnabled());
    const off = onNotificationsPrefChanged(() => setEnabled(readNotificationsEnabled()));
    void load();
    return off;
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      writeNotificationsEnabled(!enabled);
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/notifications/read-all`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Action impossible");
      }
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch (e: any) {
      setError(e?.message ?? "Erreur inattendue");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#04020c] text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <SectionTitle eyebrow="Compte" label="Notifications" />
        <p className="mt-1 text-sm text-white/60">
          Notifications du compte (commandes, wallet, mises à jour, rappels).
        </p>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold">Statut</p>
          <p className="mt-1 text-sm text-white/70">{stateLabel}</p>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <GlowButton className="flex-1 justify-center" onClick={toggle} disabled={busy}>
              {enabled ? "Désactiver" : "Activer"}
            </GlowButton>
            <GlowButton variant="secondary" className="flex-1 justify-center" onClick={() => void load()} disabled={busy}>
              Rafraîchir
            </GlowButton>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Historique</p>
              <p className="mt-1 text-xs text-white/60">Non lues: {Math.max(0, unread)}</p>
            </div>
            <GlowButton variant="secondary" onClick={markAllRead} disabled={busy || items.length === 0}>
              Tout marquer comme lu
            </GlowButton>
          </div>

          <div className="mt-4 space-y-3">
            {items.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/65">Aucune notification.</div>
            ) : (
              items.map((n) => (
                <div key={n.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white/90">
                        {n.is_read ? "" : "● "}{n.message}
                      </div>
                      <div className="mt-1 text-xs text-white/55">
                        {n.type ? String(n.type) : "notification"} · {n.created_at ?? "—"}
                      </div>
                    </div>
                    {!n.is_read ? (
                      <button
                        type="button"
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError(null);
                          try {
                            const res = await authFetch(`${API_BASE}/notifications/${n.id}/read`, { method: "POST" });
                            if (!res.ok) {
                              const payload = await res.json().catch(() => null);
                              throw new Error(payload?.message ?? "Action impossible");
                            }
                            setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
                            setUnread((p) => Math.max(0, p - 1));
                          } catch (e: any) {
                            setError(e?.message ?? "Erreur inattendue");
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Marquer lu
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsClient />
    </RequireAuth>
  );
}
