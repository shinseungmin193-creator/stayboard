export const ROOM_OVERVIEW_SELECT_FILTER_KEYS = ["propertyId", "status", "provider", "syncStatus", "operationalStatus"] as const;
export type RoomOverviewSelectFilterKey = (typeof ROOM_OVERVIEW_SELECT_FILTER_KEYS)[number];

export function updateRoomOverviewFilterParams(current: URLSearchParams, key: RoomOverviewSelectFilterKey | "query", value: string) {
  const params = new URLSearchParams(current);
  if (value) params.set(key, value);
  else params.delete(key);
  return params;
}
