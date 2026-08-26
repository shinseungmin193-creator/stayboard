import type { ExistingReservation, NormalizedReservation } from "./normalized-reservation";

const nullableDateEqual = (left: Date | null, right: Date | null) => left?.getTime() === right?.getTime();
export function reservationFieldsEqual(left: ExistingReservation, right: NormalizedReservation): boolean { return left.providerReservationId === right.providerReservationId && left.guestName === right.guestName && left.startDate.getTime() === right.startDate.getTime() && left.endDate.getTime() === right.endDate.getTime() && left.status === right.status && left.summary === right.summary && left.description === right.description && nullableDateEqual(left.providerCreatedAt, right.providerCreatedAt) && nullableDateEqual(left.providerUpdatedAt, right.providerUpdatedAt); }
export interface ReservationClassification { create: NormalizedReservation[]; update: Array<{ id: string; reservation: NormalizedReservation }>; unchanged: ExistingReservation[]; missingDeletionIds: string[] }
export interface MissingReservationReconciliation {
  observedUids: ReadonlySet<string>;
  blockedUids: ReadonlySet<string>;
  fullyParsed: boolean;
}
export function classifyReservations(existing: ExistingReservation[], incoming: NormalizedReservation[], reconciliation?: MissingReservationReconciliation): ReservationClassification {
  const existingByUid = new Map(existing.map((reservation) => [reservation.rawUid, reservation])); const incomingByUid = new Map<string, NormalizedReservation>(); incoming.forEach((reservation) => { if (!incomingByUid.has(reservation.rawUid)) incomingByUid.set(reservation.rawUid, reservation); });
  const result: ReservationClassification = { create: [], update: [], unchanged: [], missingDeletionIds: [] };
  incomingByUid.forEach((reservation, uid) => {
    const current = existingByUid.get(uid);
    if (!current) {
      if (reservation.status !== "CANCELLED") result.create.push(reservation);
    } else if (reservationFieldsEqual(current, reservation)) result.unchanged.push(current);
    else result.update.push({ id: current.id, reservation });
  });
  if (reconciliation?.fullyParsed) {
    for (const reservation of existing) {
      if (incomingByUid.has(reservation.rawUid)) continue;
      // A fully parsed feed that explicitly classifies a previously persisted
      // reservation UID as BLOCKED is authoritative: it is not a reservation.
      // UNKNOWN remains observed-but-preserved so uncertain provider data never
      // deletes an existing reservation.
      if (reconciliation.blockedUids.has(reservation.rawUid)) {
        result.missingDeletionIds.push(reservation.id);
        continue;
      }
      if (reconciliation.observedUids.has(reservation.rawUid)) continue;
      result.missingDeletionIds.push(reservation.id);
    }
  }
  return result;
}
