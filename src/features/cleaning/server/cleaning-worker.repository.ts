import "server-only";

import {
  canAccessCompany,
  companyScopeIds,
  hasPermission,
  PERMISSIONS,
  PermissionDeniedError,
  withAccessAuditMetadata,
  type AccessContext,
} from "@/features/access-control";
import { prisma } from "@/lib/prisma";
import {
  getCleaningWorkerNormalizedName,
  normalizeCleaningWorkerDisplayName,
} from "../domain/cleaning-worker";

export async function listCleaningWorkers(
  context: AccessContext,
  options: { includeInactive?: boolean } = {},
) {
  if (!hasPermission(context.role, PERMISSIONS.CLEANING_WORKER_READ)) throw new PermissionDeniedError();
  const companyIds = companyScopeIds(context);
  const canManage = hasPermission(context.role, PERMISSIONS.CLEANING_WORKER_MANAGE);
  return prisma.cleaningWorker.findMany({
    where: {
      ...(companyIds ? { companyId: { in: [...companyIds] } } : {}),
      ...(options.includeInactive && canManage ? {} : { isActive: true }),
      company: { isActive: true },
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      isActive: true,
      company: { select: { name: true } },
    },
    orderBy: [{ company: { name: "asc" } }, { isActive: "desc" }, { name: "asc" }, { id: "asc" }],
  }).then((workers) => workers.map(({ company, ...worker }) => ({
    ...worker,
    companyName: company.name,
  })));
}

export async function createCleaningWorker(
  context: AccessContext,
  input: { companyId: string; name: string },
) {
  if (
    !hasPermission(context.role, PERMISSIONS.CLEANING_WORKER_CREATE)
    || !canAccessCompany(context, input.companyId)
  ) throw new PermissionDeniedError();
  const name = normalizeCleaningWorkerDisplayName(input.name);
  return prisma.$transaction(async (tx) => {
    const worker = await tx.cleaningWorker.create({
      data: {
        companyId: input.companyId,
        name,
        normalizedName: getCleaningWorkerNormalizedName(name),
      },
      select: { id: true, companyId: true, name: true, isActive: true, company: { select: { name: true } } },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: input.companyId,
        action: "CLEANING_WORKER_CREATED",
        details: withAccessAuditMetadata(context, { cleaningWorkerId: worker.id, name }),
      },
    });
    return { id: worker.id, companyId: worker.companyId, companyName: worker.company.name, name: worker.name, isActive: worker.isActive };
  });
}

export async function updateCleaningWorker(
  context: AccessContext,
  input: { id: string; companyId: string; previousName: string; name: string },
) {
  const name = normalizeCleaningWorkerDisplayName(input.name);
  return prisma.$transaction(async (tx) => {
    const worker = await tx.cleaningWorker.update({
      where: { id: input.id },
      data: { name, normalizedName: getCleaningWorkerNormalizedName(name) },
      select: { id: true, companyId: true, name: true, isActive: true, company: { select: { name: true } } },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: input.companyId,
        action: "CLEANING_WORKER_UPDATED",
        details: withAccessAuditMetadata(context, {
          cleaningWorkerId: worker.id,
          before: { name: input.previousName },
          after: { name },
        }),
      },
    });
    return { id: worker.id, companyId: worker.companyId, companyName: worker.company.name, name: worker.name, isActive: worker.isActive };
  });
}

export async function setCleaningWorkerActive(
  context: AccessContext,
  input: { id: string; companyId: string; name: string; previousActive: boolean; isActive: boolean },
) {
  return prisma.$transaction(async (tx) => {
    const worker = await tx.cleaningWorker.update({
      where: { id: input.id },
      data: { isActive: input.isActive },
      select: { id: true, companyId: true, name: true, isActive: true, company: { select: { name: true } } },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: input.companyId,
        action: input.isActive ? "CLEANING_WORKER_ACTIVATED" : "CLEANING_WORKER_DEACTIVATED",
        details: withAccessAuditMetadata(context, {
          cleaningWorkerId: worker.id,
          name: input.name,
          before: { isActive: input.previousActive },
          after: { isActive: input.isActive },
        }),
      },
    });
    return { id: worker.id, companyId: worker.companyId, companyName: worker.company.name, name: worker.name, isActive: worker.isActive };
  });
}

export function findCleaningWorker(context: AccessContext, id: string) {
  if (!hasPermission(context.role, PERMISSIONS.CLEANING_WORKER_MANAGE)) throw new PermissionDeniedError();
  const companyIds = companyScopeIds(context);
  return prisma.cleaningWorker.findFirst({
    where: {
      id,
      ...(companyIds ? { companyId: { in: [...companyIds] } } : {}),
      company: { isActive: true },
    },
    select: { id: true, companyId: true, name: true, isActive: true, company: { select: { name: true } } },
  });
}
