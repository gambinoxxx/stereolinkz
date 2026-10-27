// Stereolinkz service worker: notifications only. It caches no pages, data
// or offline content (no fetch handler). Registered by signed-in admin
// pages; payloads come from features/notifications (title, body, url, tag)
// and never carry a customer's name, number, email or account number.

// Only our own pages: "/admin/deals/SLZ-1094", never another site.
function safePath(url) {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//")
    ? url
    : "/admin";
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Stereolinkz";
  const work = [
    // Every push shows a notification (iOS and Chrome require it).
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || undefined, // the deal ref: a newer alert replaces it
      renotify: !!data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: safePath(data.url) },
    }),
  ];
  if (typeof data.badge === "number" && self.navigator.setAppBadge)
    work.push(
      (data.badge > 0
        ? self.navigator.setAppBadge(data.badge)
        : self.navigator.clearAppBadge()
      ).catch(() => {}),
    );
  event.waitUntil(Promise.all(work));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const target = new URL(path, self.location.origin).href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // An open app window: bring it forward on that page.
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// The browser replaced the subscription (keys rotated or expired): make a
// new one and tell the server, which swaps it for the old endpoint. The
// request carries the signed-in session's cookies.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      const fresh =
        event.newSubscription ||
        (await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: old && old.options.applicationServerKey,
        }));
      await fetch("/api/push/resubscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldEndpoint: old ? old.endpoint : null,
          subscription: fresh.toJSON(),
        }),
      });
    })().catch(() => {}),
  );
});
