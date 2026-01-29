"use client";

import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import GlowButton from "@/components/ui/GlowButton";
import SectionTitle from "@/components/ui/SectionTitle";
import { API_BASE } from "@/lib/config";
import { canUseWebPush, urlBase64ToUint8Array } from "@/lib/webPush";

type VapidResponse = { publicKey?: string };

type PushState = "checking" | "unsupported" | "denied" | "enabled" | "disabled";

async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!canUseWebPush()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

function NotificationsClient() {
  const { authFetch } = useAuth();

  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isSupported = useMemo(() => canUseWebPush(), []);

  const refreshState = async () => {
    if (!isSupported) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    const sub = await getExistingSubscription();
    setState(sub ? "enabled" : "disabled");
  };

  useEffect(() => {
    void refreshState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = async () => {
    if (!isSupported) {
      setState("unsupported");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        setMessage("Permission refusée.");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await reg.update();

      const keyRes = await fetch(`${API_BASE}/push/vapid-public-key`, { cache: "no-store" });
      const keyPayload = (await keyRes.json().catch(() => null)) as VapidResponse | null;
      const publicKey = String(keyPayload?.publicKey ?? "").trim();
      if (!publicKey) {
        throw new Error("Clé VAPID manquante côté serveur.");
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const payload = subscription.toJSON();
      const endpoint = String(payload.endpoint ?? "");
      const p256dh = String((payload as any)?.keys?.p256dh ?? "");
      const auth = String((payload as any)?.keys?.auth ?? "");

      if (!endpoint || !p256dh || !auth) {
        throw new Error("Subscription invalide.");
      }

      const res = await authFetch(`${API_BASE}/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          keys: { p256dh, auth },
          contentEncoding: "aesgcm",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? "Impossible d'activer les notifications.");
      }

      await authFetch(`${API_BASE}/push/test`, { method: "POST" });
      setState("enabled");
      setMessage("Notifications activées ✅");
    } catch (e: any) {
      setMessage(e?.message ?? "Erreur inattendue");
      await refreshState();
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const sub = await getExistingSubscription();
      if (sub) {
        const payload = sub.toJSON();
        const endpoint = String(payload.endpoint ?? "");

        if (endpoint) {
          await authFetch(`${API_BASE}/push/unsubscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          });
        }

        await sub.unsubscribe();
      }

      setState("disabled");
      setMessage("Notifications désactivées.");
    } catch (e: any) {
      setMessage(e?.message ?? "Erreur inattendue");
      await refreshState();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#04020c] text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <SectionTitle
          title="Notifications"
          subtitle="Active les notifications web pour recevoir les confirmations (wallet, commissions, etc.)."
        />

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold">Statut</p>
          <p className="mt-1 text-sm text-white/70">
            {state === "checking" && "Vérification…"}
            {state === "unsupported" && "Non supporté sur ce navigateur/appareil."}
            {state === "denied" && "Permission bloquée (réactive-la dans ton navigateur)."}
            {state === "enabled" && "Activées ✅"}
            {state === "disabled" && "Désactivées"}
          </p>

          {message && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">
              {message}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <GlowButton className="flex-1 justify-center" onClick={enable} disabled={busy || state === "enabled" || state === "unsupported"}>
              Activer
            </GlowButton>
            <GlowButton
              variant="secondary"
              className="flex-1 justify-center"
              onClick={disable}
              disabled={busy || state !== "enabled"}
            >
              Désactiver
            </GlowButton>
          </div>

          <p className="mt-4 text-xs text-white/50">
            Note: nécessite des clés VAPID côté serveur (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`).
          </p>
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
