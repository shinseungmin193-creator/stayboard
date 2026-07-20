"use client";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavigationLink({ label, href, icon: Icon, mobile = false }: { label: string; href: string; icon: LucideIcon; mobile?: boolean }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  if (mobile) return <Link href={href} aria-current={active ? "page" : undefined} className={`flex min-w-[72px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}><Icon className="size-5" />{label}</Link>;
  return <Link href={href} aria-current={active ? "page" : undefined} className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}><Icon className="size-4" />{label}</Link>;
}
