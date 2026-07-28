import "server-only";

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "./auth.schemas";
import { verifyPassword } from "./server/password";
import { authenticateLoginAttempt } from "./domain/authenticate-login";
import { requireNextAuthSecret } from "./domain/auth-secret";
import { stayboardAuthCookies } from "./domain/cookie-policy";
import { withBasePath } from "@/lib/base-path";
import { findLoginUserByIdentifier } from "./server/login-user.repository";
import { logLoginRejection } from "./server/login-audit";
import { isSessionSnapshotValid } from "./domain/session-policy";

export const authOptions: NextAuthOptions = {
  secret: requireNextAuthSecret(process.env.NEXTAUTH_SECRET),
  cookies: stayboardAuthCookies,
  providers: [
    CredentialsProvider({
      name: "아이디 또는 이메일",
      credentials: {
        identifier: { label: "아이디 또는 이메일", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          logLoginRejection("INVALID_INPUT");
          return null;
        }
        try {
          const attempt = await authenticateLoginAttempt(
            parsed.data.identifier,
            parsed.data.password,
            findLoginUserByIdentifier,
            verifyPassword,
          );
          if (attempt.status === "REJECTED") {
            logLoginRejection(attempt.reason);
            return null;
          }
          const { user } = attempt;
          await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            sessionVersion: user.sessionVersion,
          };
        } catch (error) {
          logLoginRejection("AUTHENTICATION_ERROR", error);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: withBasePath("/login") },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.sessionVersion = user.sessionVersion;
      }
      if (!token.sub) {
        token.sessionValid = false;
        return token;
      }
      const account = await prisma.user.findUnique({
        where: { id: token.sub },
        select: { status: true, isActive: true, sessionVersion: true },
      });
      token.sessionValid = isSessionSnapshotValid(account, token.sessionVersion);
      return token;
    },
    async session({ session, token }) {
      if (!token.sub || token.sessionValid !== true) return { expires: session.expires };
      if (session.user) session.user.id = token.sub;
      return session;
    },
  },
};
