// This app is fully dynamic (Supabase-backed live data, auth-gated admin
// routes) — there's no meaningful offline experience to cache, and every
// caching attempt here was only adding risk of exactly the kind of silent
// failure that broke the admin dashboard's refresh. So this service worker
// is intentionally a pure pass-through: it exists only so the site is
// installable as a PWA, and never intercepts or rewrites any request.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
