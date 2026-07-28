export const UNNAMED_ROOM_LABEL = "이름 없는 객실";

export interface RoomDisplaySource {
  name: string;
}

export interface RoomDisplayLabelSource {
  propertyName?: string | null;
  roomName?: string | null;
  roomNumber?: string | null;
}

const ROOM_NUMBER_SUFFIX_PATTERN = /\s*(?:호|号室)$/u;
const ROOM_NUMBER_PATTERN = /^\d+(?:[-‐–]\d+)?[A-Za-z]?$/u;

export function formatRoomNumber(roomName: string | null | undefined, locale = "ko-KR"): string {
  const trimmed = roomName?.trim() ?? "";
  if (!trimmed) return "";
  const withoutSuffix = trimmed.replace(ROOM_NUMBER_SUFFIX_PATTERN, "");
  if (withoutSuffix === trimmed && !ROOM_NUMBER_PATTERN.test(withoutSuffix)) return trimmed;
  return `${withoutSuffix}${locale.toLocaleLowerCase("en-US").startsWith("ja") ? "号室" : "호"}`;
}

export function formatRoomDisplayLabel(input: RoomDisplayLabelSource, locale = "ko-KR"): string {
  const propertyName = input.propertyName?.trim() ?? "";
  const roomName = formatRoomNumber(input.roomName?.trim() || input.roomNumber, locale);
  return [propertyName, roomName].filter(Boolean).join(" ");
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
