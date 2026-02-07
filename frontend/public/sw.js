/* global self */

// Take over ASAP and purge any legacy caches from previous SW versions.
self.addEventListener("install", function () {
  try {
    self.skipWaiting();
  } catch (e) {
    // ignore
  }
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        // ignore
      }
      try {
        await self.clients.claim();
      } catch (e) {
        // ignore
      }
    })()
  );
});

self.addEventListener("message", function (event) {
  try {
    if (event && event.data && event.data.type === "SKIP_WAITING") {
      self.skipWaiting();
    }
  } catch (e) {
    // ignore
  }
});

self.addEventListener("push", function (event) {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "BADBOYSHOP";
    const options = {
      body: data.body || "Nouvelle notification",
      data: { url: data.url || "/" },
      icon: data.icon || "/android-chrome-192x192.png",
      badge: data.badge || "/android-chrome-192x192.png",
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // ignore
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    })
  );
});
