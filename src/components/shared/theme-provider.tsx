"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme(theme: Theme): void;
}

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: "class";
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "theme";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
}

function withoutTransitions(update: () => void) {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  update();
  window.getComputedStyle(document.body);
  window.setTimeout(() => style.remove(), 1);
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);
    const initialTheme = isTheme(savedTheme) ? savedTheme : defaultTheme;
    return enableSystem ? initialTheme : initialTheme === "system" ? "light" : initialTheme;
  });
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => typeof window === "undefined" ? "light" : getSystemTheme());
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const applyTheme = useCallback((nextTheme: "light" | "dark") => {
    const update = () => {
      if (attribute === "class") {
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(nextTheme);
      }
      document.documentElement.style.colorScheme = nextTheme;
    };
    if (disableTransitionOnChange) withoutTransitions(update);
    else update();
  }, [attribute, disableTransitionOnChange]);

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_THEME_QUERY);
    const handleChange = () => setSystemTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => applyTheme(resolvedTheme), [applyTheme, resolvedTheme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !isTheme(event.newValue)) return;
      setThemeState(enableSystem ? event.newValue : event.newValue === "system" ? "light" : event.newValue);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [enableSystem]);

  const setTheme = useCallback((nextTheme: Theme) => {
    const allowedTheme = enableSystem ? nextTheme : nextTheme === "system" ? "light" : nextTheme;
    window.localStorage.setItem(STORAGE_KEY, allowedTheme);
    setThemeState(allowedTheme);
  }, [enableSystem]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [resolvedTheme, setTheme, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeProvider 안에서 사용해야 합니다.");
  return context;
}
