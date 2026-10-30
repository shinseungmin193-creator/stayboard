import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";

export interface RoomRelatedDataDeleteCounts {
  reservationCount: number;
  calendarSourceCount: number;
  syncHistoryCount: number;
  conflictCount: number;
  cleaningTaskCount: number;
  cleaningPhotoCount: number;
  roomNoteCount: number;
  roomListingCount: number;
  reviewDataCount: number;
  accessAssignmentCount: number;
}

export interface RoomRelatedDataDeleteResult {
  counts: RoomRelatedDataDeleteCounts;
  photoStorageKeys: string[];
}

export async function deleteRoomRelatedData(
  tx: Prisma.TransactionClient,
  input: {
    roomIds: readonly string[];
    calendarSourceIds: readonly string[];
    roomListingIds: readonly string[];
  },
): Promise<RoomRelatedDataDeleteResult> {
  const reservations = await tx.reservation.findMany({
    where: {
      OR: [
        { roomId: { in: [...input.roomIds] } },
        ...(input.calendarSourceIds.length
          ? [{ calendarSourceId: { in: [...input.calendarSourceIds] } }]
          : []),
      ],
    },
    select: { id: true },
  });
  const reservationIds = reservations.map((reservation) => reservation.id);
  const cleaningTasks = await tx.cleaningTask.findMany({
    where: {
      OR: [
        { roomId: { in: [...input.roomIds] } },
        ...(reservationIds.length ? [{ reservationId: { in: reservationIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const cleaningTaskIds = cleaningTasks.map((task) => task.id);
  const photos = cleaningTaskIds.length
    ? await tx.cleaningPhoto.findMany({
        where: { taskId: { in: cleaningTaskIds }, storageKey: { not: null } },
        select: { storageKey: true },
      })
    : [];
  const roomNotePhotos = await tx.roomNotePhoto.findMany({
    where: { roomNote: { roomId: { in: [...input.roomIds] } } },
    select: { storageKey: true },
  });
  const insuranceClaimPhotos = await tx.insuranceClaimPhoto.findMany({
    where: { claim: { roomId: { in: [...input.roomIds] } } },
    select: { storageKey: true },
  });
  const photoStorageKeys = [
    ...photos.flatMap((photo) => photo.storageKey ? [photo.storageKey] : []),
    ...roomNotePhotos.map((photo) => photo.storageKey),
    ...insuranceClaimPhotos.map((photo) => photo.storageKey),
  ];

  const [reviewSnapshotCount, listingReviewCount, reviewSyncLogCount] = input.roomListingIds.length
    ? await Promise.all([
        tx.reviewSnapshot.count({ where: { roomListingId: { in: [...input.roomListingIds] } } }),
        tx.listingReview.count({ where: { roomListingId: { in: [...input.roomListingIds] } } }),
        tx.reviewSyncLog.count({ where: { roomListingId: { in: [...input.roomListingIds] } } }),
      ])
    : [0, 0, 0];

  const staffAssignments = await tx.staffAssignment.deleteMany({
    where: { roomId: { in: [...input.roomIds] } },
  });
  const roomNotes = await tx.roomNote.deleteMany({
    where: {
      OR: [
        { roomId: { in: [...input.roomIds] } },
        ...(cleaningTaskIds.length ? [{ cleaningTaskId: { in: cleaningTaskIds } }] : []),
      ],
    },
  });
  await tx.insuranceClaim.deleteMany({ where: { roomId: { in: [...input.roomIds] } } });
  if (cleaningTaskIds.length) {
    await tx.cleaningTaskLog.deleteMany({ where: { taskId: { in: cleaningTaskIds } } });
  }
  const cleaningPhotos = cleaningTaskIds.length
    ? await tx.cleaningPhoto.deleteMany({ where: { taskId: { in: cleaningTaskIds } } })
    : { count: 0 };
  const deletedCleaningTasks = cleaningTaskIds.length
    ? await tx.cleaningTask.deleteMany({ where: { id: { in: cleaningTaskIds } } })
    : { count: 0 };

  const conflictFilters: Prisma.ReservationConflictWhereInput[] = [
    { roomId: { in: [...input.roomIds] } },
  ];
  if (reservationIds.length) {
    conflictFilters.push(
      { reservationAId: { in: reservationIds } },
      { reservationBId: { in: reservationIds } },
    );
  }
  const conflicts = await tx.reservationConflict.deleteMany({ where: { OR: conflictFilters } });
  const deletedReservations = reservationIds.length
    ? await tx.reservation.deleteMany({ where: { id: { in: reservationIds } } })
    : { count: 0 };
  const syncLogs = input.calendarSourceIds.length
    ? await tx.syncLog.deleteMany({ where: { calendarSourceId: { in: [...input.calendarSourceIds] } } })
    : { count: 0 };
  const syncRuns = await tx.syncRun.deleteMany({ where: { roomId: { in: [...input.roomIds] } } });
  const calendarSources = input.calendarSourceIds.length
    ? await tx.calendarSource.deleteMany({ where: { id: { in: [...input.calendarSourceIds] } } })
    : { count: 0 };
  const roomListings = input.roomListingIds.length
    ? await tx.roomListing.deleteMany({ where: { id: { in: [...input.roomListingIds] } } })
    : { count: 0 };

  return {
    counts: {
      reservationCount: deletedReservations.count,
      calendarSourceCount: calendarSources.count,
      syncHistoryCount: syncLogs.count + syncRuns.count,
      conflictCount: conflicts.count,
      cleaningTaskCount: deletedCleaningTasks.count,
      cleaningPhotoCount: cleaningPhotos.count,
      roomNoteCount: roomNotes.count,
      roomListingCount: roomListings.count,
      reviewDataCount: reviewSnapshotCount + listingReviewCount + reviewSyncLogCount,
      accessAssignmentCount: staffAssignments.count,
    },
    photoStorageKeys,
  };
}

