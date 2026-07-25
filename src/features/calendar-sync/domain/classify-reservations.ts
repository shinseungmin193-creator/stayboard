import type { ExistingReservation, NormalizedReservation } from "./normalized-reservation";

const nullableDateEqual = (left: Date | null, right: Date | null) => left?.getTime() === right?.getTime();
export function reservationFieldsEqual(left: ExistingReservation, right: NormalizedReservation): boolean { return left.providerReservationId === right.providerReservationId && left.guestName === right.guestName && left.startDate.getTime() === right.startDate.getTime() && left.endDate.getTime() === right.endDate.getTime() && left.status === right.status && left.summary === right.summary && left.description === right.description && nullableDateEqual(left.providerCreatedAt, right.providerCreatedAt) && nullableDateEqual(left.providerUpdatedAt, right.providerUpdatedAt); }
export interface ReservationClassification { create: NormalizedReservation[]; update: Array<{ id: string; reservation: NormalizedReservation }>; unchanged: ExistingReservation[]; cancelIds: string[] }
export interface ReservationClassificationOptions {
  blockedUids?: ReadonlySet<string>;
  protectedUids?: ReadonlySet<string>;
  allowMissingCancellation?: boolean;
}
export function shouldProtectEmptyCalendar(fetchedEventCount: number, activeExistingCount: number): boolean { return fetchedEventCount === 0 && activeExistingCount > 0; }
export function classifyReservations(existing: ExistingReservation[], incoming: NormalizedReservation[], syncStartedAt: Date, options: ReservationClassificationOptions = {}): ReservationClassification {
  const existingByUid = new Map(existing.map((reservation) => [reservation.rawUid, reservation])); const incomingByUid = new Map<string, NormalizedReservation>(); incoming.forEach((reservation) => { if (!incomingByUid.has(reservation.rawUid)) incomingByUid.set(reservation.rawUid, reservation); });
  const result: ReservationClassification = { create: [], update: [], unchanged: [], cancelIds: [] };
  incomingByUid.forEach((reservation, uid) => {
    const current = existingByUid.get(uid);
    if (!current) {
      if (reservation.status !== "CANCELLED") result.create.push(reservation);
    } else if (reservationFieldsEqual(current, reservation)) result.unchanged.push(current);
    else result.update.push({ id: current.id, reservation });
  });
  existing.forEach((reservation) => {
    if (reservation.createdAt > syncStartedAt || incomingByUid.has(reservation.rawUid) || reservation.status === "CANCELLED") return;
    if (options.protectedUids?.has(reservation.rawUid)) return;
    if (options.blockedUids?.has(reservation.rawUid) || options.allowMissingCancellation !== false) result.cancelIds.push(reservation.id);
  });
  return result;
}
