import type { CalendarProviderType } from "@/providers/calendar";
import type { ParsedCalendarEvent } from "../domain/calendar-event";
import type { NormalizedReservation } from "../domain/normalized-reservation";

export interface ReservationNormalizer { readonly provider: CalendarProviderType; normalize(event: ParsedCalendarEvent): NormalizedReservation | null }
export function mapIcsStatus(status: string | null): NormalizedReservation["status"] { switch (status?.toUpperCase()) { case "CONFIRMED": return "CONFIRMED"; case "CANCELLED": return "CANCELLED"; case "TENTATIVE": return "TENTATIVE"; default: return "UNKNOWN"; } }
export function normalizeCommon(event: ParsedCalendarEvent): NormalizedReservation { return { rawUid: event.uid, providerReservationId: event.uid, guestName: null, startDate: event.startDate, endDate: event.endDate, status: mapIcsStatus(event.status), summary: event.summary, description: event.description, providerCreatedAt: event.createdAt, providerUpdatedAt: event.lastModifiedAt }; }
