import { DASHBOARD_TIMEZONE } from "./dashboard.constants";
import { getZonedDayRange } from "../../lib/zoned-date";

export function getDashboardDateInput(now: Date): string {
  return getZonedDayRange(now, DASHBOARD_TIMEZONE).dateInput;
}

export function getDashboardTodayRange(now: Date): { start: Date; end: Date } {
  const { start, end } = getZonedDayRange(now, DASHBOARD_TIMEZONE);
  return { start, end };
}
