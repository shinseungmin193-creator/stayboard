import { BedDouble, Building2, CalendarDays, LayoutDashboard, RefreshCcw, Unplug } from "lucide-react";
export const navigationItems = [
  { label: "대시보드", href: "/", icon: LayoutDashboard }, { label: "예약", href: "/reservations", icon: CalendarDays },
  { label: "숙소", href: "/properties", icon: Building2 }, { label: "객실", href: "/rooms", icon: BedDouble },
  { label: "캘린더 연결", href: "/calendar-sources", icon: Unplug }, { label: "동기화 로그", href: "/calendar-sync", icon: RefreshCcw },
] as const;
