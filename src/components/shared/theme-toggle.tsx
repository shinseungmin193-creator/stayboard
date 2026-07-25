"use client";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/shared/theme-provider";
const subscribe = () => () => undefined;
export function ThemeToggle() { const { setTheme, resolvedTheme } = useTheme(); const mounted = useSyncExternalStore(subscribe, () => true, () => false); const isDark = mounted && resolvedTheme === "dark"; return <Button variant="ghost" size="icon" onClick={() => setTheme(isDark ? "light" : "dark")} aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}><Sun className="size-4 dark:hidden" /><Moon className="hidden size-4 dark:block" /></Button>; }
