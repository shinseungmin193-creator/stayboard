import type { Metadata } from "next";
import Script from "next/script";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { AuthProvider } from "@/features/auth/components/auth-provider";
import { getOptionalSession } from "@/features/auth/server/get-current-user";
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getOptionalSession();
  return <html lang="ko" suppressHydrationWarning><body className="min-h-dvh antialiased"><AuthProvider session={session}><ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange><AppShell>{children}</AppShell></ThemeProvider></AuthProvider><Script id="stayboard-theme" strategy="beforeInteractive">{themeInitializationScript}</Script></body></html>;
}
