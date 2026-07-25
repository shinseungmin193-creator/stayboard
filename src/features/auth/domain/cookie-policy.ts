import type { NextAuthOptions } from "next-auth";
import { APP_BASE_PATH } from "../../../lib/base-path";

export const AUTH_COOKIE_PATH = APP_BASE_PATH || "/";

export function usesSecureAuthCookies(nextAuthUrl: string | undefined): boolean {
  if (!nextAuthUrl) return false;

  try {
    return new URL(nextAuthUrl).protocol === "https:";
  } catch {
    return false;
  }
}

export const USE_SECURE_AUTH_COOKIES = usesSecureAuthCookies(process.env.NEXTAUTH_URL);

const securePrefix = USE_SECURE_AUTH_COOKIES ? "__Secure-" : "";
const sharedOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: AUTH_COOKIE_PATH,
  secure: USE_SECURE_AUTH_COOKIES,
};

export const stayboardAuthCookies: NonNullable<NextAuthOptions["cookies"]> = {
  sessionToken: {
    name: `${securePrefix}stayboard.session-token`,
    options: sharedOptions,
  },
  callbackUrl: {
    name: `${securePrefix}stayboard.callback-url`,
    options: sharedOptions,
  },
  csrfToken: {
    name: `${securePrefix}stayboard.csrf-token`,
    options: sharedOptions,
  },
  pkceCodeVerifier: {
    name: `${securePrefix}stayboard.pkce.code_verifier`,
    options: { ...sharedOptions, maxAge: 60 * 15 },
  },
  state: {
    name: `${securePrefix}stayboard.state`,
    options: { ...sharedOptions, maxAge: 60 * 15 },
  },
  nonce: {
    name: `${securePrefix}stayboard.nonce`,
    options: sharedOptions,
  },
};
