import type { CalendarProviderType } from "@/lib/generated/prisma/enums";

export interface CalendarSourceListItem { id: string; roomId: string; roomName: string; propertyId: string; propertyName: string; provider: CalendarProviderType; name: string; maskedUrl: string; isActive: boolean; lastSyncedAt: Date | null }
export interface CalendarRoomOption { id: string; name: string; propertyId: string; propertyName: string; isActive: boolean; propertyIsActive: boolean }
export interface CalendarSourceFilters { propertyId?: string; roomId?: string; provider?: CalendarProviderType; isActive?: boolean }
export interface CalendarConnectionResult { provider: string; responseTimeMs: number; fetchedAt: string; contentType: string | null; eventCount: number; uidCount: number; startCount: number; endCount: number; summaryCount: number }
