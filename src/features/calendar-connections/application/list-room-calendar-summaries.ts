import type { RoomCalendarFilters } from "../types/room-calendar-summary";
import { mapRoomCalendarSummary } from "../lib/map-room-calendar-summary";
import { findRoomCalendarRows } from "../infrastructure/room-calendar.repository";

export async function listRoomCalendarSummaries(filters: RoomCalendarFilters, now = new Date()) {
  const rows = await findRoomCalendarRows(filters);
  const summaries = rows.map((row) => mapRoomCalendarSummary(row, now, filters.canViewTechnicalDetails));
  return filters.status ? summaries.filter((room) => room.status === filters.status) : summaries;
}
