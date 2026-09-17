import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  automaticSyncDueBefore,
  readAutomaticCalendarSyncOptions,
} from "../domain/automatic-sync-policy";

test("자동 동기화는 기본 활성화되고 stale 기준 시각을 계산한다", () => {
  const options = readAutomaticCalendarSyncOptions({});
  assert.equal(options.enabled, true);
  assert.equal(options.intervalMs, 5 * 60 * 1000);
  assert.equal(options.staleAfterMs, 15 * 60 * 1000);
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

test("Next.js Node instrumentation이 자동 동기화 스케줄러를 한 번 시작한다", () => {
  const instrumentation = readFileSync("src/instrumentation.ts", "utf8");
  const scheduler = readFileSync("src/features/calendar-sync/application/automatic-calendar-sync.ts", "utf8");
  const repository = readFileSync("src/features/calendar-sync/infrastructure/automatic-sync.repository.ts", "utf8");
  assert.match(instrumentation, /NEXT_RUNTIME !== "nodejs"/);
  assert.match(instrumentation, /startAutomaticCalendarSyncScheduler/);
  assert.match(scheduler, /executionMode|"AUTO"/);
  assert.match(scheduler, /Symbol\.for\("stayboard\.calendar-auto-sync-scheduler"\)/);
  assert.match(repository, /lastSyncedAt: \{ lt: input\.dueBefore \}/);
  assert.match(repository, /take: input\.limit/);
});
