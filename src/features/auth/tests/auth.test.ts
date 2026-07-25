import test from "node:test";
import assert from "node:assert/strict";
import { loginSchema, signupSchema } from "../auth.schemas";
import { authenticateLoginAttempt, type LoginUserRecord } from "../domain/authenticate-login";
import { requireNextAuthSecret } from "../domain/auth-secret";
import { isNextAuthSessionCookie } from "../domain/session-cookie";

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

test("기본 및 분할된 NextAuth 세션 쿠키만 복구 대상으로 판별한다", () => {
  assert.equal(isNextAuthSessionCookie("next-auth.session-token"), true);
  assert.equal(isNextAuthSessionCookie("next-auth.session-token.0"), true);
  assert.equal(isNextAuthSessionCookie("__Secure-next-auth.session-token.1"), true);
  assert.equal(isNextAuthSessionCookie("next-auth.csrf-token"), false);
});
