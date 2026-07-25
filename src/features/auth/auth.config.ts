import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "./auth.schemas";
import { verifyPassword } from "./server/password";
import { authenticateLoginAttempt } from "./domain/authenticate-login";
import { requireNextAuthSecret } from "./domain/auth-secret";
import { stayboardAuthCookies } from "./domain/cookie-policy";
import { withBasePath } from "@/lib/base-path";

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
        if (!parsed.success) return null;
        const attempt = await authenticateLoginAttempt(
          parsed.data.identifier,
          parsed.data.password,
          (identifier) => prisma.user.findFirst({
            where: { OR: [{ email: identifier }, { username: identifier }] },
            select: { id: true, email: true, name: true, passwordHash: true, isActive: true },
          }),
          verifyPassword,
        );
        if (attempt.status === "INVALID_CREDENTIALS") return null;
        if (attempt.status === "ACCOUNT_DISABLED") throw new Error("ACCOUNT_DISABLED");
        const { user } = attempt;
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: withBasePath("/login") },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};
