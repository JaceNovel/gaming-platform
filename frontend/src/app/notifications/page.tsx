"use client";

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";
import { API_BASE } from "@/lib/config";
import { onNotificationsPrefChanged, readNotificationsEnabled, writeNotificationsEnabled } from "@/lib/notificationPrefs";
import { canUseWebPush, urlBase64ToUint8Array } from "@/lib/webPush";

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

  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

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

  const refreshPushState = async () => {
    if (typeof window === "undefined") return;

    const supported = canUseWebPush() && "Notification" in window;
    setPushSupported(supported);
    setPushPermission(supported ? Notification.permission : "unsupported");

    if (!supported) {
      setPushSubscribed(false);
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushSubscribed(Boolean(sub));
    } catch {
      setPushSubscribed(false);
    }
  };

  useEffect(() => {
    void refreshPushState();
  }, []);

  const subscribePush = async () => {
    if (typeof window === "undefined") return;
    setPushBusy(true);
    setPushError(null);
    try {
      if (!canUseWebPush() || !("Notification" in window)) {
        setPushError("Notifications push non supportées sur ce navigateur.");
        return;
      }

      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== "granted") {
        setPushError("Autorisation refusée. Active les notifications dans le navigateur.");
        return;
      }

      const keyRes = await fetch(`${API_BASE}/push/vapid-public-key`, { cache: "no-store" });
      const keyPayload = await keyRes.json().catch(() => null);
      const publicKey = String(keyPayload?.publicKey ?? "").trim();
      if (!keyRes.ok || !publicKey) {
        setPushError("Push non configuré côté serveur (VAPID public key manquante).");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const subJson = (subscription as any).toJSON?.() ?? {};
      const endpoint = String(subJson?.endpoint ?? subscription.endpoint ?? "").trim();
      const keys = subJson?.keys ?? {};

      const res = await authFetch(`${API_BASE}/push/subscribe`, {
        method: "POST",
        body: JSON.stringify({
          endpoint,
          keys,
          contentEncoding: "aesgcm",
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Impossible d'activer les notifications push.");
      }

      setPushSubscribed(true);
    } catch (e: any) {
      setPushError(e?.message ?? "Erreur lors de l'activation push");
    } finally {
      setPushBusy(false);
    }
  };

  const unsubscribePush = async () => {
    if (typeof window === "undefined") return;
    setPushBusy(true);
    setPushError(null);
    try {
      if (!canUseWebPush()) {
        setPushSubscribed(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setPushSubscribed(false);
        return;
      }

      const endpoint = String((sub as any)?.endpoint ?? "").trim();
      if (endpoint) {
        await authFetch(`${API_BASE}/push/unsubscribe`, {
          method: "POST",
          body: JSON.stringify({ endpoint }),
        }).catch(() => null);
      }

      await sub.unsubscribe().catch(() => null);
      setPushSubscribed(false);
    } catch (e: any) {
      setPushError(e?.message ?? "Erreur lors de la désactivation push");
    } finally {
      setPushBusy(false);
    }
  };

  const testPush = async () => {
    setPushBusy(true);
    setPushError(null);
    try {
      const res = await authFetch(`${API_BASE}/push/test`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? "Test push impossible");
      }
    } catch (e: any) {
      setPushError(e?.message ?? "Test push impossible");
    } finally {
      setPushBusy(false);
    }
  };

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
          <p className="text-sm font-semibold">Notifications téléphone (push)</p>
          <p className="mt-1 text-sm text-white/70">
            {pushSupported ? (
              pushSubscribed ? "Activées ✅ (elles apparaîtront dans les notifications du téléphone)" : "Désactivées"
            ) : (
              "Non supporté sur ce navigateur"
            )}
          </p>
          <p className="mt-2 text-xs text-white/55">
            Sur iPhone, ça marche surtout après "Ajouter à l'écran d'accueil" (PWA) et avec l'autorisation activée.
          </p>

          {pushError ? (
            <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {pushError}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {pushSubscribed ? (
              <GlowButton className="flex-1 justify-center" onClick={unsubscribePush} disabled={pushBusy}>
                Désactiver push
              </GlowButton>
            ) : (
              <GlowButton className="flex-1 justify-center" onClick={subscribePush} disabled={pushBusy || !pushSupported}>
                Activer push
              </GlowButton>
            )}
            <GlowButton
              variant="secondary"
              className="flex-1 justify-center"
              onClick={() => void refreshPushState()}
              disabled={pushBusy}
            >
              Vérifier
            </GlowButton>
            <GlowButton
              variant="secondary"
              className="flex-1 justify-center"
              onClick={testPush}
              disabled={pushBusy || !pushSubscribed}
            >
              Tester
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
