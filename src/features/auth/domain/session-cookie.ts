export const NEXTAUTH_SESSION_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const;

export function isNextAuthSessionCookie(cookieName: string) {
  return NEXTAUTH_SESSION_COOKIE_NAMES.some((name) => cookieName === name || cookieName.startsWith(`${name}.`));
}
