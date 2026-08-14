import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AccessDenied, authorizeAccess, companyScopeIds, getCurrentAccessContext, PERMISSIONS } from "@/features/access-control";
import { DEMO_PROPERTY_OPTIONS, getDemoRoomStatusData } from "@/features/demo";
import { listPropertyOptions } from "@/features/properties";
import { getRoomStatusCalendarRange, listRoomStatusCalendar, shiftRoomStatusMonth } from "@/features/room-status";
import { MonthlyReservationCalendar } from "@/features/room-status/components/monthly-reservation-calendar";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getZonedDateInput } from "@/lib/zoned-date";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const i18n = await getTranslations();
  return { title: i18n("navigation.items.room-status") };
}

const CALENDAR_DAYS = 42;

export default async function RoomStatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const i18n = await getTranslations();
  const context = await getCurrentAccessContext();
  const access = context ? await authorizeAccess(PERMISSIONS.ROOM_READ) : null;
  if (access && !access.allowed) return <AccessDenied role={access.context?.role ?? null} />;

  const companyIds = context ? companyScopeIds(context) : undefined;
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const properties = context ? await listPropertyOptions(companyIds, context.scope) : DEMO_PROPERTY_OPTIONS;
  const requestedPropertyId = value("propertyId");
  const propertyId = properties.some((property) => property.id === requestedPropertyId) ? requestedPropertyId : undefined;
  const calendarRange = getRoomStatusCalendarRange(value("month"));
  const rooms = context
    ? await listRoomStatusCalendar({
        propertyId,
        rangeStart: calendarRange.rangeStart,
        rangeEnd: calendarRange.rangeEnd,
        companyIds,
        accessScope: context.scope,
      })
    : getDemoRoomStatusData(calendarRange);

  const monthHref = (targetMonth: string) => {
    const query = new URLSearchParams({ month: targetMonth });
    if (propertyId) query.set("propertyId", propertyId);
    return `/room-status?${query}`;
  };
  const monthDisplayDate = new Date(`${calendarRange.month}-01T12:00:00Z`);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="ROOM STATUS" title={i18n("navigation.items.room-status")} description={i18n("auto.m0095", { value0: i18n("conflict.label") })} />
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <form method="get" className="flex flex-1 flex-col gap-2 sm:max-w-sm sm:flex-row">
          <input type="hidden" name="month" value={calendarRange.month} />
          <select name="propertyId" defaultValue={propertyId ?? ""} className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm">
            <option value="">{i18n("auto.m0079")}</option>
            {properties.filter((property) => property.isActive).map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
          <Button type="submit" variant="outline">{i18n("auto.m0096")}</Button>
        </form>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Button nativeButton={false} render={<Link href={monthHref(shiftRoomStatusMonth(calendarRange.month, -1))} />} variant="outline" size="icon" aria-label={i18n("auto.m0097")}><ChevronLeft /></Button>
          <p className="min-w-28 text-center text-sm font-semibold">{format(monthDisplayDate, i18n("auto.m0098"))}</p>
          <Button nativeButton={false} render={<Link href={monthHref(shiftRoomStatusMonth(calendarRange.month, 1))} />} variant="outline" size="icon" aria-label={i18n("auto.m0099")}><ChevronRight /></Button>
        </div>
      </div>
      <MonthlyReservationCalendar
        rooms={rooms}
        rangeStart={`${calendarRange.month}-01`}
        dayCount={CALENDAR_DAYS}
        today={getZonedDateInput(new Date(), DEFAULT_TIMEZONE)}
      />
    </div>
  );
}
