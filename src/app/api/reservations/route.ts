import type { NextRequest } from "next/server";
import { authorizeAccess, companyScopeIds, getCurrentAccessContext, PERMISSIONS } from "@/features/access-control";
import { getDemoReservations } from "@/features/demo";
import { listReservations, toReservationViewModel } from "@/features/reservations";
import { buildReservationRepositoryFilters, getReservationPage } from "@/features/reservations/reservation-filter-server";
import { parseReservationFilters } from "@/features/reservations/reservation-filter-query";
import { calendarProviderRegistry } from "@/providers/calendar/registry";

export async function GET(request: NextRequest) {
  const context = await getCurrentAccessContext();
  const access = context ? await authorizeAccess(PERMISSIONS.RESERVATION_READ) : null;
  if (access && !access.allowed) return Response.json({ message: "예약 조회 권한이 없습니다." }, { status: 403 });
  const providerTypes = calendarProviderRegistry.list().map((provider) => provider.type);
  const filters = parseReservationFilters(request.nextUrl.searchParams, providerTypes);
  const { repositoryFilters } = buildReservationRepositoryFilters({
    filters,
    page: getReservationPage(request.nextUrl.searchParams),
    companyIds: context ? companyScopeIds(context) : undefined,
    accessScope: context?.scope,
  });
  const result = context ? await listReservations(repositoryFilters) : getDemoReservations(repositoryFilters);
  return Response.json({ ...result, items: result.items.map((item) => toReservationViewModel(item, repositoryFilters.businessDate)) }, { headers: { "Cache-Control": "private, no-store" } });
}
