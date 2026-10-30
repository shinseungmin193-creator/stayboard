import "server-only";

import { canAccessCompany, canAccessRoom, PermissionDeniedError, withAccessAuditMetadata, type AccessContext } from "@/features/access-control";
import { getCleaningPhotoStorage } from "@/features/cleaning/storage/local-file-storage-provider";
import type { InsuranceClaimType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export class InsuranceClaimServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsuranceClaimServiceError";
  }
}

export async function createInsuranceClaim(context: AccessContext, input: { propertyId: string; roomId: string; content: string; types: InsuranceClaimType[] }) {
  const room = await prisma.room.findUnique({
    where: { id: input.roomId },
    select: { id: true, propertyId: true, isActive: true, property: { select: { companyId: true, isActive: true, company: { select: { isActive: true } } } } },
  });
  if (!room || room.propertyId !== input.propertyId) throw new InsuranceClaimServiceError("선택한 객실을 찾을 수 없습니다.");
  if (!canAccessCompany(context, room.property.companyId) || !canAccessRoom(context, room)) throw new PermissionDeniedError();
  if (!room.isActive || !room.property.isActive || !room.property.company.isActive) throw new InsuranceClaimServiceError("활성 객실만 보고할 수 있습니다.");
  const reporterName = context.name?.trim();
  if (!reporterName) throw new InsuranceClaimServiceError("보고자 정보를 확인할 수 없습니다.");

  return prisma.$transaction(async (tx) => {
    const claim = await tx.insuranceClaim.create({
      data: {
        companyId: room.property.companyId,
        propertyId: room.propertyId,
        roomId: room.id,
        reporterUserId: context.userId,
        reporterName,
        content: input.content.trim(),
        types: input.types,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: room.property.companyId,
        action: "INSURANCE_CLAIM_REPORTED",
        details: withAccessAuditMetadata(context, { insuranceClaimId: claim.id, propertyId: room.propertyId, roomId: room.id, types: input.types }),
      },
    });
    return claim;
  });
}

export async function submitInsuranceClaim(context: AccessContext, claimId: string, types: InsuranceClaimType[]) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`insurance-claim:${claimId}`}))`;
    const current = await tx.insuranceClaim.findUnique({ where: { id: claimId }, select: { id: true, companyId: true, propertyId: true, roomId: true, status: true } });
    if (!current) throw new InsuranceClaimServiceError("보험/보상 보고를 찾을 수 없습니다.");
    if (!canAccessCompany(context, current.companyId) || !canAccessRoom(context, current)) throw new PermissionDeniedError();
    if (current.status === "SUBMITTED") throw new InsuranceClaimServiceError("이미 신청 완료된 보고입니다.");
    if (current.status === "PAID") throw new InsuranceClaimServiceError("이미 지급 완료된 보고입니다.");
    const now = new Date();
    const updated = await tx.insuranceClaim.updateMany({
      where: { id: claimId, status: "REPORTED" },
      data: { status: "SUBMITTED", types, submittedAt: now, submittedByUserId: context.userId, submittedByName: context.name?.trim() || "-" },
    });
    if (updated.count !== 1) throw new InsuranceClaimServiceError("상태가 변경되어 신청 완료할 수 없습니다.");
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: current.companyId,
        action: "INSURANCE_CLAIM_SUBMITTED",
        details: withAccessAuditMetadata(context, { insuranceClaimId: claimId, propertyId: current.propertyId, roomId: current.roomId, types }),
      },
    });
    return { id: claimId, status: "SUBMITTED" as const, submittedAt: now.toISOString(), submittedByName: context.name?.trim() || "-", types };
  });
}

export async function completeInsurancePayout(context: AccessContext, claimId: string, paidAmount: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`insurance-claim:${claimId}`}))`;
    const current = await tx.insuranceClaim.findUnique({
      where: { id: claimId },
      select: { id: true, companyId: true, propertyId: true, roomId: true, status: true },
    });
    if (!current) throw new InsuranceClaimServiceError("보험/보상 보고를 찾을 수 없습니다.");
    if (!canAccessCompany(context, current.companyId) || !canAccessRoom(context, current)) throw new PermissionDeniedError();
    if (current.status === "PAID") throw new InsuranceClaimServiceError("이미 지급 완료된 보고입니다.");
    if (current.status !== "SUBMITTED") throw new InsuranceClaimServiceError("신청 완료 후 지급 완료 처리할 수 있습니다.");

    const now = new Date();
    const paidByName = context.name?.trim() || "-";
    const updated = await tx.insuranceClaim.updateMany({
      where: { id: claimId, status: "SUBMITTED" },
      data: {
        status: "PAID",
        paidAmount,
        paidAt: now,
        paidByUserId: context.userId,
        paidByName,
      },
    });
    if (updated.count !== 1) throw new InsuranceClaimServiceError("상태가 변경되어 지급 완료할 수 없습니다.");
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: current.companyId,
        action: "INSURANCE_CLAIM_PAID",
        details: withAccessAuditMetadata(context, {
          insuranceClaimId: claimId,
          propertyId: current.propertyId,
          roomId: current.roomId,
          paidAmount,
          currency: "JPY",
        }),
      },
    });
    return {
      id: claimId,
      status: "PAID" as const,
      paidAmount,
      paidAt: now.toISOString(),
      paidByName,
    };
  });
}

export async function deleteProcessedInsuranceClaim(context: AccessContext, claimId: string) {
  const deleted = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`insurance-claim:${claimId}`}))`;
    const current = await tx.insuranceClaim.findUnique({
      where: { id: claimId },
      select: {
        id: true,
        companyId: true,
        propertyId: true,
        roomId: true,
        status: true,
        photos: { select: { storageKey: true } },
      },
    });
    if (!current) throw new InsuranceClaimServiceError("보험/보상 보고를 찾을 수 없습니다.");
    if (!canAccessCompany(context, current.companyId) || !canAccessRoom(context, current)) throw new PermissionDeniedError();
    if (current.status !== "SUBMITTED" && current.status !== "PAID") throw new InsuranceClaimServiceError("신청 완료 또는 지급 완료된 보고만 삭제할 수 있습니다.");

    const removed = await tx.insuranceClaim.deleteMany({ where: { id: claimId, status: { in: ["SUBMITTED", "PAID"] } } });
    if (removed.count !== 1) throw new InsuranceClaimServiceError("상태가 변경되어 삭제할 수 없습니다.");
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: current.companyId,
        action: "INSURANCE_CLAIM_DELETED",
        details: withAccessAuditMetadata(context, {
          insuranceClaimId: claimId,
          propertyId: current.propertyId,
          roomId: current.roomId,
          previousStatus: current.status,
          photoCount: current.photos.length,
        }),
      },
    });
    return { id: claimId, storageKeys: current.photos.map((photo) => photo.storageKey) };
  });

  const storage = getCleaningPhotoStorage();
  await Promise.allSettled(deleted.storageKeys.map((storageKey) => storage.delete(storageKey)));
  return { id: deleted.id };
}

