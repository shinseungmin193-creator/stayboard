import { addDays, format, isValid, parseISO, startOfDay } from "date-fns";
import Link from "next/link";
import type { CalendarProviderType, ReservationStatus } from "@/lib/generated/prisma/enums";
import { listCalendarRoomOptions } from "@/features/calendar-sources";
import { listPropertyOptions } from "@/features/properties";
import { listReservations } from "@/features/reservations";
import type { ReservationDateField } from "@/features/reservations";
import { RESERVATION_DEFAULT_FUTURE_DAYS, RESERVATION_DEFAULT_PAST_DAYS } from "@/features/reservations/reservation.constants";
import { ReservationList } from "@/features/reservations/components/reservation-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccessDenied, authorizeAccess, companyScopeIds, PERMISSIONS } from "@/features/access-control";
import { CALENDAR_PROVIDER_LABELS } from "@/providers/calendar";
import { getDashboardDateInput } from "@/features/dashboard/dashboard-time";
import { RESERVATION_PRESERVED_QUERY_KEYS, reservationDateHref, reservationDateRangeLabel, shiftReservationDateInput } from "@/features/reservations/reservation-query";

export const metadata = { title: "예약" };
export const dynamic = "force-dynamic";
const providers = ["AIRBNB", "BOOKING", "AGODA"] as const;
const statuses = ["CONFIRMED", "CANCELLED", "TENTATIVE", "UNKNOWN"] as const;
const dateFields = ["stay", "checkIn", "checkOut"] as const;
function validDate(value: string | undefined, fallback: Date) { if (!value) return fallback; const parsed = parseISO(value); return isValid(parsed) ? startOfDay(parsed) : fallback; }

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await authorizeAccess(PERMISSIONS.RESERVATION_READ);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const context = access.context;
  const companyIds = companyScopeIds(context);
  const params = await searchParams; const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined; const now = new Date(); const today = startOfDay(now);
  const from = validDate(value("from"), addDays(today, -RESERVATION_DEFAULT_PAST_DAYS)); const to = validDate(value("to"), addDays(today, RESERVATION_DEFAULT_FUTURE_DAYS));
  const providerValue = value("provider"); const statusValue = value("status"); const dateFieldValue = value("dateField"); const propertyId = value("propertyId"); const roomId = value("roomId");
  const dateField = dateFields.includes(dateFieldValue as (typeof dateFields)[number]) ? dateFieldValue as ReservationDateField : "stay";
  const filters = { propertyId, roomId, provider: providers.includes(providerValue as (typeof providers)[number]) ? providerValue as CalendarProviderType : undefined, status: statuses.includes(statusValue as (typeof statuses)[number]) ? statusValue as ReservationStatus : undefined, dateField, from, toExclusive: addDays(to, 1), page: 1, companyIds, accessScope: context?.scope };
  const [result, properties, rooms] = await Promise.all([listReservations(filters), listPropertyOptions(companyIds, context.scope), listCalendarRoomOptions(companyIds, context.scope)]); const filteredRooms = propertyId ? rooms.filter((room) => room.propertyId === propertyId) : rooms;
  const fromInput = format(from, "yyyy-MM-dd"); const toInput = format(to, "yyyy-MM-dd"); const todayInput = getDashboardDateInput(now);
  const query = new URLSearchParams(); for (const key of RESERVATION_PRESERVED_QUERY_KEYS) { const current = value(key); if (current) query.set(key, current); } query.set("dateField", dateField); query.set("from", fromInput); query.set("to", toInput);
  const isOperationalDateFilter = dateField === "checkIn" || dateField === "checkOut";
  const previousDateHref = reservationDateHref(query, shiftReservationDateInput(fromInput, -1), shiftReservationDateInput(toInput, -1));
  const todayDateHref = reservationDateHref(query, todayInput, todayInput);
  const nextDateHref = reservationDateHref(query, shiftReservationDateInput(fromInput, 1), shiftReservationDateInput(toInput, 1));
  const dateFilterLabel = dateField === "checkIn" ? "체크인" : "체크아웃";
  const isToday = fromInput === todayInput && toInput === todayInput;
  return <div className="space-y-5"><PageHeader eyebrow="RESERVATIONS" title="예약" description={`조회 결과 ${result.totalCount}건`} /><form method="get" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 xl:grid-cols-8"><select name="propertyId" defaultValue={propertyId ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="">모든 숙소</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select><select name="roomId" defaultValue={roomId ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="">모든 객실</option>{filteredRooms.map((room) => <option key={room.id} value={room.id}>{room.propertyName} · {room.name}</option>)}</select><select name="provider" defaultValue={filters.provider ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="">모든 OTA</option>{providers.map((provider) => <option key={provider} value={provider}>{CALENDAR_PROVIDER_LABELS[provider]}</option>)}</select><select name="status" defaultValue={filters.status ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="">모든 상태</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><select name="dateField" defaultValue={dateField} aria-label="날짜 기준 필터" className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="stay">숙박 기간</option><option value="checkIn">체크인 날짜</option><option value="checkOut">체크아웃 날짜</option></select><input type="date" name="from" defaultValue={fromInput} className="h-8 rounded-lg border border-input bg-background px-2 text-sm" /><input type="date" name="to" defaultValue={toInput} className="h-8 rounded-lg border border-input bg-background px-2 text-sm" /><Button type="submit" variant="outline">필터 적용</Button></form><ReservationList reservations={result.items} />{isOperationalDateFilter && <nav aria-label={`${dateFilterLabel} 날짜 이동`} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end"><div className="flex flex-wrap items-center gap-2"><p className="text-base font-semibold sm:text-sm">{dateFilterLabel} 기준 · {reservationDateRangeLabel(fromInput, toInput)}</p>{isToday && <Badge variant="secondary">오늘</Badge>}</div><div className="grid w-full grid-cols-3 gap-2 sm:w-auto"><Button nativeButton={false} render={<Link href={previousDateHref} />} variant="outline" size="sm" className="whitespace-nowrap">← 이전 날</Button><Button nativeButton={false} render={<Link href={todayDateHref} />} variant="outline" size="sm" className="whitespace-nowrap">오늘</Button><Button nativeButton={false} render={<Link href={nextDateHref} />} variant="outline" size="sm" className="whitespace-nowrap">다음 날 →</Button></div></nav>}</div>;
}
