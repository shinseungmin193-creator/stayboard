export const NEXTAUTH_SESSION_COOKIE_NAMES = [
  "stayboard.session-token",
  "__Secure-stayboard.session-token",
] as const;

export function isNextAuthSessionCookie(cookieName: string) {
  return NEXTAUTH_SESSION_COOKIE_NAMES.some((name) => cookieName === name || cookieName.startsWith(`${name}.`));
}
