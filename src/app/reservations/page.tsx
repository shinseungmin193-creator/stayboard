import { addDays, format, isValid, parseISO, startOfDay } from "date-fns";
import Link from "next/link";
import type { CalendarProviderType, ReservationStatus } from "@/lib/generated/prisma/enums";
import { listCalendarRoomOptions } from "@/features/calendar-sources";
import { listPropertyOptions } from "@/features/properties";
import { listReservations } from "@/features/reservations";
import { RESERVATION_DEFAULT_FUTURE_DAYS, RESERVATION_DEFAULT_PAST_DAYS } from "@/features/reservations/reservation.constants";
import { ReservationList } from "@/features/reservations/components/reservation-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "예약" };
export const dynamic = "force-dynamic";
const providers = ["AIRBNB", "BOOKING", "AGODA"] as const;
const statuses = ["CONFIRMED", "CANCELLED", "BLOCKED", "TENTATIVE", "UNKNOWN"] as const;
function validDate(value: string | undefined, fallback: Date) { if (!value) return fallback; const parsed = parseISO(value); return isValid(parsed) ? startOfDay(parsed) : fallback; }

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams; const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined; const today = startOfDay(new Date());
  const from = validDate(value("from"), addDays(today, -RESERVATION_DEFAULT_PAST_DAYS)); const to = validDate(value("to"), addDays(today, RESERVATION_DEFAULT_FUTURE_DAYS)); const pageValue = Number(value("page")); const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const providerValue = value("provider"); const statusValue = value("status"); const propertyId = value("propertyId"); const roomId = value("roomId");
  const filters = { propertyId, roomId, provider: providers.includes(providerValue as (typeof providers)[number]) ? providerValue as CalendarProviderType : undefined, status: statuses.includes(statusValue as (typeof statuses)[number]) ? statusValue as ReservationStatus : undefined, from, toExclusive: addDays(to, 1), page };
  const [result, properties, rooms] = await Promise.all([listReservations(filters), listPropertyOptions(), listCalendarRoomOptions()]); const filteredRooms = propertyId ? rooms.filter((room) => room.propertyId === propertyId) : rooms;
  const query = new URLSearchParams(); for (const key of ["propertyId", "roomId", "provider", "status", "from", "to"] as const) { const current = value(key); if (current) query.set(key, current); }
  const pageHref = (target: number) => { const copy = new URLSearchParams(query); copy.set("page", String(target)); return `/reservations?${copy}`; };
  return <div className="space-y-5"><PageHeader eyebrow="RESERVATIONS" title="예약" description={`조회 결과 ${result.totalCount}건`} /><form method="get" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 xl:grid-cols-7"><select name="propertyId" defaultValue={propertyId ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="">모든 숙소</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select><select name="roomId" defaultValue={roomId ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="">모든 객실</option>{filteredRooms.map((room) => <option key={room.id} value={room.id}>{room.propertyName} · {room.name}</option>)}</select><select name="provider" defaultValue={filters.provider ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="">모든 Provider</option>{providers.map((provider) => <option key={provider}>{provider}</option>)}</select><select name="status" defaultValue={filters.status ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="">모든 상태</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><input type="date" name="from" defaultValue={format(from, "yyyy-MM-dd")} className="h-8 rounded-lg border border-input bg-background px-2 text-sm" /><input type="date" name="to" defaultValue={format(to, "yyyy-MM-dd")} className="h-8 rounded-lg border border-input bg-background px-2 text-sm" /><Button type="submit" variant="outline">필터 적용</Button></form><ReservationList reservations={result.items} /><div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{page} / {result.totalPages} 페이지</p><div className="flex gap-2"><Button render={<Link href={pageHref(Math.max(1, page - 1))} />} variant="outline" size="sm" disabled={page <= 1}>이전</Button><Button render={<Link href={pageHref(Math.min(result.totalPages, page + 1))} />} variant="outline" size="sm" disabled={page >= result.totalPages}>다음</Button></div></div></div>;
}
