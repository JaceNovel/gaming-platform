/* global self */

const RUNTIME_CACHE = "prime-runtime-v1";
const OFFLINE_URL = "/offline.html";

// Take over ASAP and purge any legacy caches from previous SW versions.
self.addEventListener("install", function (event) {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.addAll([OFFLINE_URL]);
      } catch (e) {
        // ignore
      }
      try {
        self.skipWaiting();
      } catch (e) {
        // ignore
      }
    })()
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        // Keep the runtime cache so images remain available across SW updates.
        await Promise.all(keys.map((k) => (k === RUNTIME_CACHE ? Promise.resolve(false) : caches.delete(k))));
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
    const title = data.title || "PRIME Gaming";
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

self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached || Response.error();
      })
    );
    return;
  }

  if (req.destination === "image") {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);

        return cached || (await fetchPromise) || Response.error();
      })
    );
  }
});
