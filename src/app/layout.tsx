import type { Metadata } from "next";
import Script from "next/script";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/shared/theme-provider";
import "./globals.css";

export const metadata: Metadata = { title: { default: "StayBoard", template: "%s | StayBoard" }, description: "숙소와 객실 캘린더 동기화를 한곳에서 관리합니다." };

const themeInitializationScript = `
try {
  const savedTheme = localStorage.getItem("theme");
  const theme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
  document.documentElement.style.colorScheme = theme;
} catch (_) {}
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko" suppressHydrationWarning><body className="min-h-dvh antialiased"><ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange><AppShell>{children}</AppShell></ThemeProvider><Script id="stayboard-theme" strategy="beforeInteractive">{themeInitializationScript}</Script></body></html>;
}
