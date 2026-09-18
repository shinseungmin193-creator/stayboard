import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { AuthProvider } from "@/features/auth/components/auth-provider";
import { getOptionalSession } from "@/features/auth/server/get-current-user";
import { PwaServiceWorkerRegistration } from "@/features/pwa";
import { PWA_PATHS } from "@/features/pwa/domain/pwa";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: "StayBoard", template: "%s | StayBoard" },
    description: t("description"),
    applicationName: "StayBoard",
    manifest: PWA_PATHS.manifestUrl,
    icons: {
      icon: [
        { url: PWA_PATHS.icon192Url, sizes: "192x192", type: "image/png" },
        { url: PWA_PATHS.icon512Url, sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: PWA_PATHS.appleTouchIconUrl, sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: {
      capable: true,
      title: "StayBoard",
      statusBarStyle: "black-translucent",
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [session, locale, messages] = await Promise.all([
    getOptionalSession(),
    getLocale(),
    getMessages(),
  ]);
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <AuthProvider session={session}>
              <PwaServiceWorkerRegistration />
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
