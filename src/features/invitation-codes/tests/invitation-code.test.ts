import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INVITATION_CODE_MESSAGES, resolveInvitationLocale } from "../invitation-code.messages";
import { getInvitationCodeDisplayStatus, invitationCodeUnavailableReason } from "../invitation-code.policy";
import { maskInvitationCodePrefix as maskInvitationCode } from "../invitation-code.view-model";

const now = new Date("2026-07-28T03:00:00.000Z");
const future = new Date("2026-07-29T03:00:00.000Z");
const past = new Date("2026-07-27T03:00:00.000Z");

test("ADMIN과 STAFF 코드는 역할별 접두사와 암호학적 난수를 사용한다", () => {
  const source = readFileSync("src/features/invitation-codes/invitation-code.service.ts", "utf8");
  assert.match(source, /randomBytes\(INVITATION_CODE_RANDOM_BYTES\)/);
  assert.match(source, /`SB-\$\{role\}-/);
  assert.doesNotMatch(source, /Math\.random/);
});

test("평문 대신 정규화된 단방향 해시와 마스킹 값만 저장한다", () => {
  const source = readFileSync("src/features/invitation-codes/invitation-code.service.ts", "utf8");
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /codeHash: hashInvitationCode\(code\)/);
  assert.doesNotMatch(source, /@\/lib\/prisma|console\.|auditLog/);
  assert.ok(maskInvitationCode("SB-STAFF-12345").includes("••••"));
});

test("사용·폐기·만료 코드는 거부하고 미만료 ACTIVE만 허용한다", () => {
  assert.match(invitationCodeUnavailableReason({ status: "USED", expiresAt: future }, now)!, /사용/);
  assert.match(invitationCodeUnavailableReason({ status: "REVOKED", expiresAt: future }, now)!, /폐기/);
  assert.match(invitationCodeUnavailableReason({ status: "ACTIVE", expiresAt: past }, now)!, /만료/);
  assert.equal(invitationCodeUnavailableReason({ status: "ACTIVE", expiresAt: future }, now), null);
  assert.equal(getInvitationCodeDisplayStatus({ status: "ACTIVE", expiresAt: past }, now), "EXPIRED");
});

test("코드 사용 SQL은 역할과 무관하게 ACTIVE·미사용·미만료 코드 하나만 원자적으로 처리한다", () => {
  const source = readFileSync("src/features/invitation-codes/invitation-code.consume.ts", "utf8");
  assert.match(source, /UPDATE "InvitationCode"/);
  assert.match(source, /"status" = 'USED'/);
  assert.match(source, /"status" = 'ACTIVE'/);
  assert.match(source, /"usedAt" IS NULL/);
  assert.match(source, /"expiresAt" > /);
  assert.match(source, /RETURNING "id", "companyId", "role"/);
  assert.doesNotMatch(source, /"role" = 'ADMIN'/);
});

test("역할별 발행은 24시간 만료와 회사 범위를 서버에서 검증한다", () => {
  const source = readFileSync("src/features/invitation-codes/invitation-code.actions.ts", "utf8");
  assert.match(source, /invitationCodeCreateSchema\.safeParse/);
  assert.match(source, /role: parsed\.data\.role, status: "ACTIVE"/);
  assert.match(source, /INVITE_EXPIRATION_HOURS/);
  assert.match(source, /company\.findFirst\(\{ where: \{ id: companyId, isActive: true \}/);
  assert.match(source, /PERMISSIONS\.USER_MANAGE/);
  assert.match(source, /context\.role === "STAFF"/);
  assert.match(source, /Prisma\.TransactionIsolationLevel\.Serializable/);
});

test("가입 역할은 클라이언트가 아니라 소비된 코드 역할로 결정되고 STAFF 숙소 접근을 생성한다", () => {
  const signup = readFileSync("src/features/auth/auth.actions.ts", "utf8");
  const membership = readFileSync("src/features/invitation-codes/invitation-code.membership.ts", "utf8");
  assert.match(signup, /membershipRole = consumed\.role/);
  assert.match(signup, /createInvitedCompanyMembership/);
  assert.match(membership, /input\.role === "STAFF"/);
  assert.match(membership, /tx\.property\.findMany/);
  assert.match(membership, /tx\.propertyAccess\.createMany/);
});

test("로그인 사용자의 수락도 중복 소속을 막고 동일한 원자적 소비 흐름을 사용한다", () => {
  const source = readFileSync("src/features/invitation-codes/invitation-code.actions.ts", "utf8");
  assert.match(source, /companyMembership\.findUnique/);
  assert.match(source, /consumeInvitationCode\(tx, invitation\.id, context\.userId, now\)/);
  assert.match(source, /createInvitedCompanyMembership/);
  assert.match(source, /action: "INVITATION_CODE_USED"/);
});

test("구성원 관리 UI는 관리자·직원 발행과 역할·상태·만료 표시를 제공한다", () => {
  const component = readFileSync("src/features/invitation-codes/components/invitation-code-management.tsx", "utf8");
  const page = readFileSync("src/app/settings/members/page.tsx", "utf8");
  assert.match(component, /\["ADMIN", "STAFF"\]/);
  assert.match(component, /getInvitationCodeDisplayStatus/);
  assert.match(component, /code\.expiresAt/);
  assert.doesNotMatch(page, /syntenoffice@gmail\.com|CompanyInvitation/);
});

test("한국어와 일본어 역할·상태 문구를 제공한다", () => {
  assert.equal(resolveInvitationLocale("ja-JP,ja;q=0.9"), "ja");
  assert.equal(resolveInvitationLocale("ko-KR"), "ko");
  assert.equal(INVITATION_CODE_MESSAGES.ko.staff, "직원");
  assert.equal(INVITATION_CODE_MESSAGES.ja.staff, "スタッフ");
  assert.equal(INVITATION_CODE_MESSAGES.ja.status.EXPIRED, "期限切れ");
});

test("migration은 기존 ADMIN 코드를 보존하며 역할별 활성 코드와 만료를 추가한다", () => {
  const migration = readFileSync("prisma/migrations/20260728090000_add_role_based_invitation_codes/migration.sql", "utf8");
  assert.match(migration, /ADD COLUMN "expiresAt"/);
  assert.match(migration, /GREATEST\("createdAt" \+ INTERVAL '24 hours', CURRENT_TIMESTAMP \+ INTERVAL '24 hours'\)/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS "InvitationCode_admin_role_check"/);
  assert.match(migration, /"companyId", "role"/);
});
