/* global self */

self.addEventListener("push", function (event) {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "BADBOYSHOP";
    const options = {
      body: data.body || "Nouvelle notification",
      data: { url: data.url || "/" },
      icon: data.icon || "/images/logo.png",
      badge: data.badge || "/images/logo.png",
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
