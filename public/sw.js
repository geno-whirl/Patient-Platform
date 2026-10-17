// Service worker de la PWA: permite instalar la app y abrirla sin conexión.
//
// Solo guarda en caché archivos estáticos de la propia app (HTML, JS, CSS, íconos).
// Nunca guarda llamadas a Supabase ni a Google (otros orígenes), así que los datos
// clínicos no quedan en esta caché.
const VERSION = 'kine-v1';
const BASE = new URL('./', self.location).pathname; // "/" o "/Patient-Platform/"
const ESENCIALES = [BASE, `${BASE}manifest.webmanifest`, `${BASE}favicon.svg`, `${BASE}icon-192.png`];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ESENCIALES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  // Navegación: primero la red (para recibir versiones nuevas); sin conexión, la app guardada.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) caches.open(VERSION).then((c) => c.put(BASE, r.clone()));
          return r;
        })
        .catch(() => caches.match(BASE)),
    );
    return;
  }

  // Archivos con hash en el nombre (assets/…): no cambian nunca → caché primero.
  if (url.pathname.startsWith(`${BASE}assets/`)) {
    e.respondWith(
      caches.match(req).then(
        (enCache) =>
          enCache ||
          fetch(req).then((r) => {
            if (r.ok) caches.open(VERSION).then((c) => c.put(req, r.clone()));
            return r;
          }),
      ),
    );
    return;
  }

  // Resto (íconos, manifiesto): caché y se actualiza en segundo plano.
  e.respondWith(
    caches.match(req).then((enCache) => {
      const red = fetch(req)
        .then((r) => {
          if (r.ok) caches.open(VERSION).then((c) => c.put(req, r.clone()));
          return r;
        })
        .catch(() => enCache);
      return enCache || red;
    }),
  );
});
