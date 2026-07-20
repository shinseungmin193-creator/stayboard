"use client";
import { navigationItems } from "./navigation";
import { NavigationLink } from "./navigation-link";
export function MobileNavigation() { return <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="모바일 주요 메뉴"><div className="flex h-16 overflow-x-auto">{navigationItems.map((item) => <NavigationLink key={item.href} {...item} mobile />)}</div></nav>; }
