"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isIosSafari, isStandalonePwa } from "@/features/pwa/domain/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type IosNavigator = Navigator & { standalone?: boolean };

export type PwaInstallStatus =
  | "CHECKING"
  | "AVAILABLE"
  | "PROMPTING"
  | "IOS_GUIDE"
  | "INSTALLED"
  | "HIDDEN";

export function usePwaInstall() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState<PwaInstallStatus>("CHECKING");

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const navigatorWithStandalone = navigator as IosNavigator;

    const updateStandaloneStatus = () => {
      if (isStandalonePwa(standaloneQuery.matches, navigatorWithStandalone.standalone)) {
        deferredPrompt.current = null;
        setStatus("INSTALLED");
        return true;
      }
      return false;
    };

    if (!updateStandaloneStatus()) {
      setStatus(isIosSafari({
        userAgent: navigator.userAgent,
        vendor: navigator.vendor,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints,
      }) ? "IOS_GUIDE" : "HIDDEN");
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as BeforeInstallPromptEvent;
      setStatus("AVAILABLE");
    };
    const handleInstalled = () => {
      deferredPrompt.current = null;
      setStatus("INSTALLED");
    };
    const handleDisplayModeChange = () => {
      updateStandaloneStatus();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    standaloneQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      standaloneQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;

    deferredPrompt.current = null;
    setStatus("PROMPTING");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setStatus(choice.outcome === "accepted" ? "INSTALLED" : "HIDDEN");
    } catch {
      setStatus("HIDDEN");
    }
  }, []);

  return { status, promptInstall };
}
