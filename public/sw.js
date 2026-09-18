const STAYBOARD_SERVICE_WORKER_VERSION = "2026-09-19.1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 설치 요건을 위한 최소 fetch handler다. Cache Storage를 사용하지 않으므로
// 예약, 청소, 캘린더, API 응답은 항상 네트워크의 최신 결과를 사용한다.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(fetch(event.request));
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

void STAYBOARD_SERVICE_WORKER_VERSION;
