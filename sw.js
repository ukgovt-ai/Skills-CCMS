/* CCMS service worker — v1
   Strategy:
   - Navigations & config.js : network-first (so updates and config edits reach users), cached fallback for offline
   - Hashed build assets, icons, fonts : cache-first (they never change under the same name)
   - Apps Script API calls are POST requests — never cached (the app keeps its own last-known snapshot in localStorage)
*/
const VERSION = "ccms-v2";
const SHELL = ["./", "./index.html", "./config.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // API POSTs pass through untouched

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname.indexOf("fonts.g") === 0 || url.hostname.indexOf("fonts.googleapis.com") !== -1 || url.hostname.indexOf("fonts.gstatic.com") !== -1;
  const isNav = req.mode === "navigate";
  const isConfig = sameOrigin && url.pathname.endsWith("/config.js");

  if (isNav || isConfig) {
    // network-first
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
    );
    return;
  }

  if (sameOrigin || isFont) {
    // cache-first with background fill
    e.respondWith(
      caches.match(req).then(
        (m) =>
          m ||
          fetch(req).then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
