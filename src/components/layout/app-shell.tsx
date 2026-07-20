import { ThemeToggle } from "@/components/shared/theme-toggle";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileNavigation } from "./mobile-navigation";
export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) { return <div className="min-h-dvh bg-muted/30"><DesktopSidebar /><div className="lg:pl-60"><header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:h-16 lg:px-7"><span className="font-bold tracking-tight lg:hidden">StayBoard</span><div className="hidden text-sm text-muted-foreground lg:block">운영 현황</div><ThemeToggle /></header><main className="mx-auto max-w-[1500px] p-4 pb-24 sm:p-6 sm:pb-24 lg:p-7 lg:pb-7">{children}</main></div><MobileNavigation /></div>; }
