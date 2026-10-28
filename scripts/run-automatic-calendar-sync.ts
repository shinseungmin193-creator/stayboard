import { runAutomaticCalendarSyncCycle } from "../src/features/calendar-sync/application/automatic-calendar-sync";
import { summarizeError } from "../src/features/calendar-sync/domain/sync-error";
import { prisma } from "../src/lib/prisma";

async function main() {
  const startedAt = Date.now();
  const result = await runAutomaticCalendarSyncCycle();

  if (!result) {
    console.info("[calendar-sync.worker.idle]", { durationMs: Date.now() - startedAt });
    return;
  }

  console.info("[calendar-sync.worker.complete]", {
    durationMs: Date.now() - startedAt,
    targetCount: result.targetCount,
    successCount: result.successCount,
    warningCount: result.warningCount,
    failureCount: result.failureCount,
    skippedCount: result.skippedCount,
  });
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : "자동 동기화 작업 중 알 수 없는 오류가 발생했습니다.";
    console.error("[calendar-sync.worker.failed]", { reason: summarizeError(message) });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
