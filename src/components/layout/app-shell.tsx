import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { getTranslations } from "next-intl/server";
import { getCurrentAccessContext } from "@/features/access-control";
import { AuthDialogProvider } from "@/features/auth/components/auth-dialog-provider";
import { AuthTrigger } from "@/features/auth/components/auth-trigger";
import { CompanySwitcher } from "@/features/auth/components/company-switcher";
import { DemoModeBanner } from "@/features/auth/components/demo-mode-banner";
import { AccountLogoutButton } from "@/features/auth/components/account-menu";
import { DeveloperRoleSwitchBanner, DeveloperRoleSwitchProvider, DeveloperRoleSwitchTrigger, getCurrentDeveloperRoleSwitchOptions, type ActiveDeveloperRoleSwitch } from "@/features/developer-role-switch";
import { DEFAULT_SIDEBAR_PREFERENCE, SidebarPreferenceProvider } from "@/features/sidebar-preferences";
import { findSidebarPreference } from "@/features/sidebar-preferences/infrastructure/sidebar-preference.repository";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileNavigation } from "./mobile-navigation";

export async function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const [accessContext, t] = await Promise.all([
    getCurrentAccessContext(),
    getTranslations(),
  ]);
  const sidebarPreference = accessContext ? await findSidebarPreference(accessContext.userId) : DEFAULT_SIDEBAR_PREFERENCE;
  const roleSwitchAvailable = accessContext?.actualRole === "DEVELOPER";
  const roleSwitchOptions = roleSwitchAvailable ? await getCurrentDeveloperRoleSwitchOptions() : null;
  const activeRoleSwitch: ActiveDeveloperRoleSwitch | null = accessContext?.isRoleSwitchActive
    && (accessContext.previewRole === "ADMIN" || accessContext.previewRole === "STAFF")
    && accessContext.activeCompanyId
    && accessContext.activeCompanyName
    && accessContext.developerRoleSessionId
    && accessContext.roleSwitchExpiresAt
    ? {
        sessionId: accessContext.developerRoleSessionId,
        previewRole: accessContext.previewRole,
        companyId: accessContext.activeCompanyId,
        companyName: accessContext.activeCompanyName,
        propertyScope: { mode: accessContext.roleSwitchPropertyScopeMode ?? "ALL", propertyIds: [...(accessContext.roleSwitchSelectedPropertyIds ?? [])] },
        allowedPropertyIds: [...(accessContext.allowedPropertyIds ?? [])],
        expiresAt: accessContext.roleSwitchExpiresAt,
      }
    : null;
  return (
    <AuthDialogProvider>
      <SidebarPreferenceProvider initialPreference={sidebarPreference}>
        <DeveloperRoleSwitchProvider
          available={roleSwitchAvailable}
          options={roleSwitchOptions}
          active={activeRoleSwitch}
          currentCompanyName={accessContext?.activeCompanyName ?? null}
          staleCookie={accessContext?.roleSwitchCookieStatus === "STALE"}
        >
          <div className="min-h-dvh bg-muted/30">
          <DesktopSidebar
            role={accessContext?.role ?? null}
            userName={accessContext?.name}
            companyName={accessContext?.activeCompanyName}
          />
          <div className="lg:pl-60">
            <header className="sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-end justify-between border-b bg-background/95 px-4 pb-2 backdrop-blur lg:h-16 lg:items-center lg:px-7 lg:pb-0">
              <span className="min-w-0 truncate font-bold tracking-tight lg:hidden">StayBoard</span>
              <div className="hidden text-sm text-muted-foreground lg:block">{t("navigation.currentOperations")}</div>
              <div className="flex min-w-0 items-center gap-1">
                {accessContext ? (
                  <>
                    <CompanySwitcher
                      companies={accessContext.availableCompanies ?? []}
                      activeCompanyId={accessContext.activeCompanyId}
                      allowAll={accessContext.role === "DEVELOPER"}
                    />
                    {!accessContext.isRoleSwitchActive && <DeveloperRoleSwitchTrigger size="sm" variant="ghost" className="hidden xl:inline-flex" />}
                    <AccountLogoutButton />
                  </>
                ) : (
                  <AuthTrigger size="sm" variant="ghost" className="hidden lg:inline-flex">{t("common.login")}</AuthTrigger>
                )}
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </header>
            <DeveloperRoleSwitchBanner />
            {!accessContext && <DemoModeBanner />}
            <main className="mx-auto min-w-0 max-w-[1500px] overflow-x-clip p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 sm:pb-24 lg:p-7 lg:pb-7">
              {children}
            </main>
          </div>
          <MobileNavigation role={accessContext?.role ?? null} userName={accessContext?.name} companyName={accessContext?.activeCompanyName} />
          </div>
        </DeveloperRoleSwitchProvider>
      </SidebarPreferenceProvider>
    </AuthDialogProvider>
  );
}
