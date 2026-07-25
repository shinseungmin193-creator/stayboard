import { NextResponse, type NextRequest } from "next/server";
import { isNextAuthSessionCookie, NEXTAUTH_SESSION_COOKIE_NAMES } from "@/features/auth/domain/session-cookie";

export function GET(request: NextRequest) {
  const redirectUrl = new URL("/login", request.url);
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
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: cookieName.startsWith("__Secure-"),
    });
  }

  return response;
}
