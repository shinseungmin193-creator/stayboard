import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { invitationCodeUnavailableReason } from "../invitation-code.policy";
import { maskInvitationCodePrefix as maskInvitationCode } from "../invitation-code.view-model";

test("1회용 관리자 코드만 암호학적 난수로 생성한다", () => {
  const source = readFileSync("src/features/invitation-codes/invitation-code.service.ts", "utf8");
  assert.match(source, /randomBytes\(INVITATION_CODE_RANDOM_BYTES\)/);
  assert.match(source, /SB-ADMIN-/);
  assert.doesNotMatch(source, /Math\.random|SB-STAFF/);
});

test("평문 대신 정규화된 단방향 해시와 마스킹 값만 저장한다", () => {
  const source = readFileSync("src/features/invitation-codes/invitation-code.service.ts", "utf8");
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /codeHash: hashInvitationCode\(code\)/);
  assert.doesNotMatch(source, /prisma|console\.|AuditLog/);
  assert.ok(maskInvitationCode("SB-ADMIN-12345").includes("••••"));
});

test("사용 완료와 폐기 코드는 거부하고 ACTIVE만 허용한다", () => {
  assert.match(invitationCodeUnavailableReason({ status: "USED" })!, /사용/);
  assert.match(invitationCodeUnavailableReason({ status: "REVOKED" })!, /폐기/);
  assert.equal(invitationCodeUnavailableReason({ status: "ACTIVE" }), null);
});

test("코드 사용 SQL은 ACTIVE 관리자 코드 하나만 원자적으로 USED 처리한다", () => {
  const source = readFileSync("src/features/invitation-codes/invitation-code.consume.ts", "utf8");
  assert.match(source, /UPDATE \"InvitationCode\"/);
  assert.match(source, /\"status\" = 'USED'/);
  assert.match(source, /\"status\" = 'ACTIVE'/);
  assert.match(source, /\"role\" = 'ADMIN'/);
  assert.match(source, /\"usedById\"/);
});

test("새 코드 발행은 기존 ACTIVE 코드를 폐기한 뒤 ADMIN 코드만 생성한다", () => {
  const source = readFileSync("src/features/invitation-codes/invitation-code.actions.ts", "utf8");
  const revokePosition = source.indexOf("updateMany");
  const createPosition = source.indexOf("invitationCode.create");
  assert.ok(revokePosition >= 0 && createPosition > revokePosition);
  assert.match(source, /role: \"ADMIN\"/);
  assert.doesNotMatch(source, /maxUses|expiresAt/);
});

test("구성원 관리 UI에는 이메일 초대와 직원·다회용 설정이 없다", () => {
  const component = readFileSync("src/features/invitation-codes/components/invitation-code-management.tsx", "utf8");
  const page = readFileSync("src/app/settings/members/page.tsx", "utf8");
  assert.doesNotMatch(component, /name=\"email\"|초대 메시지|메일 실패|다시 보내기|초대 취소|STAFF|maxUses|expiresAt/);
  assert.match(component, /1회용 관리자 초대코드/);
  assert.doesNotMatch(page, /syntenoffice@gmail\.com|CompanyInvitation/);
});

test("이메일 초대 레코드는 migration에서 제거하고 User나 Membership으로 변환하지 않는다", () => {
  const migration = readFileSync("prisma/migrations/20260727013000_replace_email_invitations_with_codes/migration.sql", "utf8");
  assert.match(migration, /DROP TABLE IF EXISTS \"CompanyInvitation\"/);
  assert.doesNotMatch(migration, /INSERT INTO \"User\"|INSERT INTO \"CompanyMembership\"/);
});
