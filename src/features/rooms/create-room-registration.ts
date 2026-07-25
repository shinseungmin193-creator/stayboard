import type { CalendarDraftConnectionResult } from "../calendar-sources/calendar-source.types";
import type { SupportedRoomCalendarProvider } from "./room-calendar-draft";

export interface RoomRegistrationInput {
  room: { propertyId: string; name: string; capacity: number };
  calendars: Array<{ provider: SupportedRoomCalendarProvider; calendarUrl: string; name: string }>;
}

export class RoomRegistrationError extends Error {
  constructor(public readonly provider: SupportedRoomCalendarProvider, message: string) { super(message); this.name = "RoomRegistrationError"; }
}

export async function createRoomRegistration(input: RoomRegistrationInput, dependencies: {
  testConnection: (provider: SupportedRoomCalendarProvider, calendarUrl: string) => Promise<CalendarDraftConnectionResult>;
  createAtomically: (room: RoomRegistrationInput["room"], calendars: Array<{ provider: SupportedRoomCalendarProvider; calendarUrl: string; name: string }>) => Promise<{ id: string }>;
}) {
  const verified = [] as RoomRegistrationInput["calendars"];
  const normalizedUrls = new Set<string>();
  for (const calendar of input.calendars) {
    try { const result = await dependencies.testConnection(calendar.provider, calendar.calendarUrl); if (normalizedUrls.has(result.normalizedUrl)) throw new RoomRegistrationError(calendar.provider, "같은 iCal URL을 두 번 등록할 수 없습니다."); normalizedUrls.add(result.normalizedUrl); verified.push({ ...calendar, calendarUrl: result.normalizedUrl }); }
    catch (error) { if (error instanceof RoomRegistrationError) throw error; throw new RoomRegistrationError(calendar.provider, error instanceof Error ? error.message : "연결 테스트에 실패했습니다."); }
  }
  return dependencies.createAtomically(input.room, verified);
}
