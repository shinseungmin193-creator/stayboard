import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertLastAdminResolution,
  assertMutableUserTarget,
  assertSafeAuditMetadata,
  DeveloperManagementPolicyError,
} from "../domain/developer-management-policy";

test("자기 자신과 다른 DEVELOPER 계정 변경을 거부한다", () => {
  assert.throws(
    () => assertMutableUserTarget({ actorUserId: "developer-a", targetUserId: "developer-a", targetSystemRole: "DEVELOPER" }),
    (error) => error instanceof DeveloperManagementPolicyError && error.code === "SELF_MANAGEMENT",
  );
  assert.throws(
    () => assertMutableUserTarget({ actorUserId: "developer-a", targetUserId: "developer-b", targetSystemRole: "DEVELOPER" }),
    (error) => error instanceof DeveloperManagementPolicyError && error.code === "DEVELOPER_PROTECTED",
  );
  assert.doesNotThrow(() => assertMutableUserTarget({ actorUserId: "developer-a", targetUserId: "member-a", targetSystemRole: "NONE" }));
});

test("마지막 관리자는 새 관리자 지정 또는 회사 이용정지 없이 처리할 수 없다", () => {
  assert.throws(
    () => assertLastAdminResolution({ lastAdminCompanyIds: ["company-a"], resolution: "NONE" }),
    (error) => error instanceof DeveloperManagementPolicyError && error.code === "LAST_ADMIN",
  );
  assert.doesNotThrow(() => assertLastAdminResolution({ lastAdminCompanyIds: ["company-a"], resolution: "TRANSFER", replacementUserId: "staff-a" }));
  assert.doesNotThrow(() => assertLastAdminResolution({ lastAdminCompanyIds: ["company-a"], resolution: "SUSPEND_COMPANY" }));
});

test("감사 metadata에 비밀번호·토큰·세션·이메일 원문을 저장하지 않는다", () => {
  assert.doesNotThrow(() => assertSafeAuditMetadata({ before: { status: "ACTIVE" }, after: { status: "SUSPENDED" } }));
  for (const details of [{ passwordHash: "secret" }, { token: "secret" }, { nested: { email: "person@example.com" } }, { sessionVersion: 3 }]) {
    assert.throws(() => assertSafeAuditMetadata(details), DeveloperManagementPolicyError);
  }
});

test("상태 변경과 감사 로그는 같은 Serializable transaction에서 실행된다", () => {
  const source = readFileSync("src/features/developer-management/developer-management.service.ts", "utf8");
  assert.match(source, /prisma\.\$transaction\(async \(tx\)/);
  assert.match(source, /tx\.user\.update/);
  assert.match(source, /tx\.auditLog\.create/);
  assert.match(source, /TransactionIsolationLevel\.Serializable/);
  assert.doesNotMatch(source, /tx\.user\.delete|prisma\.user\.delete/);
});

test("탈퇴 migration은 운영 데이터 cascade 삭제를 추가하지 않는다", () => {
  const migration = readFileSync("prisma/migrations/20260729090000_add_developer_account_management/migration.sql", "utf8");
  assert.match(migration, /CREATE TYPE "UserStatus"/);
  assert.match(migration, /"sessionVersion" INTEGER NOT NULL DEFAULT 0/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/);
  assert.doesNotMatch(migration, /DELETE FROM "(Company|Property|Room|Reservation|CalendarSource|SyncLog)"/);
});
