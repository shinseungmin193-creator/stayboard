"use client";
import type { UserRole } from "@/features/access-control";
import { PUBLIC_DEMO_MENU_IDS } from "@/features/sidebar-preferences/domain/sidebar-menu";
import { getAuthorizedSidebarMenus, getSidebarMenuLabel, orderSidebarMenus, useSidebarPreference } from "@/features/sidebar-preferences";
import { navigationItems } from "./navigation";
import { NavigationLink } from "./navigation-link";
export function MobileNavigation({ role }: { role: UserRole | null }) { const { preference } = useSidebarPreference(); const items = role ? getAuthorizedSidebarMenus(navigationItems, preference, role) : orderSidebarMenus(navigationItems, preference).filter((item) => PUBLIC_DEMO_MENU_IDS.has(item.id)); return <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="모바일 주요 메뉴"><div className="flex h-16 overflow-x-auto">{items.map((item) => <NavigationLink key={item.href} label={getSidebarMenuLabel(item, preference)} href={item.href} icon={item.icon} mobile />)}</div></nav>; }
