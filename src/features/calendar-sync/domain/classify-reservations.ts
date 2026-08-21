import type { ExistingReservation, NormalizedReservation } from "./normalized-reservation";

const nullableDateEqual = (left: Date | null, right: Date | null) => left?.getTime() === right?.getTime();
export function reservationFieldsEqual(left: ExistingReservation, right: NormalizedReservation): boolean { return left.providerReservationId === right.providerReservationId && left.guestName === right.guestName && left.startDate.getTime() === right.startDate.getTime() && left.endDate.getTime() === right.endDate.getTime() && left.status === right.status && left.summary === right.summary && left.description === right.description && nullableDateEqual(left.providerCreatedAt, right.providerCreatedAt) && nullableDateEqual(left.providerUpdatedAt, right.providerUpdatedAt); }
export interface ReservationClassification { create: NormalizedReservation[]; update: Array<{ id: string; reservation: NormalizedReservation }>; unchanged: ExistingReservation[]; staleCancellationIds: string[] }
export interface MissingReservationReconciliation {
  observedUids: ReadonlySet<string>;
  now: Date;
  fullyParsed: boolean;
}
function isConflictEligible(reservation: Pick<NormalizedReservation, "startDate" | "endDate" | "status">): boolean {
  return (reservation.status === "CONFIRMED" || reservation.status === "TENTATIVE")
    && Number.isFinite(reservation.startDate.getTime())
    && Number.isFinite(reservation.endDate.getTime())
    && reservation.startDate < reservation.endDate;
}
function overlaps(left: Pick<NormalizedReservation, "startDate" | "endDate">, right: Pick<NormalizedReservation, "startDate" | "endDate">): boolean {
  return left.startDate < right.endDate && left.endDate > right.startDate;
}
export function classifyReservations(existing: ExistingReservation[], incoming: NormalizedReservation[], reconciliation?: MissingReservationReconciliation): ReservationClassification {
  const existingByUid = new Map(existing.map((reservation) => [reservation.rawUid, reservation])); const incomingByUid = new Map<string, NormalizedReservation>(); incoming.forEach((reservation) => { if (!incomingByUid.has(reservation.rawUid)) incomingByUid.set(reservation.rawUid, reservation); });
  const result: ReservationClassification = { create: [], update: [], unchanged: [], staleCancellationIds: [] };
  incomingByUid.forEach((reservation, uid) => {
    const current = existingByUid.get(uid);
    if (!current) {
      if (reservation.status !== "CANCELLED") result.create.push(reservation);
    } else if (reservationFieldsEqual(current, reservation)) result.unchanged.push(current);
    else result.update.push({ id: current.id, reservation });
  });
  if (reconciliation?.fullyParsed && incomingByUid.size > 0) {
    const activeIncoming = [...incomingByUid.values()].filter(isConflictEligible);
    for (const reservation of existing) {
      if (!isConflictEligible(reservation) || reservation.endDate <= reconciliation.now) continue;
      if (incomingByUid.has(reservation.rawUid) || reconciliation.observedUids.has(reservation.rawUid)) continue;
      if (activeIncoming.some((candidate) => overlaps(reservation, candidate))) result.staleCancellationIds.push(reservation.id);
    }
  }
  return result;
}
