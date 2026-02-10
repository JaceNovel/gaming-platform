const KEY = "bbshop_notifications_enabled";
const EVENT_NAME = "bbshop:notifications-pref";

declare global {
  interface Window {
    __bbshopNotificationsPref?: boolean;
  }
}

export const readNotificationsEnabled = (): boolean => {
  if (typeof window === "undefined") return true;

  if (typeof window.__bbshopNotificationsPref === "boolean") {
    return window.__bbshopNotificationsPref;
  }

  const raw = window.localStorage.getItem(KEY);
  if (raw === null) {
    window.__bbshopNotificationsPref = true;
    return true;
  }

  const normalized = String(raw).trim().toLowerCase();
  const value = normalized === "1" || normalized === "true" || normalized === "yes";
  window.__bbshopNotificationsPref = value;
  return value;
};

export const writeNotificationsEnabled = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  window.__bbshopNotificationsPref = enabled;
  window.localStorage.setItem(KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event(EVENT_NAME));
};

export const onNotificationsPrefChanged = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};

  const handler = () => cb();
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
};
