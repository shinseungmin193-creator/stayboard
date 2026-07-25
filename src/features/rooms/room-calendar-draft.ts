import type { CalendarProviderType } from "../../lib/generated/prisma/enums";

export const ROOM_CALENDAR_PROVIDER_CONFIG = [
  { provider: "AIRBNB", label: "Airbnb", supported: true },
  { provider: "BOOKING", label: "Booking.com", supported: true },
  { provider: "AGODA", label: "Agoda", supported: true },
  { provider: "EXPEDIA", label: "Expedia", supported: false },
  { provider: "VRBO", label: "Vrbo", supported: false },
] as const satisfies ReadonlyArray<{ provider: CalendarProviderType; label: string; supported: boolean }>;

export type RoomCalendarProvider = (typeof ROOM_CALENDAR_PROVIDER_CONFIG)[number]["provider"];
export type SupportedRoomCalendarProvider = Extract<(typeof ROOM_CALENDAR_PROVIDER_CONFIG)[number], { supported: true }>["provider"];
export const SUPPORTED_ROOM_CALENDAR_PROVIDERS = ROOM_CALENDAR_PROVIDER_CONFIG.filter((item): item is Extract<(typeof ROOM_CALENDAR_PROVIDER_CONFIG)[number], { supported: true }> => item.supported).map((item) => item.provider);

export type RoomCalendarDraftErrorCode = "UNTESTED" | "UNSUPPORTED" | "DUPLICATE";
export type RoomCalendarDraftResult =
  | { success: true; drafts: Array<{ provider: SupportedRoomCalendarProvider; calendarUrl: string }> }
  | { success: false; errors: Partial<Record<RoomCalendarProvider, { code: RoomCalendarDraftErrorCode; message: string }>> };

export function calendarUrlField(provider: RoomCalendarProvider) { return `calendarUrl_${provider}` as const; }
export function testedCalendarUrlField(provider: RoomCalendarProvider) { return `testedCalendarUrl_${provider}` as const; }

export function prepareRoomCalendarDrafts(inputs: Array<{ provider: RoomCalendarProvider; calendarUrl: string; testedCalendarUrl: string }>): RoomCalendarDraftResult {
  const errors: Partial<Record<RoomCalendarProvider, { code: RoomCalendarDraftErrorCode; message: string }>> = {};
  const drafts: Array<{ provider: SupportedRoomCalendarProvider; calendarUrl: string }> = [];
  const urls = new Set<string>();
  for (const input of inputs) {
    const calendarUrl = input.calendarUrl.trim();
    if (!calendarUrl) continue;
    if (!SUPPORTED_ROOM_CALENDAR_PROVIDERS.includes(input.provider as SupportedRoomCalendarProvider)) { errors[input.provider] = { code: "UNSUPPORTED", message: "이 Provider는 아직 연결 테스트를 지원하지 않습니다." }; continue; }
    if (input.testedCalendarUrl !== calendarUrl) { errors[input.provider] = { code: "UNTESTED", message: "URL 연결 테스트를 먼저 완료해 주세요." }; continue; }
    if (urls.has(calendarUrl)) { errors[input.provider] = { code: "DUPLICATE", message: "같은 iCal URL을 여러 Provider에 등록할 수 없습니다." }; continue; }
    urls.add(calendarUrl);
    drafts.push({ provider: input.provider as SupportedRoomCalendarProvider, calendarUrl });
  }
  return Object.keys(errors).length ? { success: false, errors } : { success: true, drafts };
}
