import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { classifyConflicts } from "../domain/classify-conflicts";
import { findReservationConflictPairs } from "../domain/reservation-conflict";
import type { ConflictRecalculationResult } from "../domain/conflict-result";
import { ACTIVE_OTA_RESERVATION_STATUSES } from "@/features/reservations/reservation.constants";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";
import { getReservationConflictTodayStart } from "../domain/reservation-conflict-dismissal";

export async function detectRoomReservationConflicts(tx: Prisma.TransactionClient, roomId: string): Promise<ConflictRecalculationResult> {
  const [reservations, existing] = await Promise.all([
    tx.reservation.findMany({ where: { roomId, calendarSource: { is: { isActive: true } }, status: { in: [...ACTIVE_OTA_RESERVATION_STATUSES] }, provider: { in: [...CALENDAR_PROVIDER_TYPES] } }, select: { id: true, roomId: true, startDate: true, endDate: true, status: true }, orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { id: "asc" }] }),
    tx.reservationConflict.findMany({ where: { roomId }, select: { id: true, roomId: true, reservationAId: true, reservationBId: true, status: true, overlapStart: true, overlapEnd: true } }),
  ]);
  const detected = findReservationConflictPairs(reservations);
  const now = new Date();
  const classification = classifyConflicts(existing, detected, { dismissedReactivationBoundary: getReservationConflictTodayStart(now) });
  if (classification.create.length) await tx.reservationConflict.createMany({ data: classification.create.map((pair) => ({ ...pair, detectedAt: now, lastDetectedAt: now })) });
  const touchIds = classification.refresh.filter((item) => !item.reactivate && !item.overlapChanged).map((item) => item.id);
  if (touchIds.length) await tx.reservationConflict.updateMany({ where: { id: { in: touchIds }, status: "ACTIVE" }, data: { lastDetectedAt: now } });
  for (const item of classification.refresh.filter((entry) => entry.reactivate || entry.overlapChanged)) await tx.reservationConflict.update({ where: { id: item.id }, data: { status: "ACTIVE", overlapStart: item.pair.overlapStart, overlapEnd: item.pair.overlapEnd, lastDetectedAt: now, resolvedAt: null } });
  if (classification.resolveIds.length) await tx.reservationConflict.updateMany({ where: { id: { in: classification.resolveIds }, status: "ACTIVE" }, data: { status: "RESOLVED", resolvedAt: now } });
  return { activeConflictCount: classification.create.length + classification.refresh.length, createdConflictCount: classification.create.length, resolvedConflictCount: classification.resolveIds.length };
}
