import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { AUTH_COOKIE_PATH, USE_SECURE_AUTH_COOKIES } from "@/features/auth/domain/cookie-policy";

export const DEVELOPER_ROLE_SWITCH_COOKIE_NAME = "stayboard_developer_role_session";
export const DEVELOPER_ROLE_SWITCH_MAX_AGE_SECONDS = 8 * 60 * 60;

export function createDeveloperRoleSwitchToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashDeveloperRoleSwitchToken(token) };
}

export function hashDeveloperRoleSwitchToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isPlausibleDeveloperRoleSwitchToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function getDeveloperRoleSwitchCookieToken() {
  return (await cookies()).get(DEVELOPER_ROLE_SWITCH_COOKIE_NAME)?.value ?? null;
}

export async function setDeveloperRoleSwitchCookie(token: string, expiresAt: Date) {
  const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  (await cookies()).set(DEVELOPER_ROLE_SWITCH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: USE_SECURE_AUTH_COOKIES,
    path: AUTH_COOKIE_PATH,
    expires: expiresAt,
    maxAge: Math.min(remainingSeconds, DEVELOPER_ROLE_SWITCH_MAX_AGE_SECONDS),
  });
}

export async function clearDeveloperRoleSwitchCookie() {
  (await cookies()).set(DEVELOPER_ROLE_SWITCH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: USE_SECURE_AUTH_COOKIES,
    path: AUTH_COOKIE_PATH,
    expires: new Date(0),
    maxAge: 0,
  });
}
