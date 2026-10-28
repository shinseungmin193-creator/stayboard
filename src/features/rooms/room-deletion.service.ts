import "server-only";

import type { AccessContext } from "@/features/access-control";
import { withAccessAuditMetadata } from "@/features/access-control";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  AdvisoryLockUnavailableError,
  withPostgresAdvisoryLocks,
} from "@/lib/postgres-advisory-lock";
import { prisma } from "@/lib/prisma";
import { isRoomDeletionConfirmationValid } from "./domain/room-deletion";
import {
  countRoomDeleteImpact,
  deleteRoomTransaction,
  findRoomDeleteTarget,
  RoomDeletionRepositoryError,
} from "./room.repository";
import {
  deleteCleaningPhotoFiles,
  roomRelatedOperationLockKeys,
} from "./room-deletion-runtime";
import type { RoomDeleteTarget } from "./room.types";

export type RoomDeletionServiceErrorCode =
  | "NOT_FOUND"
  | "SCOPE_CHANGED"
  | "CONFIRMATION_MISMATCH"
  | "RELATED_OPERATION_IN_PROGRESS";

export class RoomDeletionServiceError extends Error {
  constructor(readonly code: RoomDeletionServiceErrorCode, message: string) {
    super(message);
    this.name = "RoomDeletionServiceError";
  }
}

export async function getRoomDeleteTarget(id: string) {
  const target = await findRoomDeleteTarget(id);
  if (!target) throw new RoomDeletionServiceError("NOT_FOUND", "삭제할 객실을 찾을 수 없습니다.");
  return target;
}

export function getRoomDeleteImpact(id: string) {
  return countRoomDeleteImpact(id);
}

export async function deleteRoomSafely(input: {
  target: RoomDeleteTarget;
  confirmationText: string;
  context: AccessContext;
}) {
  if (!isRoomDeletionConfirmationValid(input.confirmationText, input.target.name)) {
    throw new RoomDeletionServiceError("CONFIRMATION_MISMATCH", "객실명이 일치하지 않습니다.");
  }
  try {
    const lockKeys = roomRelatedOperationLockKeys({
      scopeKey: `room-delete:${input.target.id}`,
      roomIds: [input.target.id],
      calendarSourceIds: input.target.calendarSourceIds,
      roomListingIds: input.target.roomListingIds,
    });
    return await withPostgresAdvisoryLocks(lockKeys, async () => {
      const deleted = await deleteRoomTransaction({
        target: input.target,
        actorUserId: input.context.userId,
        confirmationText: input.confirmationText,
        auditMetadata: withAccessAuditMetadata(input.context, {}) as Prisma.InputJsonObject,
      });
      const failedPhotoFileCount = await deleteCleaningPhotoFiles(deleted.photoStorageKeys);
      if (failedPhotoFileCount > 0) {
        await prisma.auditLog.create({
          data: {
            actorUserId: input.context.userId,
            targetCompanyId: input.target.companyId,
            action: "ROOM_PHOTO_FILE_CLEANUP_FAILED",
            details: withAccessAuditMetadata(input.context, {
              roomId: input.target.id,
              roomName: input.target.name,
              propertyId: input.target.propertyId,
              failedPhotoFileCount,
            }) as Prisma.InputJsonObject,
          },
        });
      }
      return {
        ...deleted.result,
        deletedPhotoFileCount: deleted.photoStorageKeys.length - failedPhotoFileCount,
        failedPhotoFileCount,
      };
    });
  } catch (error) {
    if (error instanceof AdvisoryLockUnavailableError) {
      throw new RoomDeletionServiceError(
        "RELATED_OPERATION_IN_PROGRESS",
        "관련 캘린더 동기화 또는 리뷰 수집이 진행 중입니다.",
      );
    }
    if (error instanceof RoomDeletionRepositoryError) {
      if (error.code === "NOT_FOUND") {
        throw new RoomDeletionServiceError("NOT_FOUND", "삭제할 객실을 찾을 수 없습니다.");
      }
      if (error.code === "CONFIRMATION_MISMATCH") {
        throw new RoomDeletionServiceError("CONFIRMATION_MISMATCH", "객실명이 일치하지 않습니다.");
      }
      throw new RoomDeletionServiceError(
        "SCOPE_CHANGED",
        "삭제 대상의 관련 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
      );
    }
    throw error;
  }
}

