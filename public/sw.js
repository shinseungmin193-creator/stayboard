const STAYBOARD_SERVICE_WORKER_VERSION = "2026-10-28.1";

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

// A future Web Push adapter supplies a same-origin, base-path-aware href in
// notification.data. Clicking it focuses the PWA and opens the target room's
// inspection dialog without exposing room data in the notification payload.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const fallbackPath = new URL(self.registration.scope).pathname;
  const requestedHref = typeof event.notification.data?.href === "string"
    ? event.notification.data.href
    : fallbackPath;
  const target = new URL(requestedHref, self.location.origin);
  if (target.origin !== self.location.origin) return;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows[0];
    if (existing) {
      if ("navigate" in existing) await existing.navigate(target.href);
      await existing.focus();
      return;
    }
    await self.clients.openWindow(target.href);
  })());
});

void STAYBOARD_SERVICE_WORKER_VERSION;
