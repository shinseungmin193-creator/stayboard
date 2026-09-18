import { APP_BASE_PATH } from "../../../lib/base-path";

export const PWA_SERVICE_WORKER_VERSION = "2026-09-19.1";

export type PwaPaths = {
  startUrl: string;
  scope: string;
  manifestUrl: string;
  serviceWorkerUrl: string;
  icon192Url: string;
  icon512Url: string;
  maskableIcon512Url: string;
  appleTouchIconUrl: string;
};

export function createPwaPaths(basePath: string): PwaPaths {
  const prefix = basePath === "/" ? "" : basePath.replace(/\/$/, "");

  return {
    startUrl: prefix ? `${prefix}/` : "/",
    scope: prefix ? `${prefix}/` : "/",
    manifestUrl: `${prefix}/manifest.webmanifest`,
    serviceWorkerUrl: `${prefix}/sw.js?v=${PWA_SERVICE_WORKER_VERSION}`,
    icon192Url: `${prefix}/icons/icon-192.png`,
    icon512Url: `${prefix}/icons/icon-512.png`,
    maskableIcon512Url: `${prefix}/icons/maskable-512.png`,
    appleTouchIconUrl: `${prefix}/icons/apple-touch-icon.png`,
  };
}

export const PWA_PATHS = createPwaPaths(APP_BASE_PATH);

export function isStandalonePwa(
  displayModeStandalone: boolean,
  iosNavigatorStandalone: boolean | undefined,
): boolean {
  return displayModeStandalone || iosNavigatorStandalone === true;
}

export type BrowserIdentity = {
  userAgent: string;
  vendor: string;
  platform: string;
  maxTouchPoints: number;
};

export function isIosSafari(browser: BrowserIdentity): boolean {
  const isIosDevice = /iPhone|iPad|iPod/i.test(browser.userAgent)
    || (browser.platform === "MacIntel" && browser.maxTouchPoints > 1);
  const isSafariEngine = /Safari/i.test(browser.userAgent)
    && /Apple/i.test(browser.vendor)
    && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(browser.userAgent);

  return isIosDevice && isSafariEngine;
}
