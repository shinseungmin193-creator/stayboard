import "server-only";
import type { SyncExecutionMode } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export function createSyncRun(input: { roomId: string; actorUserId: string | null; executionMode: SyncExecutionMode; targetCount: number; startedAt: Date }) {
  return prisma.syncRun.create({ data: { ...input, status: "RUNNING" }, select: { id: true } });
}

export function finishSyncRun(id: string, input: { successCount: number; failedCount: number; errorSummary: string | null; finishedAt: Date }) {
  const status = input.failedCount === 0 ? "SUCCESS" : input.successCount === 0 ? "FAILED" : "FAILED";
  return prisma.syncRun.update({ where: { id }, data: { ...input, status } });
}
