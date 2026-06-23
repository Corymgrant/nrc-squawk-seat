// NRC Cockpit service worker — cache the app shell so /dashboard opens instantly.
// Data fetches (/api/*) ALWAYS hit the network (never cached).
const CACHE = "nrc-cockpit-v1";
const SHELL = ["/dashboard"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Live data must never be served stale.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, fall back to cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return r;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("/dashboard"))),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((m) => {
      const fetched = fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return r;
        })
        .catch(() => m);
      return m || fetched;
    }),
  );
});
