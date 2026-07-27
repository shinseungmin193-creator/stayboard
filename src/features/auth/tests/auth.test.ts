import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compare, hash } from "bcryptjs";
import { loginSchema, signupSchema } from "../auth.schemas";
import { authenticateLoginAttempt, type LoginUserRecord } from "../domain/authenticate-login";
import { normalizeEmail } from "../domain/identity";
import { safeInternalAuthPath } from "../domain/auth-navigation";
import { requireNextAuthSecret } from "../domain/auth-secret";
import { usesSecureAuthCookies } from "../domain/cookie-policy";
import { isNextAuthSessionCookie } from "../domain/session-cookie";
import { normalizeBasePath, resolveBasePath } from "../../../lib/base-path";

const activeUser: LoginUserRecord = {
  id: "user-a",
  email: "user@example.com",
  name: "User",
  passwordHash: "stored-hash",
  isActive: true,
  systemRole: "NONE",
  memberships: [{ status: "ACTIVE", companyActive: true }],
};

test("공개 회원가입 입력은 역할을 받지 않고 회사 관리자 생성 필드만 검증한다", () => {
  const result = signupSchema.safeParse({ signupType: "new-company", name: "Demo Admin", email: "ADMIN@EXAMPLE.COM", password: "password123", passwordConfirm: "password123", companyName: "Demo Company", role: "DEVELOPER" });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.email, "admin@example.com");
    assert.equal("role" in result.data, false);
  }
});

test("짧은 비밀번호와 불일치 확인을 차단한다", () => {
  assert.equal(loginSchema.safeParse({ identifier: "user@example.com", password: "short" }).success, false);
  assert.equal(signupSchema.safeParse({ signupType: "new-company", name: "User", email: "user@example.com", password: "password123", passwordConfirm: "different", companyName: "Company" }).success, false);
});

test("로그인 식별자는 사용자명과 이메일을 동일하게 정규화한다", () => {
  const username = loginSchema.parse({ identifier: "  ShinSeungMin193  ", password: "password123" });
  const emailLogin = loginSchema.parse({ identifier: "  USER@EXAMPLE.COM  ", password: "password123" });
  assert.equal(username.identifier, "shinseungmin193");
  assert.equal(emailLogin.identifier, "user@example.com");
  assert.equal(normalizeEmail("  USER@EXAMPLE.COM  "), "user@example.com");
});

test("일반 가입과 관리자 초대코드 가입 계정은 동일한 로그인 조건을 통과한다", async () => {
  const findUser = async (identifier: string) => [activeUser.email, "user-name"].includes(identifier) ? activeUser : null;
  const verify = async (password: string, hash: string) => password === "password123" && hash === activeUser.passwordHash;
  assert.equal((await authenticateLoginAttempt(activeUser.email, "password123", findUser, verify)).status, "AUTHENTICATED");
  assert.equal((await authenticateLoginAttempt("user-name", "password123", findUser, verify)).status, "AUTHENTICATED");
  const invitationAdmin = { ...activeUser, id: "invited-admin", email: "invited@example.com" };
  assert.equal((await authenticateLoginAttempt(invitationAdmin.email, "password123", async () => invitationAdmin, verify)).status, "AUTHENTICATED");
});

test("대소문자와 앞뒤 공백이 있는 이메일도 정규화 후 로그인한다", async () => {
  const parsed = loginSchema.parse({ identifier: "  USER@EXAMPLE.COM  ", password: "password123" });
  const result = await authenticateLoginAttempt(parsed.identifier, parsed.password, async (identifier) => identifier === activeUser.email ? activeUser : null, async () => true);
  assert.equal(result.status, "AUTHENTICATED");
});

test("잘못된 비밀번호와 계정·Membership 이상을 내부 사유로 구분한다", async () => {
  const missingUser = await authenticateLoginAttempt("missing@example.com", "password123", async () => null, async () => true);
  assert.deepEqual(missingUser, { status: "REJECTED", reason: "USER_NOT_FOUND" });
  const missingHash = await authenticateLoginAttempt(activeUser.email, "password123", async () => ({ ...activeUser, passwordHash: null }), async () => true);
  assert.deepEqual(missingHash, { status: "REJECTED", reason: "PASSWORD_HASH_MISSING" });
  const mismatch = await authenticateLoginAttempt(activeUser.email, "wrong-password", async () => activeUser, async () => false);
  assert.deepEqual(mismatch, { status: "REJECTED", reason: "PASSWORD_MISMATCH" });
  const missingMembership = await authenticateLoginAttempt(activeUser.email, "password123", async () => ({ ...activeUser, memberships: [] }), async () => true);
  assert.deepEqual(missingMembership, { status: "REJECTED", reason: "MEMBERSHIP_NOT_FOUND" });
  const inactiveMembership = await authenticateLoginAttempt(activeUser.email, "password123", async () => ({ ...activeUser, memberships: [{ status: "DISABLED", companyActive: true }] }), async () => true);
  assert.deepEqual(inactiveMembership, { status: "REJECTED", reason: "MEMBERSHIP_INACTIVE" });
});

test("비활성 계정은 비밀번호가 맞아도 인증을 차단한다", async () => {
  const disabledUser = { ...activeUser, isActive: false };
  const result = await authenticateLoginAttempt(disabledUser.email, "password123", async () => disabledUser, async () => true);
  assert.deepEqual(result, { status: "REJECTED", reason: "USER_INACTIVE" });
});

test("가입과 로그인은 같은 bcrypt 형식과 원본 비밀번호를 사용한다", async () => {
  const password = "  Password123  ";
  const passwordHash = await hash(password, 4);
  const user = { ...activeUser, passwordHash };
  assert.equal((await authenticateLoginAttempt(user.email, password, async () => user, compare)).status, "AUTHENTICATED");
  assert.deepEqual(await authenticateLoginAttempt(user.email, password.trim(), async () => user, compare), { status: "REJECTED", reason: "PASSWORD_MISMATCH" });
  const actionSource = readFileSync("src/features/auth/auth.actions.ts", "utf8");
  const authConfigSource = readFileSync("src/features/auth/auth.config.ts", "utf8");
  assert.match(actionSource, /passwordHash = await hashPassword\(parsed\.data\.password\)/);
  assert.match(authConfigSource, /verifyPassword/);
  assert.doesNotMatch(actionSource, /parsed\.data\.password\.trim\(/);
});

test("가입 transaction은 User와 ADMIN ACTIVE Membership 및 코드 사용을 함께 처리한다", () => {
  const source = readFileSync("src/features/auth/auth.actions.ts", "utf8");
  const transactionStart = source.indexOf("prisma.$transaction");
  const userCreate = source.indexOf("tx.user.create", transactionStart);
  const consumeCode = source.indexOf("consumeInvitationCode", userCreate);
  const membershipCreate = source.indexOf("tx.companyMembership.create", userCreate);
  assert.ok(transactionStart >= 0 && userCreate > transactionStart && consumeCode > userCreate && membershipCreate > consumeCode);
  assert.match(source.slice(membershipCreate), /role: "ADMIN", status: "ACTIVE"/);
  assert.match(source, /Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(source, /error\.code === "P2002"/);
});

test("기존 계정 진단은 비밀번호 해시 원문 없이 Boolean과 Membership만 출력한다", () => {
  const source = readFileSync("scripts/diagnose-invitation-account.ts", "utf8");
  assert.match(source, /passwordHashPresent: Boolean\(user\?\.passwordHash\)/);
  assert.match(source, /membershipExists: Boolean\(user\?\.memberships\.length\)/);
  assert.doesNotMatch(source, /passwordHash:\s*user\?\.passwordHash/);
  assert.doesNotMatch(source, /user\.passwordHash\s*[,}]/);
});

test("NextAuth secret은 고정된 32자 이상의 값만 허용한다", () => {
  assert.throws(() => requireNextAuthSecret(undefined), /NEXTAUTH_SECRET/);
  assert.throws(() => requireNextAuthSecret("short"), /32자/);
  const secret = "a".repeat(32);
  assert.equal(requireNextAuthSecret(secret), secret);
});

test("StayBoard 전용 및 분할된 NextAuth 세션 쿠키만 복구 대상으로 판별한다", () => {
  assert.equal(isNextAuthSessionCookie("stayboard.session-token"), true);
  assert.equal(isNextAuthSessionCookie("stayboard.session-token.0"), true);
  assert.equal(isNextAuthSessionCookie("__Secure-stayboard.session-token.1"), true);
  assert.equal(isNextAuthSessionCookie("next-auth.session-token"), false);
  assert.equal(isNextAuthSessionCookie("stayboard.csrf-token"), false);
});

test("하위 배포 경로는 정규화하고 잘못된 형식은 거부한다", () => {
  assert.equal(normalizeBasePath(undefined), "");
  assert.equal(normalizeBasePath("/"), "");
  assert.equal(normalizeBasePath(" /stayboard "), "/stayboard");
  assert.throws(() => normalizeBasePath("stayboard"), /NEXT_PUBLIC_BASE_PATH/);
  assert.throws(() => normalizeBasePath("/stayboard/"), /NEXT_PUBLIC_BASE_PATH/);
  assert.throws(() => normalizeBasePath("/stayboard?mode=1"), /NEXT_PUBLIC_BASE_PATH/);
});

test("기본 경로는 운영과 로컬에서 /stayboard를 사용하고 로컬은 명시적으로 해제할 수 있다", () => {
  assert.equal(resolveBasePath(undefined, "production"), "/stayboard");
  assert.equal(resolveBasePath("", "production"), "/stayboard");
  assert.equal(resolveBasePath(undefined, "development"), "/stayboard");
  assert.equal(resolveBasePath("", "development"), "");
});

test("로그인 완료 이동은 내부 경로만 허용한다", () => {
  assert.equal(safeInternalAuthPath("/room-overview"), "/room-overview");
  assert.equal(safeInternalAuthPath("/properties?welcome=1"), "/properties?welcome=1");
  assert.equal(safeInternalAuthPath("https://example.com"), "/");
  assert.equal(safeInternalAuthPath("//example.com"), "/");
  assert.equal(safeInternalAuthPath(undefined), "/");
});

test("인증 쿠키 보안 여부는 공개 인증 URL의 프로토콜을 따른다", () => {
  assert.equal(usesSecureAuthCookies("https://example.com/stayboard/api/auth"), true);
  assert.equal(usesSecureAuthCookies("http://127.0.0.1:3004/api/auth"), false);
  assert.equal(usesSecureAuthCookies("invalid"), false);
});
