// Service Worker simples: cacheia o "casco" da aplicação (HTML/CSS/JS/ícones)
// para que a app abra mais rápido e continue a abrir mesmo com internet fraca.
// Os dados (perguntas, resultados, manuais) continuam sempre a vir da rede,
// porque usam fetch()/Firebase diretamente e não passam por este cache.

const CACHE_NAME = "simulador-exames-v2";
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

// --------------------------------------------------------------------------
// Web Push: notificações para o admin quando um candidato clica em
// "Já Paguei". O payload vem do endpoint /api/sendAdminPush (ver
// api/sendAdminPush.ts), disparado pelo cliente logo depois de gravar
// paymentStatus: "pending" no Firestore.
// --------------------------------------------------------------------------
self.addEventListener("push", (event) => {
  let data = { title: "EstudaBué", body: "Tens uma nova notificação." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // payload não era JSON válido; mantém os valores por omissão
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "estudabue-payment",
    renotify: true,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Ao clicar na notificação, foca uma aba já aberta da app (se existir) ou
// abre uma nova, sempre no separador de gestão de acessos do admin.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
