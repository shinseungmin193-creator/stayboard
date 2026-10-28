import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { findCalendarSourceSyncStates } from "@/features/calendar-sources/calendar-source.repository";
import type { RoomDeleteImpact, RoomDeleteResult, RoomDeleteTarget, RoomListItem } from "./room.types";
import type { RoomRegistrationInput } from "./create-room-registration";
import type { RoomOperationalStatus } from "@/lib/generated/prisma/enums";
import type { RoomWithCalendarSourcesAtomicInput } from "./update-room-with-calendar-sources";
import { formatRoomDisplayName } from "./room-display";
import { CALENDAR_SYNC_STALE_RUNNING_MS } from "@/features/calendar-sync/calendar-sync.constants";
import type { NormalizedRoomListing } from "./room-listing";
import { isRoomDeletionConfirmationValid } from "./domain/room-deletion";
import { deleteRoomRelatedData } from "./room-related-data-deletion";

type RoomWriteInput = { propertyId: string; name: string; capacity: number };
const internalRoomCode = () => `room_${randomUUID()}`;
const summarizeSyncError = (value: string | null | undefined) => value
  ? value.replace(/https?:\/\/\S+/gi, "[URL 숨김]").slice(0, 180)
  : null;

async function writeActiveRoomListing(
  tx: Prisma.TransactionClient,
  roomId: string,
  listing: NormalizedRoomListing & { id?: string },
) {
  if (listing.id) {
    const updated = await tx.roomListing.updateMany({
      where: { id: listing.id, roomId, provider: listing.provider },
      data: {
        listingUrl: listing.listingUrl,
        externalListingId: listing.externalListingId,
        isActive: true,
      },
    });
    if (updated.count !== 1) throw new Error("ROOM_LISTING_WRITE_CONFLICT");
    return { id: listing.id, provider: listing.provider };
  }

  return tx.roomListing.upsert({
    where: { roomId_provider: { roomId, provider: listing.provider } },
    create: { ...listing, roomId, isActive: true },
    update: {
      listingUrl: listing.listingUrl,
      externalListingId: listing.externalListingId,
      isActive: true,
    },
    select: { id: true, provider: true },
  });
}

export async function listRooms(propertyId?: string, companyIds?: readonly string[]): Promise<RoomListItem[]> {
  const rooms = await prisma.room.findMany({
    where: { propertyId, property: companyIds ? { companyId: { in: [...companyIds] } } : undefined },
    select: {
      id: true,
      propertyId: true,
      name: true,
      capacity: true,
      isActive: true,
      property: { select: { name: true, isActive: true } },
      calendarSources: {
        select: {
          id: true,
          provider: true,
          name: true,
          calendarUrl: true,
          isActive: true,
          lastSyncedAt: true,
        },
        orderBy: [{ provider: "asc" }, { name: "asc" }, { id: "asc" }],
      },
      listings: {
        where: { isActive: true, provider: { in: ["AIRBNB", "BOOKING", "AGODA"] } },
        select: { id: true, provider: true, listingUrl: true, isActive: true },
        orderBy: [{ provider: "asc" }, { id: "asc" }],
      },
      _count: { select: { calendarSources: true, listings: { where: { isActive: true } } } },
    },
    orderBy: [{ isActive: "desc" }, { property: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
  const syncStates = await findCalendarSourceSyncStates(rooms.flatMap((room) => room.calendarSources.map((source) => source.id)));
  const syncStateBySourceId = new Map(syncStates.map((state) => [state.sourceId, state]));
  const staleRunningCutoff = Date.now() - CALENDAR_SYNC_STALE_RUNNING_MS;
  return rooms.map(({ property, _count, calendarSources, listings, ...room }) => ({
    ...room,
    name: formatRoomDisplayName(room),
    propertyName: property.name,
    propertyIsActive: property.isActive,
    calendarSourceCount: _count.calendarSources,
    listingCount: _count.listings,
    listings: listings.map((listing) => ({ ...listing, provider: listing.provider as "AIRBNB" | "BOOKING" | "AGODA" })),
    calendarSources: calendarSources.map((source) => {
      const syncState = syncStateBySourceId.get(source.id);
      return {
        ...source,
        latestSyncStatus: syncState?.latestSyncStatus ?? null,
        latestSyncStartedAt: syncState?.latestSyncStartedAt ?? null,
        latestSyncCompletedAt: syncState?.latestSyncCompletedAt ?? null,
        latestFetchedCount: syncState?.latestFetchedCount ?? 0,
        latestErrorSummary: summarizeSyncError(syncState?.latestFailedErrorMessage ?? syncState?.latestErrorMessage),
        isSyncing: syncState?.latestSyncStatus === "RUNNING"
          && Boolean(syncState.latestSyncStartedAt && syncState.latestSyncStartedAt.getTime() >= staleRunningCutoff),
      };
    }),
  }));
}
export function createRoom(data: RoomWriteInput) {
  return prisma.$transaction(async (tx) => {
    const lastRoom = await tx.room.findFirst({ where: { propertyId: data.propertyId }, select: { sortOrder: true }, orderBy: { sortOrder: "desc" } });
    return tx.room.create({ data: { ...data, code: internalRoomCode(), sortOrder: (lastRoom?.sortOrder ?? -1) + 1 }, select: { id: true } });
  });
}
export function createRoomWithCalendarSources(
  room: RoomRegistrationInput["room"],
  calendars: RoomRegistrationInput["calendars"],
  listings: NormalizedRoomListing[],
) {
  return prisma.$transaction(async (tx) => {
    const lastRoom = await tx.room.findFirst({ where: { propertyId: room.propertyId }, select: { sortOrder: true }, orderBy: { sortOrder: "desc" } });
    const created = await tx.room.create({ data: { ...room, code: internalRoomCode(), sortOrder: (lastRoom?.sortOrder ?? -1) + 1 }, select: { id: true } });
    if (calendars.length) await tx.calendarSource.createMany({ data: calendars.map((calendar) => ({ roomId: created.id, provider: calendar.provider, name: calendar.name, calendarUrl: calendar.calendarUrl, isActive: true })) });
    if (listings.length) await tx.roomListing.createMany({ data: listings.map((listing) => ({ ...listing, roomId: created.id, isActive: true })) });
    return created;
  });
}
export function updateRoom(id: string, data: RoomWriteInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.room.findUniqueOrThrow({ where: { id }, select: { propertyId: true, code: true } });
    let code: string | undefined;
    if (current.propertyId !== data.propertyId) {
      const duplicate = await tx.room.findUnique({ where: { propertyId_code: { propertyId: data.propertyId, code: current.code } }, select: { id: true } });
      if (duplicate) code = internalRoomCode();
    }
    return tx.room.update({ where: { id }, data: { ...data, code }, select: { id: true } });
  });
}
export function findRoomWithCalendarSourcesForUpdate(id: string) {
  return prisma.room.findUnique({
    where: { id },
    select: {
      id: true,
      calendarSources: {
        select: { id: true, provider: true, name: true, calendarUrl: true, isActive: true },
        orderBy: [{ provider: "asc" }, { name: "asc" }, { id: "asc" }],
      },
      listings: {
        select: { id: true, provider: true, listingUrl: true, isActive: true },
        orderBy: [{ provider: "asc" }, { id: "asc" }],
      },
    },
  }).then((room) => room ? {
    id: room.id,
    sources: room.calendarSources,
    listings: room.listings.map((listing) => ({ ...listing, provider: listing.provider as "AIRBNB" | "BOOKING" | "AGODA" })),
  } : null);
}
export function updateRoomWithCalendarSourcesAtomically(input: RoomWithCalendarSourcesAtomicInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.room.findUniqueOrThrow({
      where: { id: input.room.id },
      select: { propertyId: true, code: true },
    });
    let code: string | undefined;
    if (current.propertyId !== input.room.propertyId) {
      const duplicate = await tx.room.findUnique({
        where: { propertyId_code: { propertyId: input.room.propertyId, code: current.code } },
        select: { id: true },
      });
      if (duplicate) code = internalRoomCode();
    }
    await tx.room.update({
      where: { id: input.room.id },
      data: {
        propertyId: input.room.propertyId,
        name: input.room.name,
        capacity: input.room.capacity,
        code,
      },
      select: { id: true },
    });
    for (const source of input.sourceUpdates) {
      const updated = await tx.calendarSource.updateMany({
        where: { id: source.id, roomId: input.room.id },
        data: {
          name: source.name,
          calendarUrl: source.calendarUrl,
          isActive: source.isActive,
        },
      });
      if (updated.count !== 1) throw new Error("CALENDAR_SOURCE_WRITE_CONFLICT");
    }
    if (input.sourceCreates.length) {
      await tx.calendarSource.createMany({
        data: input.sourceCreates.map((source) => ({ ...source, roomId: input.room.id })),
      });
    }
    for (const listing of input.listingUpdates) await writeActiveRoomListing(tx, input.room.id, listing);
    for (const listing of input.listingDeactivations) {
      const updated = await tx.roomListing.updateMany({
        where: { id: listing.id, roomId: input.room.id, isActive: true },
        data: { isActive: false },
      });
      if (updated.count !== 1) throw new Error("ROOM_LISTING_WRITE_CONFLICT");
    }
    for (const listing of input.listingCreates) await writeActiveRoomListing(tx, input.room.id, listing);
    return { id: input.room.id };
  });
}
export function saveRoomListing(roomId: string, listing: NormalizedRoomListing) {
  return prisma.$transaction((tx) => writeActiveRoomListing(tx, roomId, listing));
}
export function roomExists(id: string) { return prisma.room.findUnique({ where: { id }, select: { id: true, isActive: true, property: { select: { companyId: true } } } }); }
export function setRoomActive(id: string, isActive: boolean) { return prisma.room.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } }); }
export function findRoomForOperationalStatus(id: string) { return prisma.room.findUnique({ where: { id }, select: { id: true, property: { select: { companyId: true } } } }); }
export function updateRoomOperationalStatusRecord(id: string, operationalStatus: RoomOperationalStatus, operationalStatusUpdatedAt: Date) { return prisma.room.update({ where: { id }, data: { operationalStatus, operationalStatusUpdatedAt }, select: { id: true, operationalStatus: true, operationalStatusUpdatedAt: true } }); }

const roomDeleteTargetSelect = {
  id: true,
  propertyId: true,
  name: true,
  property: { select: { name: true, companyId: true } },
  calendarSources: { select: { id: true } },
  listings: { select: { id: true } },
} as const satisfies Prisma.RoomSelect;

function toRoomDeleteTarget(
  room: Prisma.RoomGetPayload<{ select: typeof roomDeleteTargetSelect }>,
): RoomDeleteTarget {
  return {
    id: room.id,
    propertyId: room.propertyId,
    propertyName: room.property.name,
    companyId: room.property.companyId,
    name: formatRoomDisplayName(room),
    calendarSourceIds: room.calendarSources.map((source) => source.id),
    roomListingIds: room.listings.map((listing) => listing.id),
  };
}

export async function findRoomDeleteTarget(id: string): Promise<RoomDeleteTarget | null> {
  const room = await prisma.room.findUnique({ where: { id }, select: roomDeleteTargetSelect });
  return room ? toRoomDeleteTarget(room) : null;
}

export async function countRoomDeleteImpact(roomId: string): Promise<RoomDeleteImpact> {
  const [
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
    accessAssignmentCount,
  ] = await Promise.all([
    prisma.reservation.count({ where: { roomId } }),
    prisma.calendarSource.count({ where: { roomId } }),
    prisma.syncLog.count({ where: { calendarSource: { roomId } } }),
    prisma.syncRun.count({ where: { roomId } }),
    prisma.reservationConflict.count({ where: { roomId } }),
    prisma.cleaningTask.count({ where: { roomId } }),
    prisma.cleaningPhoto.count({ where: { task: { roomId } } }),
    prisma.roomNote.count({ where: { roomId } }),
    prisma.roomListing.count({ where: { roomId } }),
    prisma.reviewSnapshot.count({ where: { roomListing: { roomId } } }),
    prisma.listingReview.count({ where: { roomListing: { roomId } } }),
    prisma.reviewSyncLog.count({ where: { roomListing: { roomId } } }),
    prisma.staffAssignment.count({ where: { roomId } }),
  ]);
  return {
    reservationCount,
    calendarSourceCount,
    syncHistoryCount: syncLogCount + syncRunCount,
    conflictCount,
    cleaningTaskCount,
    cleaningPhotoCount,
    roomNoteCount,
    roomListingCount,
    reviewDataCount: reviewSnapshotCount + listingReviewCount + reviewSyncLogCount,
    accessAssignmentCount,
  };
}

export type RoomDeletionRepositoryErrorCode = "NOT_FOUND" | "SCOPE_CHANGED" | "CONFIRMATION_MISMATCH";

export class RoomDeletionRepositoryError extends Error {
  constructor(readonly code: RoomDeletionRepositoryErrorCode) {
    super(code);
    this.name = "RoomDeletionRepositoryError";
  }
}

function sameIds(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

interface RoomDeleteTransactionResult {
  result: Omit<RoomDeleteResult, "deletedPhotoFileCount" | "failedPhotoFileCount">;
  photoStorageKeys: string[];
}

export async function deleteRoomTransaction(input: {
  target: RoomDeleteTarget;
  actorUserId: string;
  confirmationText: string;
  auditMetadata: Prisma.InputJsonObject;
}): Promise<RoomDeleteTransactionResult> {
  return prisma.$transaction(async (tx) => {
    const currentRoom = await tx.room.findUnique({
      where: { id: input.target.id },
      select: roomDeleteTargetSelect,
    });
    if (!currentRoom) throw new RoomDeletionRepositoryError("NOT_FOUND");
    const currentTarget = toRoomDeleteTarget(currentRoom);
    if (
      currentTarget.propertyId !== input.target.propertyId
      || currentTarget.companyId !== input.target.companyId
      || currentTarget.name !== input.target.name
      || !sameIds(currentTarget.calendarSourceIds, input.target.calendarSourceIds)
      || !sameIds(currentTarget.roomListingIds, input.target.roomListingIds)
    ) {
      throw new RoomDeletionRepositoryError("SCOPE_CHANGED");
    }
    if (!isRoomDeletionConfirmationValid(input.confirmationText, currentTarget.name)) {
      throw new RoomDeletionRepositoryError("CONFIRMATION_MISMATCH");
    }

    const related = await deleteRoomRelatedData(tx, {
      roomIds: [currentTarget.id],
      calendarSourceIds: currentTarget.calendarSourceIds,
      roomListingIds: currentTarget.roomListingIds,
    });
    const deletedRoom = await tx.room.deleteMany({
      where: { id: currentTarget.id, propertyId: currentTarget.propertyId },
    });
    if (deletedRoom.count !== 1) throw new RoomDeletionRepositoryError("SCOPE_CHANGED");

    const result = {
      roomId: currentTarget.id,
      roomName: currentTarget.name,
      propertyName: currentTarget.propertyName,
      ...related.counts,
    };
    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        targetCompanyId: currentTarget.companyId,
        action: "ROOM_DELETED",
        details: {
          ...input.auditMetadata,
          ...result,
          propertyId: currentTarget.propertyId,
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
