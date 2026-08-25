import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasPermission, PERMISSIONS } from "../../access-control/domain/access-control";
import { calculateOverlapRange, doReservationRangesOverlap, findReservationConflictPairs, isValidReservationRange, normalizeConflictPair, type ConflictCandidate } from "../domain/reservation-conflict";
import { classifyConflicts } from "../domain/classify-conflicts";
import { getReservationConflictTodayStart, isPastReservationConflict } from "../domain/reservation-conflict-dismissal";
const candidate = (id: string, start: string, end: string, overrides: Partial<ConflictCandidate> = {}): ConflictCandidate => ({ id, roomId: "room", startDate: new Date(start), endDate: new Date(end), status: "CONFIRMED", ...overrides });
test("겹치는 예약과 실제 overlap 범위를 계산한다", () => { const a = candidate("b","2026-01-01","2026-01-05"); const b = candidate("a","2026-01-03","2026-01-07"); assert.equal(doReservationRangesOverlap(a,b),true); assert.deepEqual(normalizeConflictPair(a.id,b.id),["a","b"]); assert.deepEqual(calculateOverlapRange(a,b),{ overlapStart:new Date("2026-01-03"), overlapEnd:new Date("2026-01-05") }); });
test("비충돌 경계와 제외 조건을 처리한다", () => { const a = candidate("a","2026-01-01","2026-01-03"); assert.equal(doReservationRangesOverlap(a,candidate("b","2026-01-03","2026-01-05")),false); assert.equal(doReservationRangesOverlap(a,candidate("a","2026-01-02","2026-01-04")),false); assert.equal(doReservationRangesOverlap(a,candidate("b","2026-01-02","2026-01-04",{status:"CANCELLED"})),false); assert.equal(doReservationRangesOverlap(a,candidate("b","2026-01-02","2026-01-04",{roomId:"other"})),false); assert.equal(isValidReservationRange(candidate("bad","invalid","2026-01-04")),false); assert.equal(isValidReservationRange(candidate("bad","2026-01-04","2026-01-04")),false); });
test("Sweep Line으로 다중 충돌을 중복 없이 찾는다", () => { const pairs = findReservationConflictPairs([candidate("a","2026-01-01","2026-01-05"),candidate("b","2026-01-02","2026-01-04"),candidate("c","2026-01-03","2026-01-06")]); assert.deepEqual(pairs.map((p)=>[p.reservationAId,p.reservationBId]),[["a","b"],["a","c"],["b","c"]]); });
test("신규·유지·복구·해제 충돌을 분류한다", () => { const pair = findReservationConflictPairs([candidate("a","2026-01-01","2026-01-05"),candidate("b","2026-01-02","2026-01-04")])[0]; const missing = { id:"missing",status:"ACTIVE" as const,...pair,reservationAId:"c",reservationBId:"d" }; const resolved = { id:"resolved",status:"RESOLVED" as const,...pair }; const result = classifyConflicts([missing,resolved],[pair,pair]); assert.equal(result.create.length,0); assert.equal(result.refresh.length,1); assert.equal(result.refresh[0].reactivate,true); assert.deepEqual(result.resolveIds,["missing"]); });
test("신규 충돌 생성과 기존 ACTIVE 유지를 분류한다", () => { const pair = findReservationConflictPairs([candidate("a","2026-01-01","2026-01-05"),candidate("b","2026-01-02","2026-01-04")])[0]; assert.equal(classifyConflicts([], [pair,pair]).create.length,1); const maintained = classifyConflicts([{id:"active",status:"ACTIVE",...pair}],[pair]); assert.equal(maintained.refresh.length,1); assert.equal(maintained.refresh[0].reactivate,false); assert.equal(maintained.resolveIds.length,0); });
test("예약 취소 후 사라진 충돌은 RESOLVED 대상으로 분류한다", () => { const pair = findReservationConflictPairs([candidate("a","2026-01-01","2026-01-05"),candidate("b","2026-01-02","2026-01-04")])[0]; const detected = findReservationConflictPairs([candidate("a","2026-01-01","2026-01-05"),candidate("b","2026-01-02","2026-01-04",{status:"CANCELLED"})]); const result = classifyConflicts([{id:"one",status:"ACTIVE",...pair}],detected); assert.deepEqual(result.resolveIds,["one"]); });
test("BLOCKED 일정은 실제 예약과 겹쳐도 오버부킹 대상이 아니다", () => { const actual = candidate("actual","2026-01-01","2026-01-05"); const blocked = candidate("blocked","2026-01-02","2026-01-04",{status:"BLOCKED"}); assert.equal(doReservationRangesOverlap(actual, blocked), false); assert.deepEqual(findReservationConflictPairs([actual, blocked]), []); });
test("UNKNOWN 일정은 실제 예약과 겹쳐도 오버부킹 대상이 아니다", () => { const actual = candidate("actual","2026-01-01","2026-01-05"); const unknown = candidate("unknown","2026-01-02","2026-01-04",{status:"UNKNOWN"}); assert.equal(doReservationRangesOverlap(actual, unknown), false); assert.deepEqual(findReservationConflictPairs([actual, unknown]), []); });
test("포함·연속 경계 예시를 정확히 계산한다", () => { const pairs = findReservationConflictPairs([candidate("D","2026-07-10","2026-07-12"),candidate("C","2026-07-04","2026-07-05"),candidate("A","2026-07-01","2026-07-10"),candidate("B","2026-07-02","2026-07-03")]); assert.deepEqual(pairs.map((pair)=>[pair.reservationAId,pair.reservationBId]),[["A","B"],["A","C"]]); });
test("같은 시작일·동일 기간·섞인 입력에서도 결정적이다", () => { const values = [candidate("c","2026-07-01","2026-07-04"),candidate("a","2026-07-01","2026-07-04"),candidate("b","2026-07-01","2026-07-03")]; const forward = findReservationConflictPairs(values).map((pair)=>[pair.reservationAId,pair.reservationBId]); const reverse = findReservationConflictPairs([...values].reverse()).map((pair)=>[pair.reservationAId,pair.reservationBId]); assert.deepEqual(forward,reverse); assert.equal(new Set(forward.map((pair)=>pair.join("|"))).size,3); });
test("100개 이상 완전 중첩 예약의 모든 쌍을 한 번만 반환한다", () => { const values = Array.from({length:101},(_,index)=>candidate(String(index).padStart(3,"0"),"2026-07-01","2026-07-10")); const pairs = findReservationConflictPairs(values); assert.equal(pairs.length,5050); assert.equal(new Set(pairs.map((pair)=>`${pair.reservationAId}|${pair.reservationBId}`)).size,5050); });
test("overlap 변경 여부를 분류한다", () => { const original = findReservationConflictPairs([candidate("a","2026-01-01","2026-01-05"),candidate("b","2026-01-02","2026-01-04")])[0]; const changed = {...original,overlapEnd:new Date("2026-01-03")}; const result = classifyConflicts([{id:"active",status:"ACTIVE",...original}],[changed]); assert.equal(result.refresh[0].overlapChanged,true); });

test("Asia/Tokyo 오늘 경계 이전에 끝난 충돌만 지난 오버부킹이다", () => {
  const todayStart = getReservationConflictTodayStart(new Date("2026-08-20T16:30:00.000Z"));
  assert.equal(todayStart.toISOString(), "2026-08-20T15:00:00.000Z");
  assert.equal(isPastReservationConflict(new Date("2026-08-19T15:00:00.000Z"), todayStart), true);
  assert.equal(isPastReservationConflict(new Date("2026-08-20T15:00:00.000Z"), todayStart), false);
  assert.equal(isPastReservationConflict(new Date("2026-08-21T15:00:00.000Z"), todayStart), false);
});

test("정리된 과거 충돌은 다음 감지에서 재활성화하지 않고 미래로 변경되면 다시 활성화한다", () => {
  const past = findReservationConflictPairs([candidate("a", "2026-08-01", "2026-08-04"), candidate("b", "2026-08-02", "2026-08-05")])[0];
  const boundary = new Date("2026-08-21T00:00:00.000Z");
  const dismissed = { id: "dismissed", status: "DISMISSED" as const, ...past };
  const kept = classifyConflicts([dismissed], [past], { dismissedReactivationBoundary: boundary });
  assert.equal(kept.refresh.length, 0);
  const future = { ...past, overlapStart: new Date("2026-08-22"), overlapEnd: new Date("2026-08-23") };
  const reactivated = classifyConflicts([dismissed], [future], { dismissedReactivationBoundary: boundary });
  assert.equal(reactivated.refresh[0].reactivate, true);
});

test("오버부킹 정리는 충돌 상태와 감사 로그만 변경하고 Reservation을 삭제하지 않는다", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync("prisma/migrations/20260821120000_add_dismissed_reservation_conflict_status/migration.sql", "utf8");
  const repository = readFileSync("src/features/reservation-conflicts/infrastructure/reservation-conflict-dismissal.repository.ts", "utf8");
  assert.match(schema, /enum ReservationConflictStatus[\s\S]*DISMISSED/);
  assert.match(migration, /ADD VALUE 'DISMISSED'/);
  assert.match(repository, /reservationConflict\.updateMany/);
  assert.match(repository, /status: "DISMISSED"/);
  assert.match(repository, /RESERVATION_CONFLICT_DISMISSED/);
  assert.match(repository, /reservationDataPreserved: true/);
  assert.doesNotMatch(repository, /reservation\.(?:delete|deleteMany|update|updateMany)/);
  assert.doesNotMatch(repository, /reservationConflict\.(?:delete|deleteMany)/);
});

test("개별·일괄 정리는 ROOM_MANAGE와 객실 범위를 서버에서 검증한다", () => {
  const actions = readFileSync("src/features/reservation-conflicts/reservation-conflict.actions.ts", "utf8");
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_MANAGE), false);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.ROOM_MANAGE), true);
  assert.match(actions, /requireRoomAccess\(target\.roomId, PERMISSIONS\.ROOM_MANAGE\)/);
  assert.match(actions, /requirePermission\(PERMISSIONS\.ROOM_MANAGE\)/);
  assert.match(actions, /requirePropertyAccess/);
  assert.match(actions, /companyScopeIds\(context\)/);
});

test("사이드바와 정리 UI는 오버부킹 명칭·확인창·모바일 버튼을 제공한다", () => {
  const ko = JSON.parse(readFileSync("src/messages/ko.json", "utf8"));
  const component = readFileSync("src/features/reservation-conflicts/components/reservation-conflict-list.tsx", "utf8");
  const page = readFileSync("src/app/reservation-conflicts/page.tsx", "utf8");
  assert.equal(ko.navigation.items["reservation-conflicts"], "오버부킹");
  assert.match(component, /conflictCleanup\.singleButton/);
  assert.match(component, /conflictCleanup\.bulkButton/);
  assert.match(component, /role="alertdialog"/);
  assert.match(component, /className=\{mobile \? "min-h-11 w-full"/);
  assert.match(component, /conflict\.status === "ACTIVE"[\s\S]*conflict\.isPast/);
  assert.match(page, /RESERVATION_CONFLICT_VIEW_STATUSES/);
  assert.match(page, /value=\{item\}/);
});

test("대시보드 count와 오버부킹 ACTIVE 목록은 같은 공통 조건을 사용한다", () => {
  const dashboard = readFileSync("src/features/dashboard/dashboard.repository.ts", "utf8");
  const list = readFileSync("src/features/reservation-conflicts/infrastructure/reservation-conflict-list.repository.ts", "utf8");
  const active = readFileSync("src/features/reservation-conflicts/infrastructure/active-reservation-conflict.repository.ts", "utf8");
  assert.match(dashboard, /countActiveReservationConflicts/);
  assert.match(list, /buildActiveReservationConflictWhere\(filters\)/);
  assert.match(active, /status: "ACTIVE", overlapEnd: \{ gte: filters\.todayStart \}/);
  assert.match(active, /reservationA: buildOperationalReservationWhere\(\)/);
  assert.match(active, /reservationB: buildOperationalReservationWhere\(\)/);
  assert.match(active, /isActive: true[\s\S]*property:[\s\S]*isActive: true/);
});
