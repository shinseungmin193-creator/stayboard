export const UNNAMED_ROOM_LABEL = "이름 없는 객실";

export interface RoomDisplaySource {
  name: string;
}

export function formatRoomDisplayName<Room extends RoomDisplaySource>(room: Room): string {
  return room.name.trim() || UNNAMED_ROOM_LABEL;
}

export function formatPropertyRoomDisplayName<Room extends RoomDisplaySource>(
  property: { name: string },
  room: Room,
): string {
  const propertyName = property.name.trim();
  const roomName = formatRoomDisplayName(room);
  return propertyName ? `${propertyName} · ${roomName}` : roomName;
}
