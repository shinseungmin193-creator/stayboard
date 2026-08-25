import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const audit = readFileSync("scripts/audit-data-consistency.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20260825130000_harden_reservation_derived_data/migration.sql", "utf8");

test("audit:data는 기본적으로 반복 가능한 읽기 전용 transaction만 사용한다", () => {
  assert.match(packageJson.scripts["audit:data"], /audit-data-consistency\.ts/);
  assert.match(audit, /REPEATABLE READ \$\{repair \? "READ WRITE" : "READ ONLY"\}/);
  assert.match(audit, /else await client\.query\("ROLLBACK"\)/);
  assert.match(audit, /mode: repair \? "REPAIR" : "READ_ONLY"/);
});

test("repair는 명백한 파생 데이터만 고치고 Reservation 의심 후보는 보고만 한다", () => {
  assert.match(audit, /ambiguousReservationsRemainReportOnly/);
  assert.doesNotMatch(audit, /DELETE FROM "Reservation"/);
  assert.doesNotMatch(audit, /UPDATE "Reservation"/);
  assert.match(audit, /DELETE FROM "CleaningTask"/);
  assert.match(audit, /UPDATE "ReservationConflict"/);
  assert.match(audit, /--confirm-orphan-count=/);
  assert.match(audit, /MASS_ORPHAN_REPAIR_THRESHOLD/);
});

test("감사는 Reservation·CleaningTask·Conflict·Sync와 대시보드 invariant를 함께 검사한다", () => {
  for (const marker of [
    "duplicateSourceUid",
    "invalidDates",
    "operationalOrphans",
    "missingTasks",
    "invalidActive",
    "canonicalOrderViolations",
    "malformedSuccess",
    "cleaningActiveEqualsPriorityPlusFlexible",
    "dashboardOverbookingEqualsDetail",
  ]) assert.match(audit, new RegExp(marker));
});

test("DB는 새 잘못된 날짜·역순 conflict를 차단하고 Reservation 직접 삭제를 제한한다", () => {
  assert.match(schema, /reservation\s+Reservation\?\s+@relation\([\s\S]*onDelete: Restrict/);
  assert.match(migration, /CHECK \("startDate" < "endDate"\) NOT VALID/);
  assert.match(migration, /CHECK \("reservationAId" < "reservationBId"\) NOT VALID/);
  assert.match(migration, /ON DELETE RESTRICT ON UPDATE CASCADE/);
});
