import type { CalendarProviderType, ReservationStatus } from "@/lib/generated/prisma/enums";
import {
  doReservationDateRangesOverlap,
  getReservationDateOrdinal,
  getReservationDateOverlap,
  isValidReservationDateRange,
} from "../../reservations/reservation-date";

export interface ConflictCandidate {
  id: string;
  roomId: string;
  startDate: Date;
  endDate: Date;
  status: ReservationStatus;
}

export interface ReservationConflictPair {
  reservationAId: string;
  reservationBId: string;
  roomId: string;
  overlapStart: Date;
  overlapEnd: Date;
}

export interface StoredConflictReservation extends ConflictCandidate {
  guestName: string | null;
  provider: CalendarProviderType;
}

export interface StoredReservationConflict {
  id: string;
  reservationA: StoredConflictReservation;
  reservationB: StoredConflictReservation;
}

export interface ReservationConflictPeer {
  conflictId: string;
  reservationId: string;
  guestName: string | null;
  provider: CalendarProviderType;
  startDate: Date;
  endDate: Date;
}

export function isValidReservationRange(reservation: Pick<ConflictCandidate, "startDate" | "endDate">): boolean {
  return isValidReservationDateRange(reservation);
}

export function isConflictEligibleReservation(reservation: Pick<ConflictCandidate, "status" | "startDate" | "endDate">): boolean {
  return (reservation.status === "CONFIRMED" || reservation.status === "TENTATIVE") && isValidReservationRange(reservation);
}

export function doReservationRangesOverlap(left: ConflictCandidate, right: ConflictCandidate): boolean {
  return left.id !== right.id && left.roomId === right.roomId && isConflictEligibleReservation(left) && isConflictEligibleReservation(right) && doReservationDateRangesOverlap(left, right);
}

export function isCurrentReservationConflict(conflict: StoredReservationConflict): boolean {
  return doReservationRangesOverlap(conflict.reservationA, conflict.reservationB);
}

export function getReservationConflictPeers(
  reservationId: string,
  conflicts: readonly StoredReservationConflict[],
): ReservationConflictPeer[] {
  const peers = new Map<string, ReservationConflictPeer>();
  for (const conflict of conflicts) {
    if (!isCurrentReservationConflict(conflict)) continue;
    const peer = conflict.reservationA.id === reservationId
      ? conflict.reservationB
      : conflict.reservationB.id === reservationId
        ? conflict.reservationA
        : null;
    if (!peer) continue;
    peers.set(peer.id, {
      conflictId: conflict.id,
      reservationId: peer.id,
      guestName: peer.guestName,
      provider: peer.provider,
      startDate: peer.startDate,
      endDate: peer.endDate,
    });
  }
  return [...peers.values()].sort((left, right) => left.startDate.getTime() - right.startDate.getTime() || left.reservationId.localeCompare(right.reservationId));
}

export function normalizeConflictPair(leftId: string, rightId: string): [string, string] {
  return leftId <= rightId ? [leftId, rightId] : [rightId, leftId];
}

export function calculateOverlapRange(left: ConflictCandidate, right: ConflictCandidate): Pick<ReservationConflictPair, "overlapStart" | "overlapEnd"> | null {
  if (!doReservationRangesOverlap(left, right)) return null;
  return getReservationDateOverlap(left, right);
}

export function findReservationConflictPairs(reservations: ConflictCandidate[]): ReservationConflictPair[] {
  const sorted = reservations.filter(isConflictEligibleReservation).sort((left, right) => (getReservationDateOrdinal(left.startDate) ?? 0) - (getReservationDateOrdinal(right.startDate) ?? 0) || (getReservationDateOrdinal(left.endDate) ?? 0) - (getReservationDateOrdinal(right.endDate) ?? 0) || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const active: ConflictCandidate[] = [];
  const pairs: ReservationConflictPair[] = [];
  for (const target of sorted) {
    let write = 0;
    const targetStart = getReservationDateOrdinal(target.startDate);
    for (const candidate of active) {
      const candidateEnd = getReservationDateOrdinal(candidate.endDate);
      if (targetStart !== null && candidateEnd !== null && candidateEnd > targetStart) active[write++] = candidate;
    }
    active.length = write;
    for (const candidate of active) {
      const overlap = calculateOverlapRange(candidate, target);
      if (!overlap) continue;
      const [reservationAId, reservationBId] = normalizeConflictPair(candidate.id, target.id);
      pairs.push({ reservationAId, reservationBId, roomId: target.roomId, ...overlap });
    }
    active.push(target);
  }
  return pairs;
}

export const conflictPairKey = (reservationAId: string, reservationBId: string) => `${reservationAId}\u0000${reservationBId}`;
