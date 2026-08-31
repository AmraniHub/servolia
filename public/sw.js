/**
 * Servolia service worker — deliberately minimal.
 *
 * It exists for TWO reasons and no others:
 *   1. Chrome will not fire beforeinstallprompt without a registered service
 *      worker that has a fetch handler. No worker, no install button.
 *   2. A client who opens the app in a lift should see something better than
 *      the browser's dinosaur.
 *
 * IT DELIBERATELY CACHES NO PAGES.
 *
 * The obvious "cache-first for speed" strategy is wrong here and would be
 * actively harmful: this site quotes prices, terms and a guarantee. A client
 * reading last month's €149 after it changed, or a stale guarantee clause,
 * is worse than a slow page — and staleness bugs in service workers are
 * notoriously hard to notice, because everything looks fine to whoever
 * deployed it. So every request goes to the network, and the cache is used
 * only when the network has actually failed.
 *
 * Bumping CACHE forces old caches to be dropped on the next activate.
 */

const CACHE = "servolia-v2";
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // A failed precache must not leave a broken worker installed.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch anything but plain GETs, and never touch the API: a cached or
  // replayed POST to checkout or the webhook would be its own disaster.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Page navigations: network, and the offline page only if the network is
  // genuinely unreachable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached ?? Response.error()),
      ),
    );
    return;
  }

  // Everything else: network first, falling back to a precached copy if one
  // happens to exist (icons). Nothing new is ever written to the cache here,
  // so no page can go stale.
  event.respondWith(fetch(request).catch(() => caches.match(request).then((c) => c ?? Response.error())));
});


/**
 * Push — "a patient just enquired", on the lock screen.
 *
 * The payload is JSON from src/lib/push.ts. A push event with no usable body
 * still shows something generic rather than nothing: some push services can
 * deliver an empty wake-up, and a silent no-op would look like a lost message.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Servolia";
  const options = {
    body: data.body || "Nouvelle activité sur votre espace client.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Same tag replaces rather than stacks, so ten enquiries in an hour do not
    // bury the phone in ten separate banners.
    tag: data.tag || "servolia",
    renotify: true,
    data: { url: data.url || "/portal" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Tapping the notification should land on the enquiry, and should REUSE an
 * open portal window rather than opening a second one - a client who already
 * has the app open does not want two copies of it.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/portal";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if (win.url.includes("/portal") && "focus" in win) {
          win.navigate(target).catch(() => {});
          return win.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
