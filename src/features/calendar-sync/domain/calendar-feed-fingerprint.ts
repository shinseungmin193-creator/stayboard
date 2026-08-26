import { createHash } from "node:crypto";
import type { CalendarProviderType } from "@/providers/calendar";
import type { ParsedCalendarEvent } from "./calendar-event";
import type { CalendarEventClassificationCounts } from "./classify-calendar-events";
import { hasProviderDomain } from "../providers/event-classification";

export interface CalendarFeedFingerprint {
  version: 1;
  classificationVersion: number;
  provider: CalendarProviderType;
  calendarHostname: string;
  prodIdFingerprint: string | null;
  totalEventCount: number;
  parsedEventCount: number;
  reservationCount: number;
  blockedCount: number;
  cancelledCount: number;
  unknownCount: number;
  uidNamespaceFingerprint: string | null;
  organizerDomainFingerprint: string | null;
  structuralFingerprint: string;
  providerIdentityRatio: number;
}

const PROVIDER_DOMAINS: Record<CalendarProviderType, string> = {
  AIRBNB: "airbnb.com",
  BOOKING: "booking.com",
  AGODA: "agoda.com",
};

function digest(values: readonly string[]): string | null {
  if (!values.length) return null;
  return createHash("sha256").update([...new Set(values)].sort().join("\n")).digest("hex");
}

function lengthBucket(value: string): string {
  if (value.length <= 8) return "xs";
  if (value.length <= 16) return "sm";
  if (value.length <= 32) return "md";
  if (value.length <= 64) return "lg";
  return "xl";
}

function uidNamespaceSignature(uid: string): string {
  const normalized = uid.normalize("NFKC").trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  const local = at > 0 ? normalized.slice(0, at) : normalized;
  const domain = at > 0 ? normalized.slice(at + 1).replace(/[^a-z0-9.-].*$/, "") : "no-domain";
  const shape = local.replace(/[a-z]+/g, "a").replace(/\d+/g, "0").replace(/[^a0._-]+/g, "x").slice(0, 80);
  return `${domain}|${lengthBucket(local)}|${shape}`;
}

function organizerDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.toLowerCase().match(/@([a-z0-9.-]+)/)?.[1]?.replace(/\.+$/, "") ?? null;
}

function ratio(value: number, total: number): number {
  return total > 0 ? Number((value / total).toFixed(4)) : 0;
}

export function createCalendarFeedFingerprint(input: {
  provider: CalendarProviderType;
  classificationVersion?: number;
  calendarHostname: string;
  prodId: string | null;
  totalEventCount: number;
  events: readonly ParsedCalendarEvent[];
  counts: CalendarEventClassificationCounts;
}): CalendarFeedFingerprint {
  const providerDomain = PROVIDER_DOMAINS[input.provider];
  const uidSignatures = input.events.map((event) => uidNamespaceSignature(event.uid));
  const organizerDomains = input.events.map((event) => organizerDomain(event.rawProperties.organizer)).filter((value): value is string => Boolean(value));
  const providerIdentityCount = input.events.filter((event) => hasProviderDomain(event.uid, providerDomain) || hasProviderDomain(event.rawProperties.organizer ?? "", providerDomain)).length;
  const structuralSignatures = input.events.map((event) => [
    Object.keys(event.rawProperties).sort().join(","),
    event.summary ? "summary" : "no-summary",
    event.description ? "description" : "no-description",
    event.status ? "status" : "no-status",
    event.rawProperties.transp ? "transp" : "no-transp",
  ].join("|"));
  return {
    version: 1,
    classificationVersion: input.classificationVersion ?? 1,
    provider: input.provider,
    calendarHostname: input.calendarHostname.toLowerCase(),
    prodIdFingerprint: input.prodId ? digest([input.prodId.normalize("NFKC").trim().toLowerCase()]) : null,
    totalEventCount: input.totalEventCount,
    parsedEventCount: input.counts.parsedEventCount,
    reservationCount: input.counts.reservationEventCount,
    blockedCount: input.counts.blockedEventCount,
    cancelledCount: input.counts.cancelledEventCount,
    unknownCount: input.counts.unknownEventCount,
    uidNamespaceFingerprint: digest(uidSignatures),
    organizerDomainFingerprint: digest(organizerDomains),
    structuralFingerprint: digest(structuralSignatures) ?? createHash("sha256").update("empty-feed").digest("hex"),
    providerIdentityRatio: ratio(providerIdentityCount, input.events.length),
  };
}

export function readCalendarFeedFingerprint(value: unknown): CalendarFeedFingerprint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<CalendarFeedFingerprint>;
  if (candidate.version !== 1 || !["AIRBNB", "BOOKING", "AGODA"].includes(String(candidate.provider))) return null;
  if (typeof candidate.calendarHostname !== "string" || typeof candidate.structuralFingerprint !== "string") return null;
  for (const field of ["totalEventCount", "parsedEventCount", "reservationCount", "blockedCount", "cancelledCount", "unknownCount", "providerIdentityRatio"] as const) {
    if (typeof candidate[field] !== "number" || !Number.isFinite(candidate[field])) return null;
  }
  const classificationVersion = Number.isSafeInteger(candidate.classificationVersion) && Number(candidate.classificationVersion) > 0
    ? Number(candidate.classificationVersion)
    : 1;
  return { ...candidate, classificationVersion } as CalendarFeedFingerprint;
}
