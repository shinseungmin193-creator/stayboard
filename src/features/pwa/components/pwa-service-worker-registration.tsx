"use client";

import { useEffect } from "react";
import { PWA_PATHS } from "@/features/pwa/domain/pwa";

export function PwaServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(PWA_PATHS.serviceWorkerUrl, {
          scope: PWA_PATHS.scope,
          updateViaCache: "none",
        });
        await registration.update();
      } catch {
        // PWA 설치 지원 실패가 StayBoard의 일반 웹 사용을 막아서는 안 된다.
      }
    };

    if (document.readyState === "complete") {
      void register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
