// Inregistrare cache (optional, dar buna practica)
const CACHE_NAME = 'negoflow-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simplu fetch handler pentru a trece de cerintele PWA (cripteaza/decripteaza offline eventual, acum doar face pass-through)
  event.respondWith(fetch(event.request));
});
