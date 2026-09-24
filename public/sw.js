const VERSION = "shoplink-v1";
const CORE = "core";
const SHELL = [
  "/",
  "/dashboard",
  "/pos",
  "/produtos",
  "/stock",
  "/vendas",
  "/clientes",
  "/caixa",
  "/fornecedores",
  "/categorias",
  "/configuracoes",
  "/login",
  "/registar",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(`${CORE}-${VERSION}`)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.includes(VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // API: rede primeiro, sem cache offline (evita dados obsoletos)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => Response.error()));
    return;
  }

  // Navegação: rede primeiro, fallback para o shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(`${CORE}-${VERSION}`).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() =>
          caches.match("/").then((shell) => shell || caches.match(request))
        )
    );
    return;
  }

  // Estáticos: cache-first com atualização em segundo plano
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(`${CORE}-${VERSION}`).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});