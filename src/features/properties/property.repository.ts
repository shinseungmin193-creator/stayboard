import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import type {
  PropertyDeleteImpact,
  PropertyDeleteResult,
  PropertyDeleteTarget,
  PropertyListItem,
  PropertyOption,
} from "./property.types";
import type { AccessScope } from "@/features/access-control";
import { propertyScopeWhere } from "@/features/access-control";
import { deleteRoomRelatedData } from "@/features/rooms/room-related-data-deletion";
import { isPropertyDeletionConfirmationValid } from "./domain/property-deletion";

export async function listProperties(companyIds?: readonly string[]): Promise<PropertyListItem[]> {
  const properties = await prisma.property.findMany({
    where: companyIds ? { companyId: { in: [...companyIds] } } : undefined,
    select: { id: true, companyId: true, name: true, address: true, timezone: true, isActive: true, company: { select: { name: true } }, rooms: { select: { isActive: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return properties.map(({ company, rooms, ...property }) => ({ ...property, companyName: company.name, totalRooms: rooms.length, activeRooms: rooms.filter((room) => room.isActive).length }));
}

export async function listPropertyOptions(companyIds?: readonly string[], accessScope?: AccessScope): Promise<PropertyOption[]> {
  return prisma.property.findMany({ where: { ...(propertyScopeWhere(accessScope) ?? {}), companyId: companyIds ? { in: [...companyIds] } : undefined }, select: { id: true, companyId: true, name: true, isActive: true }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
}

export function createProperty(data: { companyId: string; name: string; address: string; timezone: string }) { return prisma.property.create({ data, select: { id: true } }); }
export function updateProperty(id: string, data: { companyId: string; name: string; address: string; timezone: string }) { return prisma.property.update({ where: { id }, data, select: { id: true } }); }
export function setPropertyActive(id: string, isActive: boolean) { return prisma.property.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } }); }
export function propertyExists(id: string) { return prisma.property.findUnique({ where: { id }, select: { id: true, companyId: true, isActive: true } }); }

const propertyDeleteTargetSelect = {
  id: true,
  companyId: true,
  name: true,
  rooms: {
    select: {
      id: true,
      calendarSources: { select: { id: true } },
      listings: { select: { id: true } },
    },
  },
} as const satisfies Prisma.PropertySelect;

function toPropertyDeleteTarget(
  property: Prisma.PropertyGetPayload<{ select: typeof propertyDeleteTargetSelect }>,
): PropertyDeleteTarget {
  return {
    id: property.id,
    companyId: property.companyId,
    name: property.name,
    roomIds: property.rooms.map((room) => room.id),
    calendarSourceIds: property.rooms.flatMap((room) => room.calendarSources.map((source) => source.id)),
    roomListingIds: property.rooms.flatMap((room) => room.listings.map((listing) => listing.id)),
  };
}

export async function findPropertyDeleteTarget(id: string): Promise<PropertyDeleteTarget | null> {
  const property = await prisma.property.findUnique({ where: { id }, select: propertyDeleteTargetSelect });
  return property ? toPropertyDeleteTarget(property) : null;
}

export async function countPropertyDeleteImpact(propertyId: string): Promise<PropertyDeleteImpact> {
  const [
    roomCount,
    reservationCount,
    calendarSourceCount,
    syncLogCount,
    syncRunCount,
    conflictCount,
    cleaningTaskCount,
    cleaningPhotoCount,
    roomNoteCount,
    roomListingCount,
    reviewSnapshotCount,
    listingReviewCount,
    reviewSyncLogCount,
    propertyAccessCount,
    staffAssignmentCount,
  ] = await Promise.all([
    prisma.room.count({ where: { propertyId } }),
    prisma.reservation.count({ where: { propertyId } }),
    prisma.calendarSource.count({ where: { room: { propertyId } } }),
    prisma.syncLog.count({ where: { calendarSource: { room: { propertyId } } } }),
    prisma.syncRun.count({ where: { room: { propertyId } } }),
    prisma.reservationConflict.count({ where: { room: { propertyId } } }),
    prisma.cleaningTask.count({ where: { propertyId } }),
    prisma.cleaningPhoto.count({ where: { task: { propertyId } } }),
    prisma.roomNote.count({ where: { propertyId } }),
    prisma.roomListing.count({ where: { room: { propertyId } } }),
    prisma.reviewSnapshot.count({ where: { roomListing: { room: { propertyId } } } }),
    prisma.listingReview.count({ where: { roomListing: { room: { propertyId } } } }),
    prisma.reviewSyncLog.count({ where: { roomListing: { room: { propertyId } } } }),
    prisma.propertyAccess.count({ where: { propertyId } }),
    prisma.staffAssignment.count({ where: { OR: [{ propertyId }, { room: { propertyId } }] } }),
  ]);
  return {
    roomCount,
    reservationCount,
    calendarSourceCount,
    syncHistoryCount: syncLogCount + syncRunCount,
    conflictCount,
    cleaningTaskCount,
    cleaningPhotoCount,
    roomNoteCount,
    roomListingCount,
    reviewDataCount: reviewSnapshotCount + listingReviewCount + reviewSyncLogCount,
    accessAssignmentCount: propertyAccessCount + staffAssignmentCount,
  };
}

export type PropertyDeletionRepositoryErrorCode =
  | "NOT_FOUND"
  | "SCOPE_CHANGED"
  | "CONFIRMATION_MISMATCH";

export class PropertyDeletionRepositoryError extends Error {
  constructor(readonly code: PropertyDeletionRepositoryErrorCode) {
    super(code);
    this.name = "PropertyDeletionRepositoryError";
  }
}

function sameIds(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

interface PropertyDeleteTransactionResult {
  result: Omit<PropertyDeleteResult, "deletedPhotoFileCount" | "failedPhotoFileCount">;
  photoStorageKeys: string[];
}

export async function deletePropertyTransaction(input: {
  target: PropertyDeleteTarget;
  actorUserId: string;
  confirmationText: string;
  auditMetadata: Prisma.InputJsonObject;
}): Promise<PropertyDeleteTransactionResult> {
  return prisma.$transaction(async (tx) => {
    const currentProperty = await tx.property.findUnique({
      where: { id: input.target.id },
      select: propertyDeleteTargetSelect,
    });
    if (!currentProperty) throw new PropertyDeletionRepositoryError("NOT_FOUND");
    const currentTarget = toPropertyDeleteTarget(currentProperty);
    if (
      currentTarget.companyId !== input.target.companyId
      || currentTarget.name !== input.target.name
      || !sameIds(currentTarget.roomIds, input.target.roomIds)
      || !sameIds(currentTarget.calendarSourceIds, input.target.calendarSourceIds)
      || !sameIds(currentTarget.roomListingIds, input.target.roomListingIds)
    ) {
      throw new PropertyDeletionRepositoryError("SCOPE_CHANGED");
    }
    if (!isPropertyDeletionConfirmationValid(input.confirmationText, currentTarget.name)) {
      throw new PropertyDeletionRepositoryError("CONFIRMATION_MISMATCH");
    }

    const propertyAccesses = await tx.propertyAccess.deleteMany({ where: { propertyId: currentTarget.id } });
    const propertyStaffAssignments = await tx.staffAssignment.deleteMany({
      where: { propertyId: currentTarget.id },
    });
    const related = await deleteRoomRelatedData(tx, {
      roomIds: currentTarget.roomIds,
      calendarSourceIds: currentTarget.calendarSourceIds,
      roomListingIds: currentTarget.roomListingIds,
    });
    const rooms = currentTarget.roomIds.length
      ? await tx.room.deleteMany({ where: { id: { in: currentTarget.roomIds }, propertyId: currentTarget.id } })
      : { count: 0 };
    const deletedProperty = await tx.property.deleteMany({
      where: { id: currentTarget.id, companyId: currentTarget.companyId },
    });
    if (deletedProperty.count !== 1) throw new PropertyDeletionRepositoryError("SCOPE_CHANGED");

    const result = {
      propertyId: currentTarget.id,
      propertyName: currentTarget.name,
      roomCount: rooms.count,
      ...related.counts,
      accessAssignmentCount: propertyAccesses.count
        + propertyStaffAssignments.count
        + related.counts.accessAssignmentCount,
    };
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        targetCompanyId: currentTarget.companyId,
        action: "PROPERTY_DELETED",
        details: {
          ...input.auditMetadata,
          ...result,
          photoStorageFileCount: related.photoStorageKeys.length,
        },
      },
    });
    return { result, photoStorageKeys: related.photoStorageKeys };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 10_000,
    timeout: 60_000,
  });
}
