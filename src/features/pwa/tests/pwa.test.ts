import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";
import { AUTH_COOKIE_PATH } from "../../auth/domain/cookie-policy";
import {
  createPwaPaths,
  isIosSafari,
  isStandalonePwa,
  PWA_PATHS,
} from "../domain/pwa";

test("PWA paths include the configured /stayboard base path", () => {
  const paths = createPwaPaths("/stayboard");

  assert.equal(paths.startUrl, "/stayboard/");
  assert.equal(paths.scope, "/stayboard/");
  assert.equal(paths.manifestUrl, "/stayboard/manifest.webmanifest");
  assert.match(paths.serviceWorkerUrl, /^\/stayboard\/sw\.js\?v=/);
  assert.equal(paths.icon192Url, "/stayboard/icons/icon-192.png");
  assert.equal(paths.icon512Url, "/stayboard/icons/icon-512.png");
  assert.equal(paths.maskableIcon512Url, "/stayboard/icons/maskable-512.png");
  assert.equal(paths.appleTouchIconUrl, "/stayboard/icons/apple-touch-icon.png");
});

test("root deployment PWA paths do not gain a duplicate prefix", () => {
  const paths = createPwaPaths("");

  assert.equal(paths.startUrl, "/");
  assert.equal(paths.scope, "/");
  assert.equal(paths.manifestUrl, "/manifest.webmanifest");
  assert.equal(paths.icon192Url, "/icons/icon-192.png");
});

test("manifest declares an installable standalone app and base-path-aware assets", () => {
  const source = readFileSync("src/app/manifest.ts", "utf8");

  assert.match(source, /name: "StayBoard"/);
  assert.match(source, /short_name: "StayBoard"/);
  assert.match(source, /display: "standalone"/);
  assert.match(source, /orientation: "portrait-primary"/);
  assert.match(source, /start_url: PWA_PATHS\.startUrl/);
  assert.match(source, /scope: PWA_PATHS\.scope/);
  assert.match(source, /purpose: "maskable"/);
  assert.equal(PWA_PATHS.manifestUrl, "/stayboard/manifest.webmanifest");
});

test("standalone mode supports standard and iOS detection", () => {
  assert.equal(isStandalonePwa(true, undefined), true);
  assert.equal(isStandalonePwa(false, true), true);
  assert.equal(isStandalonePwa(false, false), false);
});

test("iOS Safari guide is limited to Safari on iPhone and iPad", () => {
  const safariUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

  assert.equal(isIosSafari({
    userAgent: safariUserAgent,
    vendor: "Apple Computer, Inc.",
    platform: "iPhone",
    maxTouchPoints: 5,
  }), true);
  assert.equal(isIosSafari({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
    vendor: "Apple Computer, Inc.",
    platform: "MacIntel",
    maxTouchPoints: 5,
  }), true);
  assert.equal(isIosSafari({
    userAgent: `${safariUserAgent} CriOS/128.0.0.0`,
    vendor: "Apple Computer, Inc.",
    platform: "iPhone",
    maxTouchPoints: 5,
  }), false);
  assert.equal(isIosSafari({
    userAgent: "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36",
    vendor: "Google Inc.",
    platform: "Linux armv8l",
    maxTouchPoints: 5,
  }), false);
});

test("generated PWA icons have the declared dimensions", async () => {
  const expected = [
    ["public/icons/icon-192.png", 192],
    ["public/icons/icon-512.png", 512],
    ["public/icons/maskable-512.png", 512],
    ["public/icons/apple-touch-icon.png", 180],
  ] as const;

  for (const [file, size] of expected) {
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.width, size, file);
    assert.equal(metadata.height, size, file);
    assert.equal(metadata.format, "png", file);
  }
});

test("service worker is versioned, updates immediately, and never caches business data", () => {
  const worker = readFileSync("public/sw.js", "utf8");
  const registration = readFileSync("src/features/pwa/components/pwa-service-worker-registration.tsx", "utf8");

  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(worker, /self\.clients\.claim\(\)/);
  assert.match(worker, /fetch\(event\.request\)/);
  assert.doesNotMatch(worker, /caches\.open|cache\.put|CacheFirst|StaleWhileRevalidate/);
  assert.match(registration, /PWA_PATHS\.serviceWorkerUrl/);
  assert.match(registration, /scope: PWA_PATHS\.scope/);
  assert.match(registration, /updateViaCache: "none"/);
  assert.match(registration, /registration\.update\(\)/);
});

test("mobile install UX captures Android prompt and iOS standalone state", () => {
  const hook = readFileSync("src/features/pwa/hooks/use-pwa-install.ts", "utf8");
  const navigation = readFileSync("src/components/layout/mobile-navigation.tsx", "utf8");

  assert.match(hook, /beforeinstallprompt/);
  assert.match(hook, /appinstalled/);
  assert.match(hook, /prompt\.prompt\(\)/);
  assert.match(hook, /prompt\.userChoice/);
  assert.match(hook, /display-mode: standalone/);
  assert.match(hook, /navigatorWithStandalone\.standalone/);
  assert.match(navigation, /PwaInstallMenuItem/);
  assert.match(navigation, /lg:hidden/);
  assert.match(navigation, /safe-area-inset-bottom/);
});

test("root layout declares viewport-fit and PWA metadata", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");

  assert.match(layout, /viewportFit: "cover"/);
  assert.match(layout, /manifest: PWA_PATHS\.manifestUrl/);
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /PwaServiceWorkerRegistration/);
});

test("standalone and browser sessions share the same base-path cookie scope", () => {
  assert.equal(PWA_PATHS.scope, "/stayboard/");
  assert.equal(AUTH_COOKIE_PATH, "/stayboard");
  assert.ok(PWA_PATHS.startUrl.startsWith(`${AUTH_COOKIE_PATH}/`));
});
