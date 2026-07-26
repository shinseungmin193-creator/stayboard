"use client";

import Link from "next/link";
import { Menu, MoreHorizontal } from "lucide-react";
import type { UserRole } from "@/features/access-control";
import { USER_ROLE_LABELS } from "@/features/access-control/domain/access-control";
import { AccountLogoutButton } from "@/features/auth/components/account-menu";
import { AuthTrigger } from "@/features/auth/components/auth-trigger";
import { PUBLIC_DEMO_MENU_IDS, SIDEBAR_MENU_GROUPS, SIDEBAR_MENU_ITEMS } from "@/features/sidebar-preferences/domain/sidebar-menu";
import { getAuthorizedSidebarMenus, getSidebarMenuLabel, orderSidebarMenus, useSidebarPreference } from "@/features/sidebar-preferences";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavigationLink } from "./navigation-link";

const PRIMARY_MOBILE_IDS = ["dashboard", "room-overview", "reservations", "room-status"];

export function MobileNavigation({ role, userName, companyName }: { role: UserRole | null; userName?: string | null; companyName?: string | null }) {
  const { preference } = useSidebarPreference();
  const allItems = role
    ? getAuthorizedSidebarMenus(SIDEBAR_MENU_ITEMS, preference, role)
    : orderSidebarMenus(SIDEBAR_MENU_ITEMS, preference).filter((item) => PUBLIC_DEMO_MENU_IDS.has(item.id));
  const primaryItems = PRIMARY_MOBILE_IDS
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is (typeof allItems)[number] => Boolean(item));
  const grouped = Object.entries(SIDEBAR_MENU_GROUPS)
    .map(([key, label]) => ({ key, label, items: allItems.filter((item) => item.group === key) }))
    .filter((group) => group.items.length);

  return (
    <Sheet>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="모바일 주요 메뉴">
        <div className="grid h-16 grid-cols-5">
          {primaryItems.slice(0, 4).map((item) => <NavigationLink key={item.href} label={getSidebarMenuLabel(item, preference)} href={item.href} icon={item.icon} mobile />)}
          <SheetTrigger render={<button type="button" className="flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground" aria-label="전체 메뉴 열기" />}>
            <MoreHorizontal className="size-5" /><span>더보기</span>
          </SheetTrigger>
        </div>
      </nav>
      <SheetContent side="left" className="w-[min(22rem,92vw)] gap-0 overflow-y-auto p-0 pb-[env(safe-area-inset-bottom)]" showCloseButton>
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle className="flex items-center gap-2"><Menu className="size-5" />StayBoard</SheetTitle>
          <SheetDescription className="space-y-1">
            <span className="block truncate font-medium text-foreground">{role ? userName || "사용자" : "게스트 모드"}</span>
            <span className="block truncate">{role ? `${USER_ROLE_LABELS[role]}${companyName ? ` · ${companyName}` : ""}` : "로그인하지 않고 데모를 둘러보는 중입니다."}</span>
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 p-3">
          {grouped.map((group) => <section key={group.key} aria-labelledby={`mobile-nav-${group.key}`}>
            <h2 id={`mobile-nav-${group.key}`} className="mb-1 px-3 text-[11px] font-semibold text-muted-foreground">{group.label}</h2>
            <div className="space-y-1">{group.items.map((item) => (
              <SheetClose key={item.id} nativeButton={false} render={<Link href={item.href} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-muted" />}>
                <item.icon className="size-4" /><span className="min-w-0 truncate">{getSidebarMenuLabel(item, preference)}</span>
              </SheetClose>
            ))}</div>
          </section>)}
        </div>
        <div className="mt-auto border-t p-4">{role ? <AccountLogoutButton /> : <div className="grid grid-cols-2 gap-2"><AuthTrigger className="h-11" variant="outline">로그인</AuthTrigger><AuthTrigger className="h-11" mode="signup">무료 시작</AuthTrigger></div>}</div>
      </SheetContent>
    </Sheet>
  );
}
