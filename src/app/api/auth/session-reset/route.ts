import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_PATH } from "@/features/auth/domain/cookie-policy";
import { isNextAuthSessionCookie, NEXTAUTH_SESSION_COOKIE_NAMES } from "@/features/auth/domain/session-cookie";
import { withBasePath } from "@/lib/base-path";
import { DEVELOPER_ROLE_SWITCH_COOKIE_NAME } from "@/features/developer-role-switch/server/developer-role-switch.session";
import { revokeDeveloperRoleSessionByToken } from "@/features/developer-role-switch/server/developer-role-switch.service";

export async function GET(request: NextRequest) {
  const roleSwitchToken = request.cookies.get(DEVELOPER_ROLE_SWITCH_COOKIE_NAME)?.value ?? null;
  await revokeDeveloperRoleSessionByToken(roleSwitchToken, "SESSION_RESET");
  const redirectUrl = new URL(withBasePath("/login"), request.url);
  redirectUrl.searchParams.set("sessionReset", "1");
  const response = NextResponse.redirect(redirectUrl);
  const cookieNames = new Set([
    ...NEXTAUTH_SESSION_COOKIE_NAMES,
    ...request.cookies.getAll().map((cookie) => cookie.name).filter(isNextAuthSessionCookie),
  ]);

  for (const cookieName of cookieNames) {
    response.cookies.set({
      name: cookieName,
      value: "",
      expires: new Date(0),
      maxAge: 0,
      path: AUTH_COOKIE_PATH,
      httpOnly: true,
      sameSite: "lax",
      secure: cookieName.startsWith("__Secure-"),
    });
  }
  response.cookies.set({
    name: DEVELOPER_ROLE_SWITCH_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    maxAge: 0,
    path: AUTH_COOKIE_PATH,
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });

  return response;
}
