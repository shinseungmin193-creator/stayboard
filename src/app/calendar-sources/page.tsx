import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import { listCalendarRoomOptions, listCalendarSources, maskCalendarUrl, type CalendarSourceFilters, type CalendarSourceListItem } from "@/features/calendar-sources";
import { CalendarSourceForm } from "@/features/calendar-sources/components/calendar-source-form";
import { CalendarSourceList } from "@/features/calendar-sources/components/calendar-source-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "캘린더 연결" };
export const dynamic = "force-dynamic";
const providers = ["AIRBNB", "BOOKING", "AGODA"] as const;

export default async function CalendarSourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const providerValue = value("provider"); const activeValue = value("isActive");
  const filters: CalendarSourceFilters = { propertyId: value("propertyId"), roomId: value("roomId"), provider: providers.includes(providerValue as (typeof providers)[number]) ? providerValue as CalendarProviderType : undefined, isActive: activeValue === "true" ? true : activeValue === "false" ? false : undefined };
  const [rawSources, rooms] = await Promise.all([listCalendarSources(filters), listCalendarRoomOptions()]);
  const sources: CalendarSourceListItem[] = rawSources.map(({ calendarUrl, room, ...source }) => ({ ...source, roomName: room.name, propertyId: room.propertyId, propertyName: room.property.name, maskedUrl: maskCalendarUrl(calendarUrl) }));
  const properties = [...new Map(rooms.map((room) => [room.propertyId, room.propertyName])).entries()];
  const filteredRooms = filters.propertyId ? rooms.filter((room) => room.propertyId === filters.propertyId) : rooms;
  return <div className="space-y-5"><PageHeader eyebrow="INTEGRATIONS" title="캘린더 연결" description="객실별 OTA ICS 주소를 등록하고 안전하게 연결 상태를 점검합니다." action={<CalendarSourceForm rooms={rooms} />} /><form method="get" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5"><select name="propertyId" defaultValue={filters.propertyId ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="">모든 숙소</option>{properties.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select name="roomId" defaultValue={filters.roomId ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="">모든 객실</option>{filteredRooms.map((room) => <option key={room.id} value={room.id}>{room.propertyName} · {room.name}</option>)}</select><select name="provider" defaultValue={filters.provider ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="">모든 Provider</option>{providers.map((provider) => <option key={provider} value={provider}>{provider}</option>)}</select><select name="isActive" defaultValue={activeValue ?? ""} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="">모든 상태</option><option value="true">활성</option><option value="false">비활성</option></select><Button type="submit" variant="outline">필터 적용</Button></form><p className="text-xs leading-5 text-muted-foreground">연결 테스트는 ICS 형식만 확인하며 예약을 저장하거나 최근 동기화 시각을 변경하지 않습니다. 비활성 연결도 진단 목적으로 테스트할 수 있습니다.</p><CalendarSourceList sources={sources} rooms={rooms} /></div>;
}
