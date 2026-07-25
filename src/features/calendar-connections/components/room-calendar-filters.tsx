import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import type { CalendarRoomOption } from "@/features/calendar-sources";
import { Button } from "@/components/ui/button";
import { ROOM_CALENDAR_STATUS_META, type RoomCalendarFilters, type RoomCalendarStatus } from "../types/room-calendar-summary";

const providers: CalendarProviderType[] = ["AIRBNB", "BOOKING", "AGODA"];
const statuses = Object.keys(ROOM_CALENDAR_STATUS_META) as RoomCalendarStatus[];

export function RoomCalendarFilterBar({ filters, rooms }: { filters: RoomCalendarFilters; rooms: CalendarRoomOption[] }) {
  const properties = [...new Map(rooms.map((room) => [room.propertyId, room.propertyName])).entries()];
  const filteredRooms = filters.propertyId ? rooms.filter((room) => room.propertyId === filters.propertyId) : rooms;
  const selectClassName = "h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm";
  return (
    <form method="get" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(8rem,.8fr)_minmax(8rem,.8fr)_auto]">
      <label className="grid gap-1 text-xs font-medium text-muted-foreground"><span>숙소</span><select name="propertyId" defaultValue={filters.propertyId ?? ""} className={selectClassName}><option value="">모든 숙소</option>{properties.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground"><span>객실</span><select name="roomId" defaultValue={filters.roomId ?? ""} className={selectClassName}><option value="">모든 객실</option>{filteredRooms.map((room) => <option key={room.id} value={room.id}>{room.propertyName} · {room.name}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground"><span>Provider</span><select name="provider" defaultValue={filters.provider ?? ""} className={selectClassName}><option value="">모든 Provider</option>{providers.map((provider) => <option key={provider} value={provider}>{provider}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground"><span>통합 상태</span><select name="status" defaultValue={filters.status ?? ""} className={selectClassName}><option value="">모든 상태</option>{statuses.map((status) => <option key={status} value={status}>{ROOM_CALENDAR_STATUS_META[status].label}</option>)}</select></label>
      <Button type="submit" variant="outline" className="self-end">필터 적용</Button>
    </form>
  );
}
