export interface ParsedCalendarEvent { uid: string; startDate: Date; endDate: Date; summary: string | null; status: string | null; description: string | null; createdAt: Date | null; lastModifiedAt: Date | null }
export interface CalendarParseIssue { eventIndex: number; reason: "MISSING_UID" | "MISSING_START" | "MISSING_END" | "INVALID_DATE" | "INVALID_RANGE" }
export interface CalendarParseResult { totalEventCount: number; events: ParsedCalendarEvent[]; excludedCount: number; issues: CalendarParseIssue[] }
