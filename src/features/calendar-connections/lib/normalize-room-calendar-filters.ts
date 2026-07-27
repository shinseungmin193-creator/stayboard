import type { CalendarRoomOption } from "@/features/calendar-sources/calendar-source.types";

export function normalizeRoomCalendarSelection(
  rooms: readonly CalendarRoomOption[],
  requestedPropertyId?: string,
  requestedRoomId?: string,
) {
  const propertyId = requestedPropertyId && rooms.some((room) => room.propertyId === requestedPropertyId)
    ? requestedPropertyId
    : undefined;
  const eligibleRooms = propertyId ? rooms.filter((room) => room.propertyId === propertyId) : rooms;
  const roomId = requestedRoomId && eligibleRooms.some((room) => room.id === requestedRoomId)
    ? requestedRoomId
    : undefined;
  return { propertyId, roomId };
}
