import "server-only";

import type { AccessContext } from "@/features/access-control";
import { withAccessAuditMetadata } from "@/features/access-control";
import { prisma } from "@/lib/prisma";
import type { ConflictScopeFilters } from "../reservation-conflict.types";
import { buildDismissibleReservationConflictWhere } from "./reservation-conflict-list.repository";

export function findReservationConflictDismissalTarget(conflictId: string) {
  return prisma.reservationConflict.findUnique({
    where: { id: conflictId },
    select: {
      id: true,
      roomId: true,
      reservationAId: true,
      reservationBId: true,
      status: true,
      overlapStart: true,
      overlapEnd: true,
    },
  });
}

export async function dismissReservationConflict(input: {
  target: NonNullable<Awaited<ReturnType<typeof findReservationConflictDismissalTarget>>>;
  todayStart: Date;
  context: AccessContext;
}) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.reservationConflict.updateMany({
      where: {
        id: input.target.id,
        status: "ACTIVE",
        overlapEnd: { lt: input.todayStart },
      },
      data: { status: "DISMISSED", resolvedAt: new Date() },
    });
    if (updated.count !== 1) return 0;
    await tx.auditLog.create({
      data: {
        actorUserId: input.context.userId,
        action: "RESERVATION_CONFLICT_DISMISSED",
        details: withAccessAuditMetadata(input.context, {
          conflictId: input.target.id,
          roomId: input.target.roomId,
          reservationAId: input.target.reservationAId,
          reservationBId: input.target.reservationBId,
          overlapStart: input.target.overlapStart.toISOString(),
          overlapEnd: input.target.overlapEnd.toISOString(),
          reservationDataPreserved: true,
        }),
      },
    });
    return 1;
  });
}

export async function dismissReservationConflictsInScope(input: {
  filters: ConflictScopeFilters;
  todayStart: Date;
  context: AccessContext;
}) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.reservationConflict.updateMany({
      where: buildDismissibleReservationConflictWhere(input.filters, input.todayStart),
      data: { status: "DISMISSED", resolvedAt: new Date() },
    });
    if (!updated.count) return 0;
    await tx.auditLog.create({
      data: {
        actorUserId: input.context.userId,
        action: "RESERVATION_CONFLICTS_BULK_DISMISSED",
        details: withAccessAuditMetadata(input.context, {
          count: updated.count,
          propertyId: input.filters.propertyId,
          roomId: input.filters.roomId,
          provider: input.filters.provider,
          from: input.filters.from.toISOString(),
          toExclusive: input.filters.toExclusive.toISOString(),
          reservationDataPreserved: true,
        }),
      },
    });
    return updated.count;
  });
}
