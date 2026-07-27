import test from "node:test";
import assert from "node:assert/strict";
import { loginSchema, signupSchema } from "../auth.schemas";
import { authenticateLoginAttempt, type LoginUserRecord } from "../domain/authenticate-login";
import { safeInternalAuthPath } from "../domain/auth-navigation";
import { requireNextAuthSecret } from "../domain/auth-secret";
import { usesSecureAuthCookies } from "../domain/cookie-policy";
import { isNextAuthSessionCookie } from "../domain/session-cookie";
import { normalizeBasePath, resolveBasePath } from "../../../lib/base-path";

const activeUser: LoginUserRecord = { id: "user-a", email: "user@example.com", name: "User", passwordHash: "stored-hash", isActive: true };

test("공개 회원가입 입력은 역할을 받지 않고 회사 관리자 생성 필드만 검증한다", () => {
  const result = signupSchema.safeParse({ name: "Demo Admin", email: "ADMIN@EXAMPLE.COM", password: "password123", passwordConfirm: "password123", companyName: "Demo Company", role: "DEVELOPER" });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.email, "admin@example.com");
    assert.equal("role" in result.data, false);
  }
});

test("짧은 비밀번호와 불일치 확인을 차단한다", () => {
  assert.equal(loginSchema.safeParse({ identifier: "user@example.com", password: "short" }).success, false);
  assert.equal(signupSchema.safeParse({ name: "User", email: "user@example.com", password: "password123", passwordConfirm: "different", companyName: "Company" }).success, false);
});

test("로그인 식별자는 사용자명과 이메일을 동일하게 정규화한다", () => {
  const username = loginSchema.parse({ identifier: "  ShinSeungMin193  ", password: "password123" });
  const emailLogin = loginSchema.parse({ identifier: "  USER@EXAMPLE.COM  ", password: "password123" });
  assert.equal(username.identifier, "shinseungmin193");
  assert.equal(emailLogin.identifier, "user@example.com");
});

test("사용자명 또는 이메일과 올바른 비밀번호로 인증한다", async () => {
  const findUser = async (identifier: string) => [activeUser.email, "user-name"].includes(identifier) ? activeUser : null;
  const verify = async (password: string, hash: string) => password === "password123" && hash === activeUser.passwordHash;
  assert.equal((await authenticateLoginAttempt(activeUser.email, "password123", findUser, verify)).status, "AUTHENTICATED");
  assert.equal((await authenticateLoginAttempt("user-name", "password123", findUser, verify)).status, "AUTHENTICATED");
  assert.equal((await authenticateLoginAttempt("missing@example.com", "password123", findUser, verify)).status, "INVALID_CREDENTIALS");
  assert.equal((await authenticateLoginAttempt(activeUser.email, "wrong-password", findUser, verify)).status, "INVALID_CREDENTIALS");
});

test("비활성 계정은 비밀번호가 맞아도 인증을 차단한다", async () => {
  const disabledUser = { ...activeUser, isActive: false };
  const result = await authenticateLoginAttempt(disabledUser.email, "password123", async () => disabledUser, async () => true);
  assert.equal(result.status, "ACCOUNT_DISABLED");
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
