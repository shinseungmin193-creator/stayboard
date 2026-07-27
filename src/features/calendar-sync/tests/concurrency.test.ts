import test from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrency } from "../../../lib/concurrency";
import { chunkItems, summarizeBulkSync } from "../domain/bulk-sync-summary";

test("67개 객실 중 활성 연결이 27개면 연결 없음 40개를 집계한다", () => {
  const targetRoomIds = Array.from({ length: 67 }, (_, index) => `room-${index + 1}`);
  const sources = targetRoomIds.slice(0, 27).map((roomId) => ({ roomId }));
  const summary = summarizeBulkSync({ targetRoomIds, sources, outcomes: Array.from({ length: 27 }, () => "SUCCESS" as const) });
  assert.deepEqual(summary, { targetRoomCount: 67, activeSourceCount: 27, roomsWithoutActiveSources: 40, successCount: 27, failureCount: 0, skippedCount: 0 });
});

test("모든 활성 연결은 성공, 실패, 건너뜀 중 하나로 집계한다", () => {
  const summary = summarizeBulkSync({ targetRoomIds: ["a", "b", "c"], sources: [{ roomId: "a" }, { roomId: "b" }, { roomId: "c" }, { roomId: "c" }], outcomes: ["SUCCESS", "FAILED", "SKIPPED", "SUCCESS"] });
  assert.equal(summary.activeSourceCount, summary.successCount + summary.failureCount + summary.skippedCount);
});

test("주의 결과는 성공 결과 안에서 별도로 집계할 수 있다", () => {
  const results = [
    { outcome: "SUCCESS", warning: true },
    { outcome: "SUCCESS", warning: false },
    { outcome: "FAILED", warning: false },
  ] as const;
  assert.equal(results.filter((result) => result.outcome === "SUCCESS").length, 2);
  assert.equal(results.filter((result) => result.warning).length, 1);
});

test("대상 객실을 고정 크기 batch로 끝까지 나눈다", () => {
  const batches = chunkItems(Array.from({ length: 67 }, (_, index) => index), 25);
  assert.deepEqual(batches.map((batch) => batch.length), [25, 25, 17]);
  assert.deepEqual(batches.flat(), Array.from({ length: 67 }, (_, index) => index));
});
test("worker pool은 최대 동시성과 결과 순서를 보존한다",async()=>{ let active=0; let maximum=0; const result=await mapWithConcurrency([1,2,3,4,5],2,async(value)=>{active+=1;maximum=Math.max(maximum,active);await new Promise((resolve)=>setTimeout(resolve,5));active-=1;return value*2;});assert.equal(maximum,2);assert.deepEqual(result,[2,4,6,8,10]); });
test("worker 실패 후에도 나머지 작업을 누락하지 않는다",async()=>{ const visited:number[]=[]; await assert.rejects(()=>mapWithConcurrency([1,2,3,4],0,async(value)=>{visited.push(value);if(value===2)throw new Error("expected");return value;}),/expected/);assert.deepEqual(visited,[1,2,3,4]);assert.deepEqual(await mapWithConcurrency([],3,async(value)=>value),[]); });
