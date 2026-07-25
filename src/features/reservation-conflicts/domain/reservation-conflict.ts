import type { ReservationStatus } from "@/lib/generated/prisma/enums";

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

export function isValidReservationRange(reservation: Pick<ConflictCandidate, "startDate" | "endDate">): boolean {
  return Number.isFinite(reservation.startDate.getTime()) && Number.isFinite(reservation.endDate.getTime()) && reservation.startDate < reservation.endDate;
}

export function isConflictEligibleReservation(reservation: Pick<ConflictCandidate, "status" | "startDate" | "endDate">): boolean {
  return (reservation.status === "CONFIRMED" || reservation.status === "TENTATIVE") && isValidReservationRange(reservation);
}

export function doReservationRangesOverlap(left: ConflictCandidate, right: ConflictCandidate): boolean {
  return left.id !== right.id && left.roomId === right.roomId && isConflictEligibleReservation(left) && isConflictEligibleReservation(right) && left.startDate < right.endDate && left.endDate > right.startDate;
}

export function normalizeConflictPair(leftId: string, rightId: string): [string, string] {
  return leftId <= rightId ? [leftId, rightId] : [rightId, leftId];
}

export function calculateOverlapRange(left: ConflictCandidate, right: ConflictCandidate): Pick<ReservationConflictPair, "overlapStart" | "overlapEnd"> | null {
  if (!doReservationRangesOverlap(left, right)) return null;
  return { overlapStart: new Date(Math.max(left.startDate.getTime(), right.startDate.getTime())), overlapEnd: new Date(Math.min(left.endDate.getTime(), right.endDate.getTime())) };
}

export function findReservationConflictPairs(reservations: ConflictCandidate[]): ReservationConflictPair[] {
  const sorted = reservations.filter(isConflictEligibleReservation).sort((left, right) => left.startDate.getTime() - right.startDate.getTime() || left.endDate.getTime() - right.endDate.getTime() || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const active: ConflictCandidate[] = [];
  const pairs: ReservationConflictPair[] = [];
  for (const target of sorted) {
    let write = 0;
    for (const candidate of active) if (candidate.endDate > target.startDate) active[write++] = candidate;
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
