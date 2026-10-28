// App-shell cache only — map tiles, Firebase, and the Leaflet CDN are never
// intercepted here, since this is a live GPS game that needs fresh network
// data for all of those. Bump CACHE_VERSION whenever a shipped file changes,
// so returning players pick up the update instead of a stale shell.
const CACHE_VERSION = 'wf-shell-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/main.js',
  './js/combat.js',
  './js/economy.js',
  './js/geo.js',
  './js/map.js',
  './js/multiplayer.js',
  './js/npc.js',
  './js/portraits.js',
  './js/sign.js',
  './js/signpad.js',
  './js/spells.js',
  './js/state.js',
  './js/ui.js',
  './js/utils.js',
  './js/wizard.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => Promise.all(
      // js/firebase-config.js is a per-developer file, gitignored and absent
      // on most deploys (multiplayer is an optional overlay) — add each file
      // independently so one missing/failed fetch can't sink the rest.
      SHELL_FILES.map((url) => cache.add(url).catch(() => {})),
    )).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Network-first for the shell so a deployed update is picked up as soon as
  // it's reachable; falls back to the cached copy when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
