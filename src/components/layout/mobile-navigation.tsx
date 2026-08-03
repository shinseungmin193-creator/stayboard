"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, MoreHorizontal, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { hasPermission, type UserRole } from "@/features/access-control/domain/access-control";
import { AccountLogoutButton } from "@/features/auth/components/account-menu";
import { AuthTrigger } from "@/features/auth/components/auth-trigger";
import { PUBLIC_DEMO_MENU_IDS, SIDEBAR_MENU_GROUPS, SIDEBAR_MENU_ITEMS, type SidebarMenuId } from "@/features/sidebar-preferences/domain/sidebar-menu";
import { getAuthorizedSidebarMenus, orderSidebarMenus, useSidebarPreference } from "@/features/sidebar-preferences";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavigationLink } from "./navigation-link";
import { Button } from "@/components/ui/button";
import { useDeveloperRoleSwitch } from "@/features/developer-role-switch/components/developer-role-switch-provider";

export const PRIMARY_MOBILE_IDS = ["dashboard", "room-overview", "reservations", "room-status"] as const satisfies readonly SidebarMenuId[];

export function MobileNavigation({ role, userName, companyName, staffPrimaryMenuIds }: { role: UserRole | null; userName?: string | null; companyName?: string | null; staffPrimaryMenuIds?: readonly SidebarMenuId[] }) {
  const { preference } = useSidebarPreference();
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const roleSwitch = useDeveloperRoleSwitch();
  const menuLabel = (item: (typeof SIDEBAR_MENU_ITEMS)[number]) =>
    preference.customLabels[item.id]
    ?? t(`navigation.items.${item.id}` as Parameters<typeof t>[0]);
  const allItems = role
    ? getAuthorizedSidebarMenus(SIDEBAR_MENU_ITEMS, preference, role)
    : orderSidebarMenus(SIDEBAR_MENU_ITEMS, preference).filter((item) => PUBLIC_DEMO_MENU_IDS.has(item.id));
  const primaryIds = role === "STAFF" && staffPrimaryMenuIds?.length === 4 ? staffPrimaryMenuIds : PRIMARY_MOBILE_IDS;
  const primaryItems = primaryIds
    .map((id) => SIDEBAR_MENU_ITEMS.find((item) => item.id === id))
    .filter((item): item is (typeof SIDEBAR_MENU_ITEMS)[number] => {
      if (!item) return false;
      return role ? hasPermission(role, item.requiredPermission) : PUBLIC_DEMO_MENU_IDS.has(item.id);
    });
  const grouped = Object.entries(SIDEBAR_MENU_GROUPS)
    .map(([key]) => ({ key, items: allItems.filter((item) => item.group === key) }))
    .filter((group) => group.items.length);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label={t("navigation.mobilePrimaryMenu")}>
        <div className="grid h-16 grid-cols-5">
          {primaryItems.slice(0, 4).map((item) => <NavigationLink key={item.id} label={menuLabel(item)} href={item.href} icon={item.icon} mobile />)}
          <SheetTrigger render={<button type="button" className="flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground" aria-label={t("navigation.allMenuOpen")} />}>
            <MoreHorizontal className="size-5" /><span>{t("navigation.more")}</span>
          </SheetTrigger>
        </div>
      </nav>
      <SheetContent side="left" className="w-[min(22rem,92vw)] gap-0 overflow-y-auto p-0 pb-[env(safe-area-inset-bottom)]" showCloseButton>
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle className="flex items-center gap-2"><Menu className="size-5" />StayBoard</SheetTitle>
          <SheetDescription className="space-y-1">
            <span className="block truncate font-medium text-foreground">{role ? userName || t("navigation.user") : t("navigation.guestMode")}</span>
            <span className="block truncate">{role ? `${t(`roles.${role}`)}${companyName ? ` · ${companyName}` : ""}` : t("navigation.demoBrowsing")}</span>
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 p-3">
          {role === "DEVELOPER" && roleSwitch.enabled && <Button type="button" variant="ghost" className="min-h-11 w-full justify-start gap-3 px-3" onClick={() => { setOpen(false); roleSwitch.open(); }}><ShieldCheck className="size-4" />{t("developerRoleSwitch.title")}</Button>}
          {grouped.map((group) => <section key={group.key} aria-labelledby={`mobile-nav-${group.key}`}>
            <h2 id={`mobile-nav-${group.key}`} className="mb-1 px-3 text-[11px] font-semibold text-muted-foreground">{t(`navigation.groups.${group.key}` as Parameters<typeof t>[0])}</h2>
            <div className="space-y-1">{group.items.map((item) => (
              <SheetClose key={item.id} nativeButton={false} render={<Link href={item.href} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-muted" />}>
                <item.icon className="size-4" /><span className="min-w-0 truncate">{menuLabel(item)}</span>
              </SheetClose>
            ))}</div>
          </section>)}
        </div>
        <div className="mt-auto border-t p-4">{role ? <AccountLogoutButton /> : <div className="grid grid-cols-2 gap-2"><AuthTrigger className="h-11" variant="outline">{t("common.login")}</AuthTrigger><AuthTrigger className="h-11" mode="signup">{t("navigation.freeStart")}</AuthTrigger></div>}</div>
      </SheetContent>
    </Sheet>
  );
}
