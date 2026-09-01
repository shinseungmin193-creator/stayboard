import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { findCalendarSourceSyncStates } from "@/features/calendar-sources/calendar-source.repository";
import type { RoomListItem } from "./room.types";
import type { RoomRegistrationInput } from "./create-room-registration";
import type { RoomOperationalStatus } from "@/lib/generated/prisma/enums";
import type { RoomWithCalendarSourcesAtomicInput } from "./update-room-with-calendar-sources";
import { formatRoomDisplayName } from "./room-display";
import { CALENDAR_SYNC_STALE_RUNNING_MS } from "@/features/calendar-sync/calendar-sync.constants";
import type { NormalizedRoomListing } from "./room-listing";

type RoomWriteInput = { propertyId: string; name: string; capacity: number };
const internalRoomCode = () => `room_${randomUUID()}`;
const summarizeSyncError = (value: string | null | undefined) => value
  ? value.replace(/https?:\/\/\S+/gi, "[URL 숨김]").slice(0, 180)
  : null;

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
    for (const listing of input.listingUpdates) {
      const updated = await tx.roomListing.updateMany({
        where: { id: listing.id, roomId: input.room.id, provider: listing.provider },
        data: {
          listingUrl: listing.listingUrl,
          externalListingId: listing.externalListingId,
          isActive: true,
        },
      });
      if (updated.count !== 1) throw new Error("ROOM_LISTING_WRITE_CONFLICT");
    }
    for (const listing of input.listingDeactivations) {
      const updated = await tx.roomListing.updateMany({
        where: { id: listing.id, roomId: input.room.id, isActive: true },
        data: { isActive: false },
      });
      if (updated.count !== 1) throw new Error("ROOM_LISTING_WRITE_CONFLICT");
    }
    if (input.listingCreates.length) {
      await tx.roomListing.createMany({
        data: input.listingCreates.map((listing) => ({ ...listing, roomId: input.room.id, isActive: true })),
      });
    }
    return { id: input.room.id };
  });
}
export function roomExists(id: string) { return prisma.room.findUnique({ where: { id }, select: { id: true, isActive: true, property: { select: { companyId: true } } } }); }
export function setRoomActive(id: string, isActive: boolean) { return prisma.room.update({ where: { id }, data: { isActive }, select: { id: true, isActive: true } }); }
export function findRoomForOperationalStatus(id: string) { return prisma.room.findUnique({ where: { id }, select: { id: true, property: { select: { companyId: true } } } }); }
export function updateRoomOperationalStatusRecord(id: string, operationalStatus: RoomOperationalStatus, operationalStatusUpdatedAt: Date) { return prisma.room.update({ where: { id }, data: { operationalStatus, operationalStatusUpdatedAt }, select: { id: true, operationalStatus: true, operationalStatusUpdatedAt: true } }); }
