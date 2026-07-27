import test from "node:test";
import assert from "node:assert/strict";
import { assertCanManageMember, assertLastActiveAdminSafe, MemberPolicyError } from "../domain/member-policy";

test("member policy rejects staff, cross-company, and self-management", () => {
  assert.throws(() => assertCanManageMember({ actorRole: "STAFF", actorUserId: "staff", sameCompany: true, action: "MANAGE_INVITATION_CODE" }), MemberPolicyError);
  assert.throws(() => assertCanManageMember({ actorRole: "ADMIN", actorUserId: "admin", sameCompany: false, action: "MANAGE_INVITATION_CODE" }), MemberPolicyError);
  assert.throws(() => assertCanManageMember({ actorRole: "ADMIN", actorUserId: "same", targetUserId: "same", targetRole: "STAFF", sameCompany: true, action: "DISABLE_MEMBER" }), MemberPolicyError);
  assert.doesNotThrow(() => assertCanManageMember({ actorRole: "ADMIN", actorUserId: "admin", targetUserId: "staff", targetRole: "STAFF", sameCompany: true, action: "CHANGE_ROLE" }));
});

test("the final active company admin cannot be demoted or disabled", () => {
  assert.throws(() => assertLastActiveAdminSafe({ currentRole: "ADMIN", nextRole: "STAFF", activeAdminCount: 1 }), MemberPolicyError);
  assert.throws(() => assertLastActiveAdminSafe({ currentRole: "ADMIN", disabling: true, activeAdminCount: 1 }), MemberPolicyError);
  assert.doesNotThrow(() => assertLastActiveAdminSafe({ currentRole: "ADMIN", disabling: true, activeAdminCount: 2 }));
});
