import { CalendarX2, ClipboardCheck, Clock3, LogIn, LogOut, RefreshCw, Sparkles, type LucideIcon } from "lucide-react";
import type { StatIconName } from "./dashboard-stat-card";

export const dashboardStatIconMap = {
  checkin: LogIn,
  checkout: LogOut,
  "priority-cleaning": Sparkles,
  "flexible-cleaning": Clock3,
  "cleaning-management": ClipboardCheck,
  overbooking: CalendarX2,
  "sync-failure": RefreshCw,
} satisfies Record<StatIconName, LucideIcon>;
