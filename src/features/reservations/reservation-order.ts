export const RESERVATION_DEFAULT_ORDER_BY = [
  { property: { name: "asc" } },
  { propertyId: "asc" },
  { room: { sortOrder: "asc" } },
  { room: { name: "asc" } },
  { roomId: "asc" },
  { startDate: "asc" },
  { endDate: "asc" },
  { id: "asc" },
] as const;

export interface ReservationDefaultOrderValue {
  id: string;
  propertyId: string;
  propertyName: string;
  roomId: string;
  roomName: string;
  roomSortOrder: number;
  startDate: Date;
  endDate: Date;
}

const propertyCollator = new Intl.Collator("ko-KR");
const roomCollator = new Intl.Collator("ko-KR", { numeric: true });

export function compareReservationDefaultOrder(
  left: ReservationDefaultOrderValue,
  right: ReservationDefaultOrderValue,
): number {
  return propertyCollator.compare(left.propertyName, right.propertyName)
    || left.propertyId.localeCompare(right.propertyId)
    || left.roomSortOrder - right.roomSortOrder
    || roomCollator.compare(left.roomName, right.roomName)
    || left.roomId.localeCompare(right.roomId)
    || left.startDate.getTime() - right.startDate.getTime()
    || left.endDate.getTime() - right.endDate.getTime()
    || left.id.localeCompare(right.id);
}
