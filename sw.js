// Service worker : l'application fonctionne entièrement hors ligne.
// Stratégie « réseau d'abord » pour recevoir les mises à jour dès qu'il y a du
// réseau, avec repli immédiat sur le cache sinon. Les polices Google sont gardées
// en cache après le premier chargement.
// Après une modification de l'application, augmentez le numéro de version ci-dessous.

const VERSION = "pointage-v2";
const FONTS = "pointage-fonts";
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/actions.js",
  "./js/calc.js",
  "./js/db.js",
  "./js/exporters.js",
  "./js/model.js",
  "./js/router.js",
  "./js/time.js",
  "./js/ui.js",
  "./js/views/today.js",
  "./js/views/recap.js",
  "./js/views/reports.js",
  "./js/views/cigarettes.js",
  "./js/views/export.js",
  "./js/views/backup.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((r) => (clearTimeout(t), resolve(r)), (e) => (clearTimeout(t), reject(e)));
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONTS).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === "opaque") c.put(req, res.clone());
        return res;
      })
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    withTimeout(fetch(req), 4000)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(req, { ignoreSearch: true })) ?? caches.match("./index.html"))
  );
});
