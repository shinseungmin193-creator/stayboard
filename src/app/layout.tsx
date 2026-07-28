import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { AuthProvider } from "@/features/auth/components/auth-provider";
import { getOptionalSession } from "@/features/auth/server/get-current-user";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: { default: "StayBoard", template: "%s | StayBoard" }, description: t("description") };
}

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
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
