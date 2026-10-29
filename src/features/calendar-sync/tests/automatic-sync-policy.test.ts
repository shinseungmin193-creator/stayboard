import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  automaticSyncDueBefore,
  readAutomaticCalendarSyncOptions,
} from "../domain/automatic-sync-policy";
import { shouldRunAutomaticSyncInWeb } from "../domain/automatic-sync-runtime";
import { shouldRetainSuccessfulSyncDiagnostics } from "../domain/sync-log-retention";

const routineCounts = {
  parsedEventCount: 3,
  reservationEventCount: 3,
  blockedEventCount: 0,
  cancelledEventCount: 0,
  unknownEventCount: 0,
  failedEventCount: 0,
  skippedEventCount: 0,
};

test("자동 동기화는 기본 활성화되고 stale 기준 시각을 계산한다", () => {
  const options = readAutomaticCalendarSyncOptions({});
  assert.equal(options.enabled, true);
  assert.equal(options.intervalMs, 5 * 60 * 1000);
  assert.equal(options.staleAfterMs, 15 * 60 * 1000);
  assert.equal(options.batchSize, 50);
  assert.equal(
    automaticSyncDueBefore(new Date("2026-09-17T03:00:00.000Z"), options.staleAfterMs).toISOString(),
    "2026-09-17T02:45:00.000Z",
  );
});

test("자동 동기화 환경값은 명시적 비활성화와 안전한 양수만 허용한다", () => {
  const options = readAutomaticCalendarSyncOptions({
    CALENDAR_AUTO_SYNC_ENABLED: "false",
    CALENDAR_AUTO_SYNC_INTERVAL_MS: "60000",
    CALENDAR_AUTO_SYNC_STALE_AFTER_MS: "invalid",
    CALENDAR_AUTO_SYNC_BATCH_SIZE: "999999",
  });
  assert.equal(options.enabled, false);
  assert.equal(options.intervalMs, 60_000);
  assert.equal(options.staleAfterMs, 15 * 60 * 1000);
  assert.equal(options.batchSize, 5_000);
});

test("일상적인 성공 동기화는 중복 진단 JSON을 저장하지 않는다", () => {
  assert.equal(shouldRetainSuccessfulSyncDiagnostics(routineCounts, 0), false);
  assert.equal(shouldRetainSuccessfulSyncDiagnostics({ ...routineCounts, unknownEventCount: 1 }, 0), true);
  assert.equal(shouldRetainSuccessfulSyncDiagnostics(routineCounts, 1), true);
});

test("Next.js Node instrumentation이 자동 동기화 스케줄러를 한 번 시작한다", () => {
  const instrumentation = readFileSync("src/instrumentation.ts", "utf8");
  const nodeInstrumentation = readFileSync("src/instrumentation-node.ts", "utf8");
  const scheduler = readFileSync("src/features/calendar-sync/application/automatic-calendar-sync.ts", "utf8");
  const repository = readFileSync("src/features/calendar-sync/infrastructure/automatic-sync.repository.ts", "utf8");
  assert.match(instrumentation, /NEXT_RUNTIME === "nodejs"/);
  assert.match(instrumentation, /import\("\.\/instrumentation-node"\)/);
  assert.doesNotMatch(instrumentation, /@\/features\/calendar-sync/);
  assert.match(nodeInstrumentation, /startAutomaticCalendarSyncScheduler/);
  assert.match(scheduler, /executionMode|"AUTO"/);
  assert.match(scheduler, /Symbol\.for\("stayboard\.calendar-auto-sync-scheduler"\)/);
  assert.match(repository, /lastSyncedAt: \{ lt: input\.dueBefore \}/);
  assert.match(repository, /take: input\.limit/);
});

test("운영 배포는 자동 동기화를 웹 프로세스와 분리하고 다른 환경은 기존 동작을 유지한다", () => {
  assert.equal(shouldRunAutomaticSyncInWeb({}), true);
  assert.equal(shouldRunAutomaticSyncInWeb({ CALENDAR_AUTO_SYNC_RUNNER: "web" }), true);
  assert.equal(shouldRunAutomaticSyncInWeb({ CALENDAR_AUTO_SYNC_RUNNER: " EXTERNAL " }), false);

  const nodeInstrumentation = readFileSync("src/instrumentation-node.ts", "utf8");
  const worker = readFileSync("scripts/run-automatic-calendar-sync.ts", "utf8");
  const deployment = readFileSync("VPS 배포.bat", "utf8");
  assert.match(nodeInstrumentation, /shouldRunAutomaticSyncInWeb/);
  assert.match(worker, /runAutomaticCalendarSyncCycle/);
  assert.match(worker, /prisma\.\$disconnect\(\)/);
  assert.match(deployment, /CALENDAR_AUTO_SYNC_RUNNER=external/);
  assert.match(deployment, /flock -n \/var\/run\/stayboard-calendar-sync\.lock/);
  assert.match(deployment, /nice -n 10/);
});

test("동기화 이력 유지보수는 예약을 보존하고 최신 소스 로그를 남긴다", () => {
  const maintenance = readFileSync("scripts/maintain-calendar-sync-history.ts", "utf8");
  const deployment = readFileSync("VPS 배포.bat", "utf8");
  const migration = readFileSync("prisma/migrations/20261029083000_tune_sync_history_autovacuum/migration.sql", "utf8");
  assert.match(maintenance, /process\.argv\.includes\("--apply"\)/);
  assert.match(maintenance, /NOT EXISTS \([\s\S]*"Reservation" reservation[\s\S]*"createdBySyncLogId" = log\.id/);
  assert.match(maintenance, /EXISTS \([\s\S]*"SyncLog" newer[\s\S]*newer\."calendarSourceId" = log\."calendarSourceId"/);
  assert.match(maintenance, /log\."blockedEventCount" = 0/);
  assert.match(maintenance, /log\."cancelledEventCount" = 0/);
  assert.doesNotMatch(maintenance, /DELETE FROM "Reservation"/);
  assert.match(deployment, /maintain:sync-history -- --apply/);
  assert.match(migration, /ALTER TABLE "SyncLog" SET/);
  assert.match(migration, /autovacuum_vacuum_scale_factor = 0\.02/);
  assert.doesNotMatch(migration, /DELETE|DROP|TRUNCATE/);
});
