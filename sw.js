// ============================================================
//  Service Worker — Bar Gestionale Offline
//  Mette in cache tutti i file statici per uso offline
// ============================================================

const CACHE_NAME = 'bar-gestionale-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/style_supplement.css',
  '/manifest.json',
  '/app.js',
  '/db/schema.js',
  '/db/database.js',
  '/db/api.js',
  '/views/tavoli.js',
  '/views/pos.js',
  '/views/menu.js',
  '/views/ingredienti.js',
  '/views/magazzino.js',
  '/views/fornitori.js',
  '/views/storico.js',
  '/views/print.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm',
];

// Installazione: pre-cache di tutti gli asset statici
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Attivazione: rimuovi vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first per asset statici
self.addEventListener('fetch', (event) => {
  // Ignora richieste non-GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Metti in cache solo risposte valide
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback per navigazione
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
