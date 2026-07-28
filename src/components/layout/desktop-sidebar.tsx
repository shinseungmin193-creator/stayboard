"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthTrigger } from "@/features/auth/components/auth-trigger";
import { type UserRole } from "@/features/access-control/domain/access-control";
import { getAuthorizedSidebarMenus, orderSidebarMenus, SIDEBAR_MENU_GROUPS, SIDEBAR_MENU_ITEMS, useSidebarPreference, type SidebarMenuDefinition } from "@/features/sidebar-preferences";
import { PUBLIC_DEMO_MENU_IDS } from "@/features/sidebar-preferences/domain/sidebar-menu";
import { AccountLogoutButton } from "@/features/auth/components/account-menu";
import { NavigationLink } from "./navigation-link";

interface NavigationSection {
  key: string;
  group: keyof typeof SIDEBAR_MENU_GROUPS;
  items: SidebarMenuDefinition[];
}

function createNavigationSections(items: SidebarMenuDefinition[]): NavigationSection[] {
  return items.reduce<NavigationSection[]>((sections, item, index) => {
    const previous = sections.at(-1);
    if (previous?.group === item.group) {
      previous.items.push(item);
      return sections;
    }
    sections.push({ key: `${item.group}-${index}`, group: item.group, items: [item] });
    return sections;
  }, []);
}

export function DesktopSidebar({ role, userName, companyName }: { role: UserRole | null; userName?: string; companyName?: string | null }) {
  const { preference } = useSidebarPreference();
  const t = useTranslations();
  const menuLabel = (item: SidebarMenuDefinition) =>
    preference.customLabels[item.id as keyof typeof preference.customLabels]
    ?? t(`navigation.items.${item.id}` as Parameters<typeof t>[0]);
  const visibleItems = role
    ? getAuthorizedSidebarMenus(SIDEBAR_MENU_ITEMS, preference, role)
    : orderSidebarMenus(SIDEBAR_MENU_ITEMS, preference).filter((item) => item.group !== "developer");
  const groups = createNavigationSections(visibleItems);

  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar lg:flex lg:flex-col"><div className="flex h-16 items-center border-b px-5"><Link href="/" className="text-lg font-bold tracking-tight">StayBoard</Link></div><nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label={t("navigation.primaryMenu")}>{groups.map((group) => <section key={group.key} aria-labelledby={`nav-${group.key}`}><h2 id={`nav-${group.key}`} className="mb-1 px-3 text-[10px] font-semibold tracking-wider text-sidebar-foreground/45">{t(`navigation.groups.${group.group}`)}</h2><div className="space-y-1">{group.items.map((item) => { const label = menuLabel(item); return role || PUBLIC_DEMO_MENU_IDS.has(item.id) ? <NavigationLink key={item.id} label={label} href={item.href} icon={item.icon} /> : <AuthTrigger key={item.id} variant="ghost" className="h-9 w-full justify-start gap-3 px-3 text-sidebar-foreground/65" message={t("navigation.loginRequired", { label })}><item.icon className="size-4" /><span className="flex-1 text-left">{label}</span><Lock className="size-3" /></AuthTrigger>; })}</div></section>)}</nav><div className="border-t p-4 text-xs leading-5 text-muted-foreground">{role ? <><p className="font-medium text-sidebar-foreground">{userName}</p><p>{t(`roles.${role}`)}{companyName ? ` · ${companyName}` : ""}</p><AccountLogoutButton /></> : <><p className="font-medium text-sidebar-foreground">{t("navigation.guestMode")}</p><div className="mt-2 flex gap-1"><AuthTrigger size="sm" variant="outline">{t("common.login")}</AuthTrigger><AuthTrigger size="sm" mode="signup">{t("navigation.freeStart")}</AuthTrigger></div></>}</div></aside>;
}
