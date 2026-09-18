"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthTrigger } from "@/features/auth/components/auth-trigger";
import { type UserRole } from "@/features/access-control/domain/access-control";
import { getAuthorizedSidebarItems, getSidebarNavigationItems, isDeveloperRequiredSidebarMenu, SIDEBAR_MENU_ITEMS, useSidebarPreference, type SidebarMenuDefinition, type SidebarMenuId } from "@/features/sidebar-preferences";
import { PUBLIC_DEMO_MENU_IDS } from "@/features/sidebar-preferences/domain/sidebar-menu";
import { AccountLogoutButton } from "@/features/auth/components/account-menu";
import { DeveloperRoleSwitchTrigger } from "@/features/developer-role-switch/components/developer-role-switch-provider";
import { NavigationLink } from "./navigation-link";

export function DesktopSidebar({ role, userName, companyName }: { role: UserRole | null; userName?: string; companyName?: string | null }) {
  const { preference } = useSidebarPreference();
  const t = useTranslations();
  const menuLabel = (item: SidebarMenuDefinition) => preference.customLabels[item.id as SidebarMenuId] ?? t(`navigation.items.${item.id}` as Parameters<typeof t>[0]);
  const visibleItems = role
    ? getAuthorizedSidebarItems(SIDEBAR_MENU_ITEMS, preference, role)
    : getSidebarNavigationItems(SIDEBAR_MENU_ITEMS, preference, (item) => !isDeveloperRequiredSidebarMenu(item.id as SidebarMenuId) && !preference.hiddenMenuIds.includes(item.id as SidebarMenuId));

  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar lg:flex lg:flex-col">
    <div className="flex h-16 items-center border-b px-5"><Link href="/" className="text-lg font-bold tracking-tight">StayBoard</Link></div>
    <nav className="flex-1 overflow-y-auto p-3" aria-label={t("navigation.primaryMenu")}>
      <div className="space-y-1">{visibleItems.map((item) => {
        if (item.type === "DIVIDER") return <div key={item.id} role="separator" className="mx-3 my-2 border-t border-sidebar-border" />;
        const menu = item.menu;
        const label = menuLabel(menu);
        return role || PUBLIC_DEMO_MENU_IDS.has(menu.id)
          ? <NavigationLink key={menu.id} label={label} href={menu.href} icon={menu.icon} />
          : <AuthTrigger key={menu.id} variant="ghost" className="h-9 w-full justify-start gap-3 px-3 text-sidebar-foreground/65" message={t("navigation.loginRequired", { label })}><menu.icon className="size-4" /><span className="flex-1 text-left">{label}</span><Lock className="size-3" /></AuthTrigger>;
      })}</div>
    </nav>
    <div className="border-t p-4 text-xs leading-5 text-muted-foreground">{role ? <><p className="font-medium text-sidebar-foreground">{userName}</p><p>{t(`roles.${role}`)}{companyName ? ` · ${companyName}` : ""}</p>{role === "DEVELOPER" && <DeveloperRoleSwitchTrigger variant="ghost" size="sm" className="mt-2 w-full justify-start" />}<AccountLogoutButton /></> : <><p className="font-medium text-sidebar-foreground">{t("navigation.guestMode")}</p><div className="mt-2 flex gap-1"><AuthTrigger size="sm" variant="outline">{t("common.login")}</AuthTrigger><AuthTrigger size="sm" mode="signup">{t("navigation.freeStart")}</AuthTrigger></div></>}</div>
  </aside>;
}
