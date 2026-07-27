import test from "node:test";
import assert from "node:assert/strict";
import { generateInvitationCode, hashInvitationCode, invitationCodeUnavailableReason, maskInvitationCode, normalizeInvitationCode } from "../invitation-code.service";

test("관리자와 직원 코드는 역할을 포함하고 암호학적 난수로 생성된다", () => {
  const admin = generateInvitationCode("ADMIN"); const staff = generateInvitationCode("STAFF");
  assert.match(admin.code, /^SB-ADMIN-[A-F0-9-]+$/); assert.match(staff.code, /^SB-STAFF-[A-F0-9-]+$/); assert.notEqual(admin.code, generateInvitationCode("ADMIN").code);
});
test("평문 대신 정규화된 단방향 해시와 마스킹 값만 저장할 수 있다", () => { const generated = generateInvitationCode("STAFF"); assert.notEqual(generated.codeHash, generated.code); assert.equal(hashInvitationCode(generated.code.toLowerCase()), generated.codeHash); assert.equal(normalizeInvitationCode(` ${generated.code.toLowerCase()} `), generated.code); assert.ok(maskInvitationCode(generated.codePrefix).includes("••••")); });
test("비활성, 만료, 사용 완료 코드를 거부한다", () => { const future = new Date(Date.now() + 60_000); assert.match(invitationCodeUnavailableReason({ isActive: false, expiresAt: future, maxUses: 1, usedCount: 0 })!, /비활성/); assert.match(invitationCodeUnavailableReason({ isActive: true, expiresAt: new Date(0), maxUses: 1, usedCount: 0 })!, /만료/); assert.match(invitationCodeUnavailableReason({ isActive: true, expiresAt: future, maxUses: 1, usedCount: 1 })!, /횟수/); assert.equal(invitationCodeUnavailableReason({ isActive: true, expiresAt: future, maxUses: 2, usedCount: 1 }), null); });
