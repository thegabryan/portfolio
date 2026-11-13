/* Pass-through service worker: it caches nothing (so your updates always load).
   Its only job is to let the browser treat the site as an installable app. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () { /* let the network answer */ });
