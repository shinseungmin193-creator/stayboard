import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: NonNullable<DefaultSession["user"]> & { id: string };
  }

  interface User {
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionVersion?: number;
    sessionValid?: boolean;
  }
}
