import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getCurrentAccessContext } from "@/features/access-control";
import { AuthDialogProvider } from "@/features/auth/components/auth-dialog-provider";
import { AuthTrigger } from "@/features/auth/components/auth-trigger";
import { CompanySwitcher } from "@/features/auth/components/company-switcher";
import { DemoModeBanner } from "@/features/auth/components/demo-mode-banner";
import { AccountLogoutButton } from "@/features/auth/components/account-menu";
import { DEFAULT_SIDEBAR_PREFERENCE, SidebarPreferenceProvider } from "@/features/sidebar-preferences";
import { findSidebarPreference } from "@/features/sidebar-preferences/infrastructure/sidebar-preference.repository";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileNavigation } from "./mobile-navigation";

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const accessContext = await getCurrentAccessContext();
  const sidebarPreference = accessContext ? await findSidebarPreference(accessContext.userId) : DEFAULT_SIDEBAR_PREFERENCE;
  return (
    <AuthDialogProvider>
      <SidebarPreferenceProvider initialPreference={sidebarPreference}>
        <div className="min-h-dvh bg-muted/30">
          <DesktopSidebar
            role={accessContext?.role ?? null}
            userName={accessContext?.name}
            companyName={accessContext?.activeCompanyName}
          />
          <div className="lg:pl-60">
            <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:h-16 lg:px-7">
              <span className="font-bold tracking-tight lg:hidden">StayBoard</span>
              <div className="hidden text-sm text-muted-foreground lg:block">운영 현황</div>
              <div className="flex min-w-0 items-center gap-1">
                {accessContext ? (
                  <>
                    <CompanySwitcher
                      companies={accessContext.availableCompanies ?? []}
                      activeCompanyId={accessContext.activeCompanyId}
                      allowAll={accessContext.role === "DEVELOPER"}
                    />
                    <AccountLogoutButton />
                  </>
                ) : (
                  <AuthTrigger size="sm" variant="ghost">로그인</AuthTrigger>
                )}
                <ThemeToggle />
              </div>
            </header>
            {!accessContext && <DemoModeBanner />}
            <main className="mx-auto max-w-[1500px] p-4 pb-24 sm:p-6 sm:pb-24 lg:p-7 lg:pb-7">
              {children}
            </main>
          </div>
          <MobileNavigation role={accessContext?.role ?? null} />
        </div>
      </SidebarPreferenceProvider>
    </AuthDialogProvider>
  );
}
