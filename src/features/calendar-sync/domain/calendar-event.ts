export type CalendarEventClassification = "RESERVATION" | "BLOCKED" | "CANCELLED" | "UNKNOWN";

export interface ParsedCalendarEvent {
  uid: string;
  startDate: Date;
  endDate: Date;
  summary: string | null;
  status: string | null;
  description: string | null;
  createdAt: Date | null;
  lastModifiedAt: Date | null;
  sequence: number;
  dtstamp: Date | null;
  rawProperties: Readonly<Record<string, string | null>>;
}
export interface CalendarParseIssue { eventIndex: number; reason: "MISSING_UID" | "UID_TOO_LONG" | "MISSING_START" | "MISSING_END" | "INVALID_DATE" | "INVALID_RANGE" | "SUMMARY_TOO_LONG" | "DESCRIPTION_TOO_LONG" | "DUPLICATE_UID" }
export interface CalendarParseResult { totalEventCount: number; events: ParsedCalendarEvent[]; excludedCount: number; issues: CalendarParseIssue[] }
