"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Device } from "@capacitor/device";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import {
  PushNotifications,
  type PushNotificationActionPerformed,
  type PushNotificationSchema,
} from "@capacitor/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { API_BASE } from "@/lib/config";
import { FirebaseBridge } from "@/lib/native/firebaseBridge";
import { PlayIntegrity } from "@/lib/native/playIntegrity";
import {
  cacheRemoteConfig,
  getRemoteConfigDefaults,
  getRemoteConfigKeys,
  parseRemoteConfig,
} from "@/lib/remoteConfig";

const LAST_SENT_TOKEN_KEY = "native_fcm_last_sent";
const INTEGRITY_CACHE_KEY = "integrity_verified_at";
const INTEGRITY_CACHE_HOURS = 6;

const isPrimeHost = (host: string) => {
  const h = host.toLowerCase();
  return (
    h === "space.primegaming.app" ||
    h === "www.space.primegaming.app" ||
    h === "primegaming.space" ||
    h === "www.primegaming.space"
  );
};

const toInAppPath = (raw: string): string | null => {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  if (value.startsWith("/")) return value;

  try {
    const u = new URL(value);
    if (!isPrimeHost(u.host)) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
};

const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("bbshop_token");
  return token ? token.trim() : null;
};

const toIntegrityNonce = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const shouldVerifyIntegrity = async () => {
  const cached = await Preferences.get({ key: INTEGRITY_CACHE_KEY });
  const value = cached.value ? Number(cached.value) : 0;
  if (!Number.isFinite(value) || value <= 0) return true;
  const elapsedHours = (Date.now() - value) / 36e5;
  return elapsedHours >= INTEGRITY_CACHE_HOURS;
};

async function refreshRemoteConfig() {
  try {
    const result = await FirebaseBridge.fetchRemoteConfig({
      keys: getRemoteConfigKeys(),
      defaults: getRemoteConfigDefaults(),
      minFetchIntervalSeconds: 300,
    });
    const parsed = parseRemoteConfig(result.values ?? {});
    cacheRemoteConfig(parsed);
  } catch {
    // ignore
  }
}

async function verifyPlayIntegrity() {
  const authToken = getAuthToken();
  if (!authToken) return;

  const projectNumber = Number(process.env.NEXT_PUBLIC_PLAY_INTEGRITY_PROJECT_NUMBER ?? "");
  if (!Number.isFinite(projectNumber) || projectNumber <= 0) return;

  const shouldVerify = await shouldVerifyIntegrity();
  if (!shouldVerify) return;

  const nonce = toIntegrityNonce();

  try {
    const tokenResp = await PlayIntegrity.requestToken({
      nonce,
      cloudProjectNumber: projectNumber,
    });

    const integrityToken = String(tokenResp?.token ?? "").trim();
    if (!integrityToken) return;

    const res = await fetch(`${API_BASE}/play-integrity/verify`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({ integrity_token: integrityToken, nonce }),
    }).catch(() => null);

    if (res && "ok" in res && res.ok) {
      await Preferences.set({ key: INTEGRITY_CACHE_KEY, value: String(Date.now()) });
    }
  } catch {
    // ignore
  }
}

async function sendDeviceTokenToApi(deviceToken: string) {
  const authToken = getAuthToken();
  if (!authToken) return;

  const lastSent = (await Preferences.get({ key: LAST_SENT_TOKEN_KEY })).value;
  if (lastSent && lastSent === deviceToken) return;

  const info = await Device.getInfo().catch(() => null);
  const platform = info?.platform ? String(info.platform) : "android";
  const deviceName = info?.name ? String(info.name) : undefined;

  const res = await fetch(`${API_BASE}/device-tokens`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ token: deviceToken, platform, device_name: deviceName }),
  }).catch(() => null);

  if (res && "ok" in res && res.ok) {
    await Preferences.set({ key: LAST_SENT_TOKEN_KEY, value: deviceToken });
  }
}

async function safeOpenExternal(url: string) {
  try {
    await Browser.open({ url });
  } catch {
    // If Browser plugin isn't available for some reason, fall back.
    try {
      window.location.href = url;
    } catch {
      // ignore
    }
  }
}

export default function NativeBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanupAnchorInterceptor: (() => void) | null = null;
    let cleanupPullToRefresh: (() => void) | null = null;

    (async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        // ignore
      }

      try {
        await SplashScreen.hide();
      } catch {
        // ignore
      }

      try {
        const status = await Network.getStatus();
        if (!status.connected) {
          // Capacitor will show server.errorPath automatically when server.url is unreachable.
        }
      } catch {
        // ignore
      }

      // Deep links (App Links or custom scheme)
      try {
        App.addListener("appUrlOpen", (event) => {
          const path = toInAppPath(event?.url ?? "");
          if (!path) return;
          try {
            window.location.assign(path);
          } catch {
            // ignore
          }
        });
      } catch {
        // ignore
      }

      // Intercept external <a href="https://..."> clicks and open in system browser.
      try {
        const onClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement | null;
          const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
          if (!anchor) return;

          const href = String(anchor.getAttribute("href") ?? "").trim();
          if (!href) return;
          if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

          let url: URL;
          try {
            url = new URL(href, window.location.href);
          } catch {
            return;
          }

          if (url.protocol !== "http:" && url.protocol !== "https:") return;
          if (isPrimeHost(url.host)) return;

          e.preventDefault();
          e.stopPropagation();
          void safeOpenExternal(url.toString());
        };

        document.addEventListener("click", onClick, true);
        cleanupAnchorInterceptor = () => document.removeEventListener("click", onClick, true);
      } catch {
        // ignore
      }

      // Push notifications (FCM on Android)
      try {
        const perm = await PushNotifications.checkPermissions();
        if (perm.receive !== "granted") {
          await PushNotifications.requestPermissions();
        }

        await PushNotifications.register();

        PushNotifications.addListener("registration", (token) => {
          const value = String(token?.value ?? "").trim();
          if (!value) return;
          void sendDeviceTokenToApi(value);
        });

        PushNotifications.addListener("registrationError", () => {
          // ignore
        });

        const onNotification = (n: PushNotificationSchema) => {
          const path = toInAppPath((n as any)?.data?.url ?? (n as any)?.data?.link ?? "");
          if (!path) return;
          try {
            window.location.assign(path);
          } catch {
            // ignore
          }
        };

        PushNotifications.addListener("pushNotificationActionPerformed", (event: PushNotificationActionPerformed) => {
          const notification = event?.notification;
          if (notification) onNotification(notification);
        });
      } catch {
        // ignore
      }

      try {
        await refreshRemoteConfig();
      } catch {
        // ignore
      }

      try {
        await verifyPlayIntegrity();
      } catch {
        // ignore
      }

      try {
        let startY = 0;
        let armed = false;

        const onTouchStart = (event: TouchEvent) => {
          if (window.scrollY > 0) return;
          const touch = event.touches[0];
          if (!touch) return;
          startY = touch.clientY;
          armed = true;
        };

        const onTouchMove = (event: TouchEvent) => {
          if (!armed) return;
          const touch = event.touches[0];
          if (!touch) return;
          const delta = touch.clientY - startY;
          if (delta > 90) {
            armed = false;
            window.location.reload();
          }
        };

        const onTouchEnd = () => {
          armed = false;
        };

        document.addEventListener("touchstart", onTouchStart, { passive: true });
        document.addEventListener("touchmove", onTouchMove, { passive: true });
        document.addEventListener("touchend", onTouchEnd, { passive: true });

        cleanupPullToRefresh = () => {
          document.removeEventListener("touchstart", onTouchStart);
          document.removeEventListener("touchmove", onTouchMove);
          document.removeEventListener("touchend", onTouchEnd);
        };
      } catch {
        // ignore
      }
    })();

    return () => {
      try {
        cleanupAnchorInterceptor?.();
      } catch {
        // ignore
      }
      try {
        cleanupPullToRefresh?.();
      } catch {
        // ignore
      }
      try {
        App.removeAllListeners();
      } catch {
        // ignore
      }
    };
  }, []);

  return null;
}
