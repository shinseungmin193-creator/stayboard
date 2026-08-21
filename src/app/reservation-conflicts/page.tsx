import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AccessDenied, authorizeAccess, companyScopeIds, getCurrentAccessContext, hasPermission, PERMISSIONS } from "@/features/access-control";
import { listCalendarRoomOptions } from "@/features/calendar-sources";
import { DEMO_PROPERTY_OPTIONS, DEMO_ROOM_OPTIONS, getDemoConflicts } from "@/features/demo";
import { listPropertyOptions } from "@/features/properties";
import { ReservationConflictList } from "@/features/reservation-conflicts/components/reservation-conflict-list";
import { RESERVATION_CONFLICT_DEFAULT_FUTURE_DAYS, RESERVATION_CONFLICT_DEFAULT_PAST_DAYS } from "@/features/reservation-conflicts/reservation-conflict.constants";
import {
  getReservationConflictTodayStart,
  RESERVATION_CONFLICT_VIEW_STATUSES,
  type ReservationConflictViewStatus,
} from "@/features/reservation-conflicts/domain/reservation-conflict-dismissal";
import { listReservationConflicts } from "@/features/reservation-conflicts/infrastructure/reservation-conflict-list.repository";
import type { ConflictBulkDismissalInput } from "@/features/reservation-conflicts/reservation-conflict.types";
import { getProviderLabel } from "@/features/reservations/provider-visuals";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import { getZonedDateInput, getZonedMidnight, isValidDateInput, shiftDateInput } from "@/lib/zoned-date";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const i18n = await getTranslations();
  return { title: i18n("conflict.label") };
}

const providers = ["AIRBNB", "BOOKING", "AGODA"] as const;

function validDateOrFallback(value: string | undefined, fallback: string) {
  return isValidDateInput(value) ? value : fallback;
}

export default async function ReservationConflictsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const i18n = await getTranslations();
  const context = await getCurrentAccessContext();
  const access = context ? await authorizeAccess(PERMISSIONS.RESERVATION_READ) : null;
  if (access && !access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const companyIds = context ? companyScopeIds(context) : undefined;
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const todayInput = getZonedDateInput(new Date(), DEFAULT_TIMEZONE);
  const fromInput = validDateOrFallback(value("from"), shiftDateInput(todayInput, -RESERVATION_CONFLICT_DEFAULT_PAST_DAYS));
  const requestedToInput = validDateOrFallback(value("to"), shiftDateInput(todayInput, RESERVATION_CONFLICT_DEFAULT_FUTURE_DAYS));
  const toInput = requestedToInput < fromInput ? fromInput : requestedToInput;
  const from = getZonedMidnight(fromInput, DEFAULT_TIMEZONE);
  const toExclusive = getZonedMidnight(shiftDateInput(toInput, 1), DEFAULT_TIMEZONE);
  const todayStart = getReservationConflictTodayStart();
  const pageNumber = Number(value("page"));
  const requestedPage = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const providerValue = value("provider");
  const statusValue = value("status");
  const status = RESERVATION_CONFLICT_VIEW_STATUSES.includes(statusValue as ReservationConflictViewStatus)
    ? statusValue as ReservationConflictViewStatus
    : "ACTIVE";
  const [properties, rooms] = context
    ? await Promise.all([listPropertyOptions(companyIds, context.scope), listCalendarRoomOptions(companyIds, context.scope)])
    : [DEMO_PROPERTY_OPTIONS, DEMO_ROOM_OPTIONS];
  const rawPropertyId = value("propertyId");
  const propertyId = properties.some((item) => item.id === rawPropertyId) ? rawPropertyId : undefined;
  const eligibleRooms = propertyId ? rooms.filter((room) => room.propertyId === propertyId) : rooms;
  const rawRoomId = value("roomId");
  const roomId = eligibleRooms.some((room) => room.id === rawRoomId) ? rawRoomId : undefined;
  const provider = providers.includes(providerValue as typeof providers[number])
    ? providerValue as CalendarProviderType
    : undefined;
  const filters = {
    propertyId,
    roomId,
    provider,
    status,
    from,
    toExclusive,
    todayStart,
    page: requestedPage,
    companyIds,
    accessScope: context?.scope,
  };
  const result = context ? await listReservationConflicts(filters) : getDemoConflicts(filters);
  const query = new URLSearchParams();
  if (propertyId) query.set("propertyId", propertyId);
  if (roomId) query.set("roomId", roomId);
  if (provider) query.set("provider", provider);
  query.set("status", status);
  query.set("from", fromInput);
  query.set("to", toInput);
  const href = (target: number) => {
    const copy = new URLSearchParams(query);
    copy.set("page", String(target));
    return `/reservation-conflicts?${copy}`;
  };
  const bulkFilter: ConflictBulkDismissalInput = { propertyId, roomId, provider, from: fromInput, to: toInput };
  const canManage = Boolean(context && hasPermission(context.role, PERMISSIONS.ROOM_MANAGE));

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={i18n("conflict.eyebrow")} title={i18n("conflict.label")} description={i18n("auto.m0077", { value0: result.totalCount })} />
      <form method="get" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 xl:grid-cols-7">
        <select name="propertyId" defaultValue={propertyId ?? ""} aria-label={i18n("auto.m0078")} className="h-8 rounded-lg border bg-background px-2 text-sm">
          <option value="">{i18n("auto.m0079")}</option>
          {properties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select name="roomId" defaultValue={roomId ?? ""} aria-label={i18n("auto.m0080")} className="h-8 rounded-lg border bg-background px-2 text-sm">
          <option value="">{i18n("auto.m0081")}</option>
          {eligibleRooms.map((item) => <option key={item.id} value={item.id}>{item.propertyName} · {item.name}</option>)}
        </select>
        <select name="provider" defaultValue={provider ?? ""} aria-label={i18n("auto.m0082")} className="h-8 rounded-lg border bg-background px-2 text-sm">
          <option value="">{i18n("auto.m0083")}</option>
          {providers.map((item) => <option key={item} value={item}>{getProviderLabel(item, i18n)}</option>)}
        </select>
        <select name="status" defaultValue={status} aria-label={i18n("auto.m0084", { value0: i18n("conflict.label") })} className="h-8 rounded-lg border bg-background px-2 text-sm">
          {RESERVATION_CONFLICT_VIEW_STATUSES.map((item) => <option key={item} value={item}>{i18n(`conflictFilter.${item}`)}</option>)}
        </select>
        <input type="date" name="from" aria-label={i18n("auto.m0085", { value0: i18n("conflict.label") })} defaultValue={fromInput} className="h-8 rounded-lg border bg-background px-2 text-sm" />
        <input type="date" name="to" aria-label={i18n("auto.m0086", { value0: i18n("conflict.label") })} defaultValue={toInput} className="h-8 rounded-lg border bg-background px-2 text-sm" />
        <Button type="submit" variant="outline">{i18n("auto.m0087")}</Button>
      </form>
      <ReservationConflictList
        conflicts={result.items}
        canManage={canManage}
        dismissibleCount={result.dismissibleCount}
        showBulkDismissal={status !== "DISMISSED"}
        bulkFilter={bulkFilter}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{result.page} / {result.totalPages}{i18n("auto.m0088")}</span>
        <div className="flex gap-2">
          <Button nativeButton={false} render={<Link href={href(Math.max(1, result.page - 1))} />} size="sm" variant="outline" disabled={result.page <= 1}>{i18n("auto.m0014")}</Button>
          <Button nativeButton={false} render={<Link href={href(Math.min(result.totalPages, result.page + 1))} />} size="sm" variant="outline" disabled={result.page >= result.totalPages}>{i18n("auto.m0015")}</Button>
        </div>
      </div>
    </div>
  );
}
