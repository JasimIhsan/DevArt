// DevArt service worker: keeps the app's files so it opens instantly and installs as an app.
// Diagrams live in Supabase, so only same-origin app files are cached. The build fills in the file list and version.
const PRECACHE = self.__PRECACHE__;
const VERSION = self.__VERSION__;
const SHELL = `devart-shell-${VERSION}`;

self.addEventListener('install', (event) => {
  // The new version waits until the user accepts the update, so a page never mixes old and new files.
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('devart-') && name !== SHELL) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.match('/index.html', { cacheName: SHELL }).then((r) => r ?? fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, { cacheName: SHELL }).then((r) => r ?? fetch(request)));
});
