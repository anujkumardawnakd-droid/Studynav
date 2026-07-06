/**
 * service-worker.js
 * Version: study-nav-v1
 * Strategies (per spec section 27):
 *   HTML       -> Network First (falls back to cache, then offline.html)
 *   CSS/JS     -> Cache First
 *   Images     -> Stale While Revalidate
 *   Fonts      -> Cache First
 */
const VERSION = "study-nav-v1";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/css/global.css",
  "/css/components.css",
  "/css/animations.css",
  "/js/app.js",
  "/js/storage.js",
  "/js/state-manager.js",
  "/js/auth.js",
  "/js/ai-engine.js",
  "/js/timetable-engine.js",
  "/js/analytics-engine.js",
  "/js/notification-manager.js",
  "/js/router.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.warn("[sw] precache failed (non-fatal)", err))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n.startsWith("study-nav-") && n !== STATIC_CACHE && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

function isHTML(req) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}
function isStyleOrScript(url) {
  return url.pathname.endsWith(".css") || url.pathname.endsWith(".js");
}
function isImage(req, url) {
  return req.destination === "image" || /\.(png|jpg|jpeg|svg|webp|gif)$/.test(url.pathname);
}
function isFont(req, url) {
  return req.destination === "font" || /\.(woff2?|ttf|otf)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin && !url.hostname.includes("fonts.g")) {
    return; // don't intercept third-party (e.g. Google auth) requests
  }

  if (isHTML(req)) {
    event.respondWith(networkFirst(req));
  } else if (isImage(req, url)) {
    event.respondWith(staleWhileRevalidate(req));
  } else if (isStyleOrScript(url) || isFont(req, url)) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req) || await caches.match(req);
    return cached || (await caches.match("/offline.html"));
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const networkPromise = fetch(req)
    .then((fresh) => {
      cache.put(req, fresh.clone());
      return fresh;
    })
    .catch(() => cached);
  return cached || networkPromise;
}

// Allows the app to trigger an immediate activation after an update prompt.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
