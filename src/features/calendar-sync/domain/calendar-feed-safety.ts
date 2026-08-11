import type { ReservationStatus } from "@/lib/generated/prisma/enums";
import type { CalendarProviderType } from "@/providers/calendar";
import { conflictPairKey, findReservationConflictPairs, type ConflictCandidate } from "../../reservation-conflicts/domain/reservation-conflict";
import { getCalendarFeedSafetyThresholds } from "../calendar-feed-safety.constants";
import type { CalendarFeedFingerprint } from "./calendar-feed-fingerprint";
import type { CalendarEventClassificationCounts } from "./classify-calendar-events";
import type { NormalizedReservation } from "./normalized-reservation";

export const CALENDAR_FEED_QUARANTINE_REASONS = [
  "EMPTY_FEED_WITH_ACTIVE_RESERVATIONS",
  "MASS_RESERVATION_DISAPPEARANCE",
  "UID_NAMESPACE_DRIFT",
  "UNRECOGNIZED_EVENT_SPIKE",
  "SUSPICIOUS_RESERVATION_SPIKE",
  "MASS_CONFLICT_INTRODUCTION",
] as const;
export type CalendarFeedQuarantineReason = typeof CALENDAR_FEED_QUARANTINE_REASONS[number];

export function readCalendarFeedQuarantineReasons(value: unknown): CalendarFeedQuarantineReason[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(CALENDAR_FEED_QUARANTINE_REASONS);
  return [...new Set(value.filter((reason): reason is CalendarFeedQuarantineReason => typeof reason === "string" && allowed.has(reason)))];
}

export interface CalendarFeedSafetyReservation {
  id: string;
  rawUid: string;
  calendarSourceId: string;
  roomId: string;
  startDate: Date;
  endDate: Date;
  status: ReservationStatus;
}

export interface CalendarFeedBaselineCounts {
  fetchedCount: number;
  reservationCount: number;
  unknownCount: number;
}

export interface CalendarFeedSafetyDiagnostics {
  version: 1;
  reasonCodes: CalendarFeedQuarantineReason[];
  existingFutureReservationCount: number;
  missingFutureReservationCount: number;
  disappearanceRatio: number;
  unknownRatio: number;
  baselineUnknownRatio: number | null;
  baselineReservationCount: number | null;
  incomingReservationCount: number;
  newReservationCandidateCount: number;
  currentConflictCount: number;
  previewConflictCount: number;
  newConflictCount: number;
  providerIdentityRatio: number;
  baselineProviderIdentityRatio: number | null;
}

export function readCalendarFeedSafetyDiagnostics(value: unknown): CalendarFeedSafetyDiagnostics | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<CalendarFeedSafetyDiagnostics>;
  if (candidate.version !== 1) return null;
  const reasonCodes = readCalendarFeedQuarantineReasons(candidate.reasonCodes);
  const numericFields = [
    "existingFutureReservationCount", "missingFutureReservationCount", "disappearanceRatio", "unknownRatio",
    "incomingReservationCount", "newReservationCandidateCount", "currentConflictCount", "previewConflictCount",
    "newConflictCount", "providerIdentityRatio",
  ] as const;
  if (numericFields.some((field) => typeof candidate[field] !== "number" || !Number.isFinite(candidate[field]))) return null;
  if (candidate.baselineUnknownRatio !== null && (typeof candidate.baselineUnknownRatio !== "number" || !Number.isFinite(candidate.baselineUnknownRatio))) return null;
  if (candidate.baselineReservationCount !== null && (typeof candidate.baselineReservationCount !== "number" || !Number.isFinite(candidate.baselineReservationCount))) return null;
  if (candidate.baselineProviderIdentityRatio !== null && (typeof candidate.baselineProviderIdentityRatio !== "number" || !Number.isFinite(candidate.baselineProviderIdentityRatio))) return null;
  return { ...candidate, reasonCodes } as CalendarFeedSafetyDiagnostics;
}

export type CalendarFeedSafetyResult =
  | { status: "SAFE"; diagnostics: CalendarFeedSafetyDiagnostics }
  | { status: "QUARANTINED"; reasonCodes: CalendarFeedQuarantineReason[]; diagnostics: CalendarFeedSafetyDiagnostics };

function ratio(value: number, total: number): number {
  return total > 0 ? Number((value / total).toFixed(4)) : 0;
}

function previewRoomReservations(input: {
  sourceId: string;
  sourceReservations: readonly CalendarFeedSafetyReservation[];
  roomReservations: readonly CalendarFeedSafetyReservation[];
  incomingReservations: readonly NormalizedReservation[];
}): ConflictCandidate[] {
  const incomingByUid = new Map(input.incomingReservations.map((reservation) => [reservation.rawUid, reservation]));
  const existingUids = new Set(input.sourceReservations.map((reservation) => reservation.rawUid));
  const otherSources = input.roomReservations.filter((reservation) => reservation.calendarSourceId !== input.sourceId);
  const updatedSource = input.sourceReservations.map((reservation) => {
    const incoming = incomingByUid.get(reservation.rawUid);
    return incoming ? { ...reservation, startDate: incoming.startDate, endDate: incoming.endDate, status: incoming.status } : reservation;
  });
  const createdSource = input.incomingReservations
    .filter((reservation) => !existingUids.has(reservation.rawUid) && reservation.status !== "CANCELLED")
    .map((reservation, index) => ({ id: `incoming-${index}`, rawUid: "", calendarSourceId: input.sourceId, roomId: input.sourceReservations[0]?.roomId ?? input.roomReservations[0]?.roomId ?? "", startDate: reservation.startDate, endDate: reservation.endDate, status: reservation.status }));
  return [...otherSources, ...updatedSource, ...createdSource];
}

function conflictKeys(reservations: readonly CalendarFeedSafetyReservation[] | readonly ConflictCandidate[]) {
  return new Set(findReservationConflictPairs([...reservations]).map((pair) => conflictPairKey(pair.reservationAId, pair.reservationBId)));
}

export function validateCalendarFeedTransition(input: {
  provider: CalendarProviderType;
  sourceId: string;
  now: Date;
  fetchedEventCount: number;
  counts: CalendarEventClassificationCounts;
  fingerprint: CalendarFeedFingerprint;
  baselineFingerprint: CalendarFeedFingerprint | null;
  previousSuccessfulCounts: CalendarFeedBaselineCounts | null;
  sourceReservations: readonly CalendarFeedSafetyReservation[];
  roomReservations: readonly CalendarFeedSafetyReservation[];
  incomingReservations: readonly NormalizedReservation[];
  baselineReset?: boolean;
}): CalendarFeedSafetyResult {
  const thresholds = getCalendarFeedSafetyThresholds(input.provider);
  const currentConflictKeys = conflictKeys(input.roomReservations);
  const previewConflictKeys = conflictKeys(previewRoomReservations(input));
  const newConflictCount = [...previewConflictKeys].filter((key) => !currentConflictKeys.has(key)).length;
  const futureReservations = input.sourceReservations.filter((reservation) => (reservation.status === "CONFIRMED" || reservation.status === "TENTATIVE") && reservation.endDate > input.now);
  const incomingUids = new Set(input.incomingReservations.map((reservation) => reservation.rawUid));
  const missingFutureReservationCount = futureReservations.filter((reservation) => !incomingUids.has(reservation.rawUid)).length;
  const disappearanceRatio = ratio(missingFutureReservationCount, futureReservations.length);
  const unknownRatio = ratio(input.counts.unknownEventCount, input.counts.parsedEventCount);
  const baselineCounts = input.baselineFingerprint ? {
    fetchedCount: input.baselineFingerprint.totalEventCount,
    reservationCount: input.baselineFingerprint.reservationCount,
    unknownCount: input.baselineFingerprint.unknownCount,
  } : input.previousSuccessfulCounts;
  const baselineUnknownRatio = baselineCounts ? ratio(baselineCounts.unknownCount, baselineCounts.fetchedCount) : null;
  const existingUids = new Set(input.sourceReservations.map((reservation) => reservation.rawUid));
  const newReservationCandidateCount = input.incomingReservations.filter((reservation) => reservation.status !== "CANCELLED" && !existingUids.has(reservation.rawUid)).length;
  const reasons: CalendarFeedQuarantineReason[] = [];

  if (thresholds.enabled) {
    if (input.fetchedEventCount === 0 && futureReservations.length > 0) reasons.push("EMPTY_FEED_WITH_ACTIVE_RESERVATIONS");
    if (!input.baselineReset && futureReservations.length >= thresholds.minimumExistingReservationsForDisappearance && disappearanceRatio >= thresholds.massDisappearanceRatio) reasons.push("MASS_RESERVATION_DISAPPEARANCE");

    const absoluteIdentityDrift = input.fetchedEventCount > 0 && input.fingerprint.providerIdentityRatio < thresholds.minimumProviderIdentityRatio;
    const baselineFingerprint = input.baselineFingerprint;
    const namespaceChanged = !input.baselineReset
      && Boolean(baselineFingerprint?.uidNamespaceFingerprint)
      && baselineFingerprint?.uidNamespaceFingerprint !== input.fingerprint.uidNamespaceFingerprint
      && (baselineFingerprint?.totalEventCount ?? 0) >= thresholds.minimumEventsForNamespaceComparison
      && input.fingerprint.totalEventCount >= thresholds.minimumEventsForNamespaceComparison;
    const corroboratedNamespaceDrift = namespaceChanged && (
      baselineFingerprint?.organizerDomainFingerprint !== input.fingerprint.organizerDomainFingerprint
      || baselineFingerprint?.prodIdFingerprint !== input.fingerprint.prodIdFingerprint
      || input.fingerprint.providerIdentityRatio < thresholds.minimumProviderIdentityRatio
    );
    if (absoluteIdentityDrift || corroboratedNamespaceDrift) reasons.push("UID_NAMESPACE_DRIFT");

    const unknownSpike = input.counts.parsedEventCount >= thresholds.minimumEventsForUnknownSpike
      && unknownRatio >= thresholds.maxUnknownRatio
      && (baselineUnknownRatio === null || baselineUnknownRatio < thresholds.maxUnknownRatio);
    if (unknownSpike) reasons.push("UNRECOGNIZED_EVENT_SPIKE");

    const baselineReservationCount = baselineCounts?.reservationCount ?? null;
    const reservationSpike = !input.baselineReset && baselineReservationCount !== null
      && newReservationCandidateCount >= thresholds.minimumReservationSpikeDelta
      && input.counts.reservationEventCount >= Math.max(1, baselineReservationCount) * thresholds.reservationSpikeMultiplier;
    if (reservationSpike) reasons.push("SUSPICIOUS_RESERVATION_SPIKE");

    const supportingAnomaly = reasons.length > 0 || newReservationCandidateCount >= thresholds.minimumNewReservationsForConflictSpike;
    if (newConflictCount >= thresholds.conflictSpikeThreshold && supportingAnomaly) reasons.push("MASS_CONFLICT_INTRODUCTION");
  }

  const diagnostics: CalendarFeedSafetyDiagnostics = {
    version: 1,
    reasonCodes: reasons,
    existingFutureReservationCount: futureReservations.length,
    missingFutureReservationCount,
    disappearanceRatio,
    unknownRatio,
    baselineUnknownRatio,
    baselineReservationCount: baselineCounts?.reservationCount ?? null,
    incomingReservationCount: input.counts.reservationEventCount,
    newReservationCandidateCount,
    currentConflictCount: currentConflictKeys.size,
    previewConflictCount: previewConflictKeys.size,
    newConflictCount,
    providerIdentityRatio: input.fingerprint.providerIdentityRatio,
    baselineProviderIdentityRatio: input.baselineFingerprint?.providerIdentityRatio ?? null,
  };
  return reasons.length ? { status: "QUARANTINED", reasonCodes: reasons, diagnostics } : { status: "SAFE", diagnostics };
}

export class CalendarFeedQuarantinedError extends Error {
  readonly code = "CALENDAR_FEED_QUARANTINED";
  readonly reasonCode: string;
  constructor(readonly result: Extract<CalendarFeedSafetyResult, { status: "QUARANTINED" }>, readonly fingerprint: CalendarFeedFingerprint) {
    super("Booking.com 캘린더의 내용이 이전 동기화와 크게 달라 자동 반영을 중지했습니다. Booking.com에서 최신 iCal URL을 확인해 주세요.");
    this.name = "CalendarFeedQuarantinedError";
    this.reasonCode = result.reasonCodes.join(",");
  }
}
