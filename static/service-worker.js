const CACHE_NAME = "neon-snake-v7";
const CORE_ASSETS = [
    "/static/style.css",
    "/static/game.js",
    "/static/rhythm.js?v=7",
    "/static/pwa.js",
    "/static/theme.js",
    "/static/icon.svg",
    "/static/maskable-icon.svg",
    "/manifest.json"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);
    const shouldCache = url.origin === self.location.origin && (
        url.pathname.startsWith("/static/") ||
        url.pathname === "/manifest.json" ||
        url.pathname === "/service-worker.js"
    );

    if (!shouldCache) return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            const network = fetch(event.request).then(response => {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                return response;
            });

            return cached || network;
        })
    );
});
