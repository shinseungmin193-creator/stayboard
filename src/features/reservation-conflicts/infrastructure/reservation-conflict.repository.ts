import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { classifyConflicts } from "../domain/classify-conflicts";
import { findReservationConflictPairs } from "../domain/reservation-conflict";
import type { ConflictRecalculationResult } from "../domain/conflict-result";
import { buildOperationalReservationWhere } from "@/features/reservations/operational-reservation-where";
import { getReservationConflictTodayStart } from "../domain/reservation-conflict-dismissal";

export async function detectRoomReservationConflicts(tx: Prisma.TransactionClient, roomId: string): Promise<ConflictRecalculationResult> {
  const [reservations, existing] = await Promise.all([
    tx.reservation.findMany({ where: { ...buildOperationalReservationWhere(), roomId }, select: { id: true, roomId: true, startDate: true, endDate: true, status: true }, orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { id: "asc" }] }),
    tx.reservationConflict.findMany({ where: { roomId }, select: { id: true, roomId: true, reservationAId: true, reservationBId: true, status: true, overlapStart: true, overlapEnd: true } }),
  ]);
  const detected = findReservationConflictPairs(reservations);
  const now = new Date();
  const classification = classifyConflicts(existing, detected, { dismissedReactivationBoundary: getReservationConflictTodayStart(now) });
  if (classification.create.length) await tx.reservationConflict.createMany({ data: classification.create.map((pair) => ({ ...pair, detectedAt: now, lastDetectedAt: now })) });
  const touchIds = classification.refresh.filter((item) => !item.reactivate && !item.overlapChanged).map((item) => item.id);
  if (touchIds.length) await tx.reservationConflict.updateMany({ where: { id: { in: touchIds }, status: "ACTIVE" }, data: { lastDetectedAt: now } });
  const changed = classification.refresh.filter((entry) => entry.reactivate || entry.overlapChanged);
  if (changed.length) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "ReservationConflict" AS conflict
      SET
        status = 'ACTIVE'::"ReservationConflictStatus",
        "overlapStart" = incoming."overlapStart",
        "overlapEnd" = incoming."overlapEnd",
        "lastDetectedAt" = ${now},
        "resolvedAt" = NULL,
        "updatedAt" = NOW()
      FROM (
        VALUES ${Prisma.join(changed.map((item) => Prisma.sql`(
          ${item.id}::text,
          ${item.pair.overlapStart}::timestamp(3),
          ${item.pair.overlapEnd}::timestamp(3)
        )`))}
      ) AS incoming(id, "overlapStart", "overlapEnd")
      WHERE conflict.id = incoming.id
    `);
  }
  if (classification.resolveIds.length) await tx.reservationConflict.updateMany({ where: { id: { in: classification.resolveIds }, status: "ACTIVE" }, data: { status: "RESOLVED", resolvedAt: now } });
  return { activeConflictCount: classification.create.length + classification.refresh.length, createdConflictCount: classification.create.length, resolvedConflictCount: classification.resolveIds.length };
}
