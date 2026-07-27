import { addDays, endOfMonth, startOfMonth, startOfWeek } from "date-fns";
import { getDashboardDateInput, getDashboardTodayRange } from "../dashboard/dashboard-time";

export type ReservationDatePreset = "today" | "this-week" | "this-month" | "custom";

export interface ReservationDateRange {
  from: string;
  to: string;
}

export function getReservationDatePresetRange(preset: Exclude<ReservationDatePreset, "custom">, now = new Date()): ReservationDateRange {
  const { start } = getDashboardTodayRange(now);
  if (preset === "today") {
    const today = getDashboardDateInput(start);
    return { from: today, to: today };
  }
  if (preset === "this-week") {
    return {
      from: getDashboardDateInput(startOfWeek(start, { weekStartsOn: 1 })),
      to: getDashboardDateInput(addDays(startOfWeek(start, { weekStartsOn: 1 }), 6)),
    };
  }
  return {
    from: getDashboardDateInput(startOfMonth(start)),
    to: getDashboardDateInput(endOfMonth(start)),
  };
}
