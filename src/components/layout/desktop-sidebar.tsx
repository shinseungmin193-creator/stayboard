"use client";
import Link from "next/link";
import { navigationItems } from "./navigation";
import { NavigationLink } from "./navigation-link";
export function DesktopSidebar() { return <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar lg:flex lg:flex-col"><div className="flex h-16 items-center border-b px-5"><Link href="/" className="text-lg font-bold tracking-tight">StayBoard</Link></div><nav className="flex-1 space-y-1 p-3" aria-label="주요 메뉴">{navigationItems.map((item) => <NavigationLink key={item.href} {...item} />)}</nav><div className="border-t p-4 text-xs leading-5 text-muted-foreground">숙소 운영 캘린더 관리</div></aside>; }
