// Service Worker simples: cacheia o "casco" da aplicação (HTML/CSS/JS/ícones)
// para que a app abra mais rápido e continue a abrir mesmo com internet fraca.
// Os dados (perguntas, resultados, manuais) continuam sempre a vir da rede,
// porque usam fetch()/Firebase diretamente e não passam por este cache.

const CACHE_NAME = "simulador-exames-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Nunca intercetar chamadas à API ou ao Firebase: essas têm de ir sempre à rede.
  if (
    request.method !== "GET" ||
    request.url.includes("/api/") ||
    request.url.includes("firestore") ||
    request.url.includes("firebase") ||
    request.url.includes("googleapis")
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
