"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
export function ThemeToggle() { const { setTheme, resolvedTheme } = useTheme(); const isDark = resolvedTheme === "dark"; return <Button variant="ghost" size="icon" onClick={() => setTheme(isDark ? "light" : "dark")} aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}><Sun className="size-4 dark:hidden" /><Moon className="hidden size-4 dark:block" /></Button>; }
