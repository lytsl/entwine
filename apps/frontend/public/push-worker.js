/**
 * Shows what the server pushes, and opens its issue when clicked. Served from the root, unbundled: a service worker
 * controls the pages under its own path. A message is `{ title, body, url, tag }`; one tag per issue, so a browser
 * keeps the latest notification of an issue rather than a pile of them.
 */
self.addEventListener("push", (event) => {
  const message = event.data?.json();
  if (!message) return;
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      renotify: true,
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (!url) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      const open = tabs.find((tab) => tab.url === url);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
