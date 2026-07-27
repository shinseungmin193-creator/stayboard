import { AccessDenied, authorizeAccess, companyScopeIds, getCurrentAccessContext, PERMISSIONS } from "@/features/access-control";
import { listCalendarRoomOptions } from "@/features/calendar-sources";
import { DEMO_PROPERTY_OPTIONS, DEMO_ROOM_OPTIONS, getDemoReservations } from "@/features/demo";
import { listPropertyOptions } from "@/features/properties";
import { hasScopedReservations, listReservations, toReservationViewModel } from "@/features/reservations";
import { ReservationWorkspace } from "@/features/reservations/components/reservation-workspace";
import { parseReservationFilters, serializeReservationFilters } from "@/features/reservations/reservation-filter-query";
import { buildReservationRepositoryFilters, getReservationPage } from "@/features/reservations/reservation-filter-server";
import { calendarProviderRegistry } from "@/providers/calendar/registry";

export const metadata = { title: "예약" };
export const dynamic = "force-dynamic";

function toUrlSearchParams(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (typeof value === "string") query.set(key, value);
  return query;
}

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await getCurrentAccessContext();
  const access = context ? await authorizeAccess(PERMISSIONS.RESERVATION_READ) : null;
  if (access && !access.allowed) return <AccessDenied role={access.context?.role ?? null} />;

  const companyIds = context ? companyScopeIds(context) : undefined;
  const [params, properties, rooms] = await Promise.all([
    searchParams,
    context ? listPropertyOptions(companyIds, context.scope) : Promise.resolve(DEMO_PROPERTY_OPTIONS),
    context ? listCalendarRoomOptions(companyIds, context.scope) : Promise.resolve(DEMO_ROOM_OPTIONS),
  ]);
  const query = toUrlSearchParams(params);
  const providerOptions = calendarProviderRegistry.list().map((provider) => ({ value: provider.type, label: provider.displayName }));
  const parsedFilters = parseReservationFilters(query, providerOptions.map((provider) => provider.value));
  const propertyId = properties.some((property) => property.id === parsedFilters.propertyId) ? parsedFilters.propertyId : null;
  const eligibleRoomIds = new Set(rooms.filter((room) => !propertyId || room.propertyId === propertyId).map((room) => room.id));
  const filters = { ...parsedFilters, propertyId, roomId: parsedFilters.roomId && eligibleRoomIds.has(parsedFilters.roomId) ? parsedFilters.roomId : null };
  const { repositoryFilters, effectiveDateRange } = buildReservationRepositoryFilters({
    filters,
    page: getReservationPage(query),
    companyIds,
    accessScope: context?.scope,
  });
  const result = context ? await listReservations(repositoryFilters) : getDemoReservations(repositoryFilters);
  const hasAny = result.totalCount > 0 || (context ? await hasScopedReservations({ businessDate: repositoryFilters.businessDate, companyIds, accessScope: context.scope }) : true);

  return (
    <div className="space-y-2 sm:space-y-4">
      <header className="border-b pb-2 sm:pb-5">
        <p className="hidden text-[11px] font-semibold tracking-[0.18em] text-muted-foreground sm:block">RESERVATIONS</p>
        <h1 className="text-xl font-bold tracking-tight sm:mt-1 sm:text-3xl">예약</h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1.5 sm:text-sm">실제 OTA 예약을 빠르게 찾고 상세 정보를 확인합니다.</p>
      </header>
      <ReservationWorkspace
        key={`${serializeReservationFilters(filters)}|page=${result.page}`}
        initialFilters={filters}
        effectiveDateRange={{ from: effectiveDateRange.fromInput, to: effectiveDateRange.toInput }}
        initialResult={{ ...result, items: result.items.map((item) => toReservationViewModel(item, repositoryFilters.businessDate)) }}
        hasAnyReservations={hasAny}
        properties={properties}
        rooms={rooms}
        providers={providerOptions}
      />
    </div>
  );
}
