import test from "node:test";
import assert from "node:assert/strict";
import { assertCanManageMember, assertLastActiveAdminSafe, MemberPolicyError } from "../domain/member-policy";
import { createInvitationToken, hashInvitationToken } from "../invitation-token";

test("member policy rejects staff, cross-company, and self-management", () => {
  assert.throws(() => assertCanManageMember({ actorRole: "STAFF", actorUserId: "staff", sameCompany: true, action: "INVITE_MEMBER" }), MemberPolicyError);
  assert.throws(() => assertCanManageMember({ actorRole: "ADMIN", actorUserId: "admin", sameCompany: false, action: "INVITE_MEMBER" }), MemberPolicyError);
  assert.throws(() => assertCanManageMember({ actorRole: "ADMIN", actorUserId: "same", targetUserId: "same", targetRole: "STAFF", sameCompany: true, action: "DISABLE_MEMBER" }), MemberPolicyError);
  assert.doesNotThrow(() => assertCanManageMember({ actorRole: "ADMIN", actorUserId: "admin", targetUserId: "staff", targetRole: "STAFF", sameCompany: true, action: "CHANGE_ROLE" }));
});

test("the final active company admin cannot be demoted or disabled", () => {
  assert.throws(() => assertLastActiveAdminSafe({ currentRole: "ADMIN", nextRole: "STAFF", activeAdminCount: 1 }), MemberPolicyError);
  assert.throws(() => assertLastActiveAdminSafe({ currentRole: "ADMIN", disabling: true, activeAdminCount: 1 }), MemberPolicyError);
  assert.doesNotThrow(() => assertLastActiveAdminSafe({ currentRole: "ADMIN", disabling: true, activeAdminCount: 2 }));
});

test("invitation tokens are random and stored as deterministic hashes", () => {
  const first = createInvitationToken();
  const second = createInvitationToken();
  assert.notEqual(first, second);
  assert.notEqual(hashInvitationToken(first), first);
  assert.equal(hashInvitationToken(first), hashInvitationToken(first));
});
