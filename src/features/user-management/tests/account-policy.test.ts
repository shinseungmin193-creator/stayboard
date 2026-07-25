import test from "node:test";
import assert from "node:assert/strict";
import { canAssignRole, canChangeAccountRole, canCreateUserRole, canDeactivateAccount, canManageTarget } from "../domain/account-policy";

test("공개 가입과 별개로 ADMIN은 STAFF만 생성할 수 있다", () => {
  assert.equal(canCreateUserRole("ADMIN", "STAFF"), true);
  assert.equal(canCreateUserRole("ADMIN", "ADMIN"), false);
  assert.equal(canCreateUserRole("ADMIN", "DEVELOPER"), false);
});

test("DEVELOPER도 Seed 전용 DEVELOPER 역할은 생성하거나 할당할 수 없다", () => {
  assert.equal(canCreateUserRole("DEVELOPER", "DEVELOPER"), false);
  assert.equal(canAssignRole("DEVELOPER", "DEVELOPER"), false);
  for (const role of ["ADMIN", "STAFF"] as const) {
    assert.equal(canCreateUserRole("DEVELOPER", role), true);
    assert.equal(canAssignRole("DEVELOPER", role), true);
  }
});

test("자기 자신 보호와 ADMIN 회사 범위를 적용한다", () => {
  assert.equal(canManageTarget({ actorRole: "DEVELOPER", actorUserId: "same", targetUserId: "same", targetRole: "STAFF", sameCompany: true }), false);
  assert.equal(canManageTarget({ actorRole: "ADMIN", actorUserId: "admin", targetUserId: "staff", targetRole: "STAFF", sameCompany: true }), true);
  assert.equal(canManageTarget({ actorRole: "ADMIN", actorUserId: "admin", targetUserId: "staff", targetRole: "STAFF", sameCompany: false }), false);
  assert.equal(canManageTarget({ actorRole: "ADMIN", actorUserId: "admin", targetUserId: "developer", targetRole: "DEVELOPER", sameCompany: true }), false);
});

test("자기 자신과 마지막 활성 개발자를 비활성화하거나 강등하지 못한다", () => {
  assert.equal(canDeactivateAccount({ isSelf: true, targetRole: "STAFF", activeDeveloperCount: 2 }), false);
  assert.equal(canDeactivateAccount({ isSelf: false, targetRole: "DEVELOPER", activeDeveloperCount: 1 }), false);
  assert.equal(canDeactivateAccount({ isSelf: false, targetRole: "DEVELOPER", activeDeveloperCount: 2 }), true);
  assert.equal(canChangeAccountRole({ isSelf: false, currentRole: "DEVELOPER", nextRole: "ADMIN", activeDeveloperCount: 1 }), false);
  assert.equal(canChangeAccountRole({ isSelf: false, currentRole: "DEVELOPER", nextRole: "ADMIN", activeDeveloperCount: 2 }), true);
});
