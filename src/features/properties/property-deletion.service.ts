import "server-only";

import type { AccessContext } from "@/features/access-control";
import { withAccessAuditMetadata } from "@/features/access-control";
import {
  deleteCleaningPhotoFiles,
  roomRelatedOperationLockKeys,
} from "@/features/rooms/room-deletion-runtime";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  AdvisoryLockUnavailableError,
  withPostgresAdvisoryLocks,
} from "@/lib/postgres-advisory-lock";
import { prisma } from "@/lib/prisma";
import { isPropertyDeletionConfirmationValid } from "./domain/property-deletion";
import {
  countPropertyDeleteImpact,
  deletePropertyTransaction,
  findPropertyDeleteTarget,
  PropertyDeletionRepositoryError,
} from "./property.repository";
import type { PropertyDeleteTarget } from "./property.types";

export type PropertyDeletionServiceErrorCode =
  | "NOT_FOUND"
  | "SCOPE_CHANGED"
  | "CONFIRMATION_MISMATCH"
  | "RELATED_OPERATION_IN_PROGRESS";

export class PropertyDeletionServiceError extends Error {
  constructor(readonly code: PropertyDeletionServiceErrorCode, message: string) {
    super(message);
    this.name = "PropertyDeletionServiceError";
  }
}

export async function getPropertyDeleteTarget(id: string) {
  const target = await findPropertyDeleteTarget(id);
  if (!target) throw new PropertyDeletionServiceError("NOT_FOUND", "삭제할 숙소를 찾을 수 없습니다.");
  return target;
}

export function getPropertyDeleteImpact(id: string) {
  return countPropertyDeleteImpact(id);
}

export async function deletePropertySafely(input: {
  target: PropertyDeleteTarget;
  confirmationText: string;
  context: AccessContext;
}) {
  if (!isPropertyDeletionConfirmationValid(input.confirmationText, input.target.name)) {
    throw new PropertyDeletionServiceError("CONFIRMATION_MISMATCH", "숙소명이 일치하지 않습니다.");
  }
  try {
    const lockKeys = roomRelatedOperationLockKeys({
      scopeKey: `property-delete:${input.target.id}`,
      roomIds: input.target.roomIds,
      calendarSourceIds: input.target.calendarSourceIds,
      roomListingIds: input.target.roomListingIds,
    });
    return await withPostgresAdvisoryLocks(lockKeys, async () => {
      const deleted = await deletePropertyTransaction({
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
            action: "PROPERTY_PHOTO_FILE_CLEANUP_FAILED",
            details: withAccessAuditMetadata(input.context, {
              propertyId: input.target.id,
              propertyName: input.target.name,
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
      throw new PropertyDeletionServiceError(
        "RELATED_OPERATION_IN_PROGRESS",
        "관련 캘린더 동기화 또는 리뷰 수집이 진행 중입니다.",
      );
    }
    if (error instanceof PropertyDeletionRepositoryError) {
      if (error.code === "NOT_FOUND") {
        throw new PropertyDeletionServiceError("NOT_FOUND", "삭제할 숙소를 찾을 수 없습니다.");
      }
      if (error.code === "CONFIRMATION_MISMATCH") {
        throw new PropertyDeletionServiceError("CONFIRMATION_MISMATCH", "숙소명이 일치하지 않습니다.");
      }
      throw new PropertyDeletionServiceError(
        "SCOPE_CHANGED",
        "삭제 대상의 관련 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
      );
    }
    throw error;
  }
}

